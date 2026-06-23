<div align="center">
  <img src="https://crimeiq.onslate.in/favicon.svg" width="80" alt="CrimeIQ Logo" />
  <h1>CrimeIQ</h1>
  <p><strong>Intelligent Conversational AI for KSP Crime Database</strong></p>
  <p><em>Karnataka State Police (KSP) Datathon 2026 — Challenge 01</em></p>
  <a href="https://crimeiq.onslate.in"><strong>View Live Demo</strong></a>
</div>

<br />

CrimeIQ is a state-of-the-art conversational AI platform designed specifically for the Karnataka State Police (KSP) CCTNS database. Built natively on Zoho Catalyst, it empowers investigators to ask natural-language questions about crimes, analyze criminal networks, generate case narratives, and predict escape routes in real-time.

## ✨ Key Features

- **Conversational Intelligence:** Query FIRs, accused profiles, victims, and crime patterns in plain English or Kannada.
- **AI Case Narratives & Kannada Translation 📖:** One-click auto-generation of court-ready official investigation reports that synthesize crime details, timelines, and network connections. Features instantaneous translation into Kannada script.
- **Geospatial Escape Predictor 🎯:** Interactive maps predicting highly-probable escape routes for accused criminals based on past patterns and geographical proximity, driven by AI rationale.
- **Explainable AI (XAI):** Built-in audit trails show every executed ZCQL database query, ensuring 100% transparency for police analysts.
- **Criminal Network Visualization:** D3.js-powered force-directed graphs to visualize syndicate links (associates, gang members, co-accused).
- **Hands-Free Voice Mode:** Immersive, interruptible Web Speech API interface tailored for officers in the field.
- **Role-Based Access Control:** Secure Catalyst embedded authentication supporting Investigator, Analyst, Supervisor, and Admin clearance tiers.
- **One-Click PDF Export:** Instantly download AI case reports and data queries as formatted, printable PDFs.

---

## 🏗️ Architecture & Tech Stack

CrimeIQ uses a fully serverless, zero-maintenance architecture deployed entirely on Zoho Catalyst.

| Component | Technology Used | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite, Tailwind CSS | High-performance SPA, hosted on Catalyst Slate. |
| **Backend API** | Node.js (Catalyst Basic I/O) | Serverless functions for lightning-fast query resolution. |
| **Database** | Zoho Catalyst Data Store | Relational NoSQL storage holding synthetic CCTNS data. |
| **AI Engine** | Catalyst QuickML (`crm-di-glm47b_30b_it`) | Generative Language Model for natural language understanding and narrative synthesis. |
| **Authentication** | Catalyst Auth & User Profiles | Secure embedded login with email/password and role definitions. |
| **Visualization** | D3.js & React-Leaflet | Interactive rendering of complex criminal hierarchies and geospatial risk maps. |

### 🏆 Datathon Catalyst Services Compliance
CrimeIQ strictly adheres to the mandatory deployment guidelines, heavily leveraging the native Zoho Catalyst ecosystem.

| Datathon Rule | Required Service | Implementation in CrimeIQ |
| :--- | :--- | :--- |
| **Rule #1** (Serverless backend logic) | **Catalyst Serverless** | Basic I/O functions power the backend APIs (`chat-function`, `role-function`, `seed-function`). |
| **Rule #4** (Frontend/SPA Hosting) | **Catalyst Slate** | The entire React/Vite web client is hosted via Slate. |
| **Rule #6** (Relational database) | **Catalyst Data Store** | ZCQL engine powers complex relational JOINs and data retrieval across all structured crime tables. |
| **Rule #9** (Cache) | **Catalyst Cache** | High-speed memory caching is used in `role-function` to instantly resolve Officer identities. |
| **Rule #10** (Full-text search) | **Catalyst Data Store** | Used extensively to execute text-matching searches across FIR descriptions and case context. |
| **Rule #11** (LLM & Generative AI) | **Catalyst QuickML** | The `crm-di-glm47b_30b_it` model deployed via QuickML powers the core Conversational AI, translations, and predictive reasoning. |
| **Rule #17** (User Auth & Login) | **Catalyst Authentication** | Secure Officer Login is handled natively via Embedded Auth. |
| **Rule #18** (API routing & security) | **Catalyst API Gateway** | Basic I/O functions are securely exposed and routed via Catalyst's managed API gateway endpoints. |
| **Rule #20** (Scheduled jobs) | **Catalyst Cron** | Nightly `threat-cron-function` scans the database to aggregate unresolved FIRs and predict crime spikes. |

---

## 🗄️ Database Schema

The system is pre-seeded with ~210 rows of highly detailed, synthetic crime data across various Karnataka districts.

- **`FIR`**: `fir_number`, `station`, `district`, `crime_type`, `date_of_incident`, `status`, `description`, `latitude`, `longitude`
- **`Accused`**: `fir_id` (foreign key), `name`, `age`, `gender`, `address`, `prior_record`, `modus_operandi`
- **`Victim`**: `fir_id`, `name`, `age`, `gender`
- **`CriminalLink`**: `accused_id_1`, `accused_id_2`, `link_type`, `fir_id`
- **`UserRoles`**: `catalyst_user_id`, `role`, `full_name`

---

## 📁 Project Structure

```text
crimeiq-ksp/
├── catalyst.json              # Zoho Catalyst CLI configuration
├── client/                    # React frontend application
│   ├── index.html             # Entry point with Catalyst Web SDK
│   ├── vite.config.js         # Build configuration and API proxies
│   └── src/
│       ├── App.jsx            # Main chat interface, logic core, AI Case Reports, and Maps
│       ├── Login.jsx          # Embedded auth and role selection
│       ├── NetworkGraph.jsx   # D3.js visualization component
│       ├── VoiceOverlay.jsx   # Voice mode UI
│       └── main.jsx           # React DOM renderer
└── functions/
    ├── chat-function/         # AI query engine, Translator, & ZCQL orchestrator
    ├── role-function/         # User authorization & caching
    ├── seed-function/         # Database initialization routine
    └── threat-cron-function/  # Nightly predictive alerts
```

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js** (v20 or higher)
- **Zoho Catalyst CLI** (`npm install -g zcatalyst-cli`)
- Active **Zoho Catalyst Account**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/NISHANTH-KONCHADA/crimeiq-ksp.git
   cd crimeiq-ksp
   ```

2. **Authenticate with Catalyst:**
   ```bash
   catalyst login
   ```

3. **Install Dependencies:**
   ```bash
   # Frontend
   cd client && npm install && cd ..
   
   # Serverless Functions
   cd functions/chat-function && npm install && cd ../..
   cd functions/role-function && npm install && cd ../..
   ```

4. **Start the Development Server:**
   ```bash
   cd client && npm run dev
   ```
   *The frontend runs at `http://localhost:5173` and automatically proxies `/server/chat-function/execute` to the live Catalyst development environment.*

---

## 🚀 Deployment Guide

Deploying the entire infrastructure (Frontend Slate + Backend Functions) takes a single command:

```bash
catalyst deploy
```

### 🔒 Native Security (Zero External Keys)
CrimeIQ is built entirely on the Catalyst ecosystem. The Conversational AI utilizes **Catalyst QuickML**, which means there are absolutely **zero external API keys** (like OpenAI or Groq) required in your environment variables. All authentication is securely managed intra-service via Catalyst's native SDK and role-based access.

---

## 👨‍💻 Author
**Nishanth Konchada**  
Built for the Karnataka State Police (KSP) Datathon 2026.
