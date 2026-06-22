# CrimeIQ — Project Handoff Report
**KSP Datathon 2026 — Challenge 01: Intelligent Conversational AI for KSP Crime Database**

This document is a full handoff of everything built so far, the current state of each piece, and what's left to do. Read this fully before making changes — several parts were debugged through painful trial and error and should not be "simplified" without understanding why they're built the way they are.

---

## 1. PROJECT OVERVIEW

CrimeIQ is a conversational AI platform for the Karnataka State Police (KSP) crime database. Investigators ask natural-language questions; the system queries a Zoho Catalyst Data Store, sends results to a Groq LLM, and returns AI-generated answers with supporting visualizations (criminal network graphs, structured data tables).

**Stack:**
- Frontend: React + Vite + Tailwind CSS, deployed via Catalyst Slate
- Backend: Catalyst Serverless Functions (Node.js, Basic I/O type)
- Database: Catalyst Data Store (relational tables)
- AI: Groq API (`llama-3.3-70b-versatile`)
- Auth: Catalyst Embedded Authentication
- Visualization: D3.js (force-directed graph), jsPDF (export)

**Catalyst Project ID:** `50322000000019001`
**Catalyst Account ID:** `60074288350`
**Project name:** `crimeiq`

---

## 2. REPOSITORY STRUCTURE

```
crimeiq-ksp/
├── catalyst.json              # Catalyst CLI config (functions targets, slate config)
├── client/                    # Main React app source (THIS is the real app)
│   ├── index.html             # Has Catalyst Web SDK script tags
│   ├── vite.config.js         # Has /api/chat and /api/role dev proxies + external SDK config
│   ├── cli-config.json        # Slate build config (build_command, build_path, framework)
│   └── src/
│       ├── App.jsx            # Main app — chat UI, auth gate, PDF export, network graph trigger
│       ├── Login.jsx          # Catalyst embedded auth login + role selection
│       ├── NetworkGraph.jsx   # D3.js force-directed criminal network visualization
│       ├── main.jsx
│       └── index.css          # Tailwind import only
├── crimeiq-client/             # DEAD END — do not use. See section 6.
├── functions/
│   ├── chat-function/         # Main AI query handler
│   │   ├── index.js
│   │   └── catalyst-config.json
│   ├── role-function/         # User role storage/lookup
│   │   ├── index.js
│   │   └── catalyst-config.json
│   └── seed-function/         # One-time DB seeding (already run, can ignore now)
│       ├── index.js
│       └── catalyst-config.json
└── scripts/                    # Old local seed script, superseded by seed-function
```

---

## 3. DATABASE SCHEMA (Catalyst Data Store)

All tables already created and seeded with ~210 rows of synthetic data across 30 Karnataka districts.

**FIR**: fir_number, station, district, crime_type, date_of_incident, status, description, latitude, longitude

**Accused**: fir_id (links to FIR.ROWID), name, age, gender, address, prior_record, modus_operandi

**Victim**: fir_id, name, age, gender

**CriminalLink**: accused_id_1, accused_id_2, link_type (gang_member/associate/family/prior_co-accused), fir_id

**UserRoles**: catalyst_user_id (Catalyst auth user ID), role (Investigator/Analyst/Supervisor/Admin), full_name

Crime types seeded: Theft, Burglary, Assault, Robbery, Fraud, Cybercrime, Murder, Kidnapping, Drug Trafficking, Domestic Violence.

---

## 4. FEATURES BUILT (all working, in this order)

### 4.1 Core conversational AI chat (`functions/chat-function/index.js`)
- Takes a natural language question via `?q=` query param
- `buildQueries()` parses the question for: district names, crime types, years, status keywords, person/victim/network keywords
- Builds and runs ZCQL queries against the relevant tables
- Sends results + question to Groq, gets back a natural language answer
- Returns `{ question, answer, data, query_count }` as JSON

