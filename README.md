# CrimeIQ — KSP Crime Intelligence System

**KSP Datathon 2026 | Challenge 01: Intelligent Conversational AI for KSP Crime Database**

A conversational AI platform for the Karnataka State Police (KSP) CCTNS crime database. Investigators ask natural-language questions; the system queries Zoho Catalyst Data Store, sends results to a Groq LLM, and returns AI-generated answers with supporting visualizations.

---

## 🚀 Live Demo

**Deployed URL:** https://crimeiq.onslate.in

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS |
| Backend | Zoho Catalyst Serverless Functions (Node.js, Basic I/O) |
| Database | Zoho Catalyst Data Store |
| AI Engine | Groq API (`llama-3.3-70b-versatile`) |
| Auth | Catalyst Embedded Authentication |
| Visualization | D3.js (Force-Directed Graph), jsPDF |
| Deployment | Catalyst Slate (Frontend) + Catalyst Functions (Backend) |

---

## ✨ Features

- **Conversational AI Chat** — Ask questions in plain English or Kannada about FIRs, accused, victims, and crime patterns
- **Context-Aware Follow-ups** — References specific FIR numbers from conversation history for follow-up questions
- **Criminal Network Graph** — D3.js force-directed visualization of criminal associations, color-coded by link type
- **Predictive Threat Alerts** — Rule-based crime spike detection across Karnataka districts
- **Voice Mode** — Hands-free immersive voice interface with barge-in interruption support
- **Kannada Language Support** — Both input (Web Speech API) and output (Groq LLM response)
- **Explainable AI Audit Trail** — Every ZCQL query executed is shown transparently
- **PDF Export** — Download conversation as a formatted investigator report
- **Role-Based Access** — Investigator / Analyst / Supervisor / Admin clearance levels

---

## 🗄️ Database Schema (Catalyst Data Store)

```
FIR            — fir_number, station, district, crime_type, date_of_incident, status, description, latitude, longitude
Accused        — fir_id, name, age, gender, address, prior_record, modus_operandi
Victim         — fir_id, name, age, gender
CriminalLink   — accused_id_1, accused_id_2, link_type, fir_id
UserRoles      — catalyst_user_id, role, full_name
```

~210 rows seeded across 6 districts with 10 crime types.

---

## 📁 Project Structure

```
crimeiq-ksp/
├── catalyst.json              # Catalyst CLI config
├── client/                    # React frontend (deployed via Catalyst Slate)
│   ├── index.html             # Catalyst Web SDK script tags
│   ├── vite.config.js         # Dev proxies + external SDK config
│   ├── src/
│   │   ├── App.jsx            # Main chat UI, auth gate, PDF export
│   │   ├── Login.jsx          # Catalyst embedded auth + role selection
│   │   ├── NetworkGraph.jsx   # D3.js criminal network visualization
│   │   ├── VoiceOverlay.jsx   # Immersive voice mode UI
│   │   └── main.jsx
│   └── public/
│       └── favicon.svg
├── functions/
│   ├── chat-function/         # Main AI query handler (Basic I/O)
│   ├── role-function/         # User role storage/lookup (Basic I/O)
│   └── seed-function/         # One-time DB seeding (already run)
└── HANDOFF_REPORT.md          # Full technical context
```

---

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 20+
- Zoho Catalyst CLI: `npm install -g zcatalyst-cli`
- Catalyst account with the `crimeiq` project

### Steps

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd crimeiq-ksp

# 2. Login to Catalyst CLI
catalyst login

# 3. Install frontend dependencies
cd client && npm install && cd ..

# 4. Install function dependencies
cd functions/chat-function && npm install && cd ../..
cd functions/role-function && npm install && cd ../..

# 5. Run the frontend dev server (proxies /api/chat and /api/role to Catalyst)
cd client && npm run dev
```

The dev server at `http://localhost:5173` will proxy API calls to the deployed Catalyst development environment.

---

## 🚢 Deployment

```bash
# Deploy everything (functions + slate frontend)
catalyst deploy

# Deploy only the chat function
npx zcatalyst-cli deploy --only functions:chat-function
```

---

## ⚠️ Important Notes

- **Groq API key** is hardcoded in `functions/chat-function/index.js` for the prototype. Move to Catalyst environment variables before public GitHub submission.
- The `<script src="/__catalyst/sdk/init.js">` warning during build is **expected and correct** — do not add `type="module"`, it would break Catalyst's SDK injection.
- The `crimeiq-client/` directory is a dead-end abandoned folder — do not use it.

---

## 👤 Author

Nishanth Konchada — KSP Datathon 2026