**Important implementation details (don't break these):**
- District matching uses `UPPER(district) LIKE UPPER('%term%')` for case-insensitivity
- When a specific FIR number is detected (regex `FIR-[A-Z]{3}-\d{4}-\d{4}`), ALL other filters are ignored — only that FIR is matched (see `isFollowUp` check, only triggers on follow-up language like "that case", "this case", "the accused")
- For network/criminal queries: `CriminalLink` is fetched FIRST, then `Accused` is resolved via `WHERE ROWID IN (...)` using only the IDs referenced in those links — this guarantees the network graph has connected data (a major bug we fixed: independently fetching both tables with separate LIMIT 10 produced near-zero overlap)
- Conversation history (last 6 messages) is passed in and combined with current question text for follow-up entity detection, but NOT for fresh-topic queries (a regex checks for follow-up language before reusing FIR context from history — otherwise "show me cybercrime cases" right after discussing a theft FIR would incorrectly stay scoped to the old FIR)

### 4.2 Frontend chat UI (`client/src/App.jsx`)
- Split layout: chat panel (left, 55%), Data View results panel (right, 45%)
- Markdown rendering via `react-markdown` for AI responses (bold, bullets, headers)
- Voice input via Web Speech API (`window.SpeechRecognition`)
- Suggested query chips shown on first load
- "View N records" button under AI messages opens the Data View panel with that response's data
- PDF export via jsPDF — strips markdown, formats as Investigator/CrimeIQ AI conversation log
- Role badge + logout button in header (post-auth)

### 4.3 Criminal Network Visualization (`client/src/NetworkGraph.jsx`)
- D3.js force-directed graph
- Renders automatically in the Data View panel whenever a response includes both `Accused` and `CriminalLink` data
- Nodes = accused persons (initials + name), edges = colored by link_type (red=gang_member, blue=associate, green=family, orange=prior_co-accused)
- Draggable nodes, clamped to stay within SVG bounds (fixed a bug where nodes escaped the container)
- IDs normalized to String() to avoid type mismatch bugs between ZCQL-returned BigInt-style IDs

### 4.4 Role-Based Access (in progress — see section 5)
- `Login.jsx` uses Catalyst's embedded auth (`catalyst.auth.signIn()`)
- After login, checks `role-function` (GET `/api/role?user_id=X`) for an existing role
- If no role found, shows a role-selection screen (Investigator/Analyst/Supervisor/Admin + full name), saves via POST to `role-function`
- `role-function/index.js` reads/writes the `UserRoles` table

---

## 5. CURRENT STATUS — WHAT'S WORKING, WHAT'S NOT

### ✅ Fully working (tested, confirmed via screenshots):
1. Context-aware conversations (follow-up questions correctly resolve to specific FIRs)
2. Criminal network graph (renders correctly, connected nodes, color-coded edges)
3. PDF export (downloads clean formatted conversation log)
4. Chat backend (`chat-function`) deployed and responding correctly on Catalyst
5. Database fully seeded (~210 FIRs + accused + victims + criminal links)
6. Frontend builds successfully via `npm run build` (Vite, no errors, one harmless warning about `/__catalyst/sdk/init.js` not being a module — this is EXPECTED and CORRECT, do not "fix" it by adding `type="module"`, that breaks Catalyst's SDK injection)
7. **Slate deployment is now live** at `react-vite-mjuarank.onslate.in` — confirmed loading after fixing `cli-config.json` to include `"framework": "react-vite"` (previously missing, caused Catalyst's buildpacks to misidentify the app as a generic Node server and crash on boot trying to run a nonexistent `npm start`)

### 🟡 In progress / needs verification:
1. **Catalyst embedded auth login flow** — page loads now on the Slate URL, but we have NOT yet confirmed the actual `catalyst.auth.signIn()` login form renders inside the `#loginDivElementId` div, or that a full signup → role-selection → chat flow works end to end. This was last screenshotted showing just the "CrimeIQ" header card with a blank area below it — could mean the login form hasn't rendered yet (still polling/loading) or there's a JS error blocking it.
2. **Network access oddity**: the deploying developer found the Slate URL only loaded reliably while connected to a VPN, and got `ERR_CONNECTION_RESET` on normal network. This is suspicious — could be an ISP-level DNS block on the `.onslate.in` domain, a regional routing issue, or ISP throttling of unfamiliar domains. NOT yet root-caused. Needs testing from a different network/device to confirm whether this is a local network issue or something on Catalyst's side.

### ❌ Not yet built:
1. Predictive analytics / early warning system (rule-based crime spike detection — not true ML, acceptable for prototype)
2. Kannada language support testing (Groq prompt currently English-only; Web Speech API `lang` is hardcoded to `en-IN`)
3. Explainable AI / formal audit trail UI (the AI does cite data in its answers, but there's no dedicated "audit log" view as described in the original problem statement)

---

## 6. KNOWN DEAD ENDS — DO NOT REPEAT THESE MISTAKES

1. **`crimeiq-client/` folder**: created via `catalyst client:setup` → "React web app" flow, which uses Catalyst's OLD "Web Client Hosting" service (different from Slate). This expects Create-React-App-style `build/` output, not Vite's `dist/`, and also tried to zip the entire `node_modules` folder during deploy (`ZIPSANITIZER_FILES_COUNT_EXCEEDED` error). **This folder is abandoned. The real, working app is in `client/`, deployed via Slate.** Do not try to deploy `crimeiq-client/` — delete it if it's causing confusion, but back up `client/` first as the source of truth.

2. **`catalyst token:generate` CLI tokens** do NOT work for direct REST API calls (`api.catalyst.zoho.in/baas/...`) — they only work for CLI-internal operations. We initially tried to build a local Node.js seed script using a CLI-generated token and it failed with `INVALID_TOKEN` on every request. The fix was to instead write the seeding logic as an actual Catalyst Serverless Function (`seed-function`), which uses the Catalyst SDK's automatic auth — no manual token needed.

3. **Basic I/O functions have a ~30 second execution timeout.** The original seed function tried to insert 200 FIRs (with related Accused/Victim/CriminalLink rows) in one call and hit `EXECUTION_TIME_EXCEEDED`. Fixed by batching: the function accepts a `?batch=N` query param and only processes 20 FIRs per call, requiring 10 sequential calls to seed everything.

4. **`basicIO.end()` and `basicIO.getRequest()` do not exist in this SDK version** (`zcatalyst-sdk-node` v3.4.0). The correct API is `basicIO.write(string)` to return a response and `context.close()` to end execution. Query params are read via `basicIO.getArgument('paramName')`. This took several failed deploys to discover via Catalyst's function logs (Console → Serverless → [function] → View Logs).

5. **CORS**: Catalyst Basic I/O functions do not have a console CORS toggle. For local dev, we use a Vite proxy (`/api/chat` → rewritten to the real Catalyst function URL server-side, avoiding browser CORS entirely). In production (deployed on Catalyst's own domain), CORS is presumably not an issue since frontend and backend share an origin context — but this has NOT been explicitly verified yet. If CORS errors appear in production, that's the next thing to check.

6. **`catalyst.json` "functions.targets" must be an array of plain strings** (function folder names), not objects. Got `Invalid target value: [object Object]` when we tried richer config objects. Also, each function folder needs its own `catalyst-config.json` (not the root `catalyst.json`) with this exact structure:
```json
{
  "deployment": {
    "name": "function-name",
    "stack": "node24",
    "type": "basicio",
    "env_variables": {}
  },
  "execution": {
    "main": "index.js"
  }
}
```

7. **Slate's `cli-config.json` MUST include `"framework": "react-vite"`** — without it, Catalyst's buildpack auto-detection silently assumes a generic Node.js server and tries to run `npm start` (which doesn't exist in a Vite app's package.json), causing the deployed container to crash immediately on boot. This produces a confusing `ERR_CONNECTION_RESET` on the live URL even though the BUILD step itself reports success. The deployment overview's preview thumbnail will say "Deployment Preview Failed" as a symptom of this.

---

## 7. ENVIRONMENT / CREDENTIALS NEEDED

- Groq API key: hardcoded in `functions/chat-function/index.js` (line ~5, `GROQ_KEY` constant) — DO NOT commit this to a public GitHub repo without moving it to an environment variable first (the KSP Datathon requires a public repo submission)
- Catalyst project is already linked via `.catalystrc` in the project root — no action needed unless working from a fresh clone, in which case run `catalyst login` and `catalyst project:use crimeiq`

---

## 8. IMMEDIATE NEXT STEPS (in priority order)

1. **Verify the Catalyst embedded auth login form actually renders** on the live Slate URL. Open browser DevTools console while loading the site, check for JS errors related to `window.catalyst` or `catalyst.auth`. If `window.catalyst` is undefined, the SDK script tags in `index.html` aren't loading — check Network tab for 404s on `catalystWebSDK.js` or `/__catalyst/sdk/init.js`.

2. **Root-cause the VPN-dependent connectivity issue.** Test the live URL from a different device/network (mobile data, different ISP) to determine if this is a local network/DNS problem or something Catalyst-side. If it's local, it doesn't block the demo (judges will access from their own network), but should still be understood before submission day.

3. **Complete one full auth cycle test**: sign up with a real email → see role selection screen → pick a role → land in the chat UI → confirm `UserRoles` table in Catalyst Data Store actually got a new row → refresh the page and confirm it skips role selection on return visits (since role now exists for that user).

4. Once auth is confirmed working end-to-end, move to building:
   - Predictive/early-warning feature (can be simple: a rule like "if a crime_type in a district has >N incidents in the last 30 days vs trailing average, flag it as a hotspot alert" — query-based, no real ML needed for prototype)
   - Kannada testing (at minimum, verify the Groq prompt can be asked to respond in Kannada when requested, even if not auto-detected)

5. Prepare the KSP Datathon submission package: GitHub repo (public, README, setup instructions), 3-minute demo video, deployed Slate link, and the prototype PPTX deck (already drafted separately, ask user if they need it re-synced with final feature set).

---

## 9. CODE STYLE / CONVENTIONS USED SO FAR

- Tailwind utility classes only, no custom CSS beyond the single `@import "tailwindcss"` in `index.css`
- Slate gray color palette (slate-50 through slate-900), no bright/saturated colors except semantic ones (red for gang_member links, blue for associate, etc.)
- All Catalyst function responses are JSON via `basicIO.write(JSON.stringify(...))`
- Frontend always unwraps Catalyst's `{ output: "stringified json" }` response shape before using the data
- Error states are handled gracefully — AI honestly says "no data found" rather than hallucinating, and the query builder always has fallback behavior (e.g., if a filtered query returns zero rows, sometimes falls back to a general sample with a `_note` field explaining why)
