<div align="center">
  <img src="https://crimeiq.onslate.in/favicon.svg" width="80" alt="CrimeIQ Logo" />
  <h1>CrimeIQ</h1>
  <p><strong>Intelligent Conversational AI for KSP Crime Database</strong></p>
  <p><em>Karnataka State Police (KSP) Datathon 2026 — Challenge 01</em></p>
  <a href="https://crimeiq.onslate.in"><strong>View Live Demo</strong></a>
</div>

<br />

CrimeIQ is a state-of-the-art conversational AI platform designed specifically for the Karnataka State Police (KSP) CCTNS database. Built natively on Zoho Catalyst, it empowers investigators to ask natural-language questions about crimes, analyze criminal networks, and generate predictive threat alerts.

## ✨ Key Features

- **Conversational Intelligence:** Query FIRs, accused profiles, victims, and crime patterns in plain English or Kannada.
- **Context-Aware Memory:** Seamlessly handle follow-up questions by retaining conversation history and resolving specific FIR contexts automatically.
- **Explainable AI (XAI):** Built-in audit trails show every executed ZCQL database query, ensuring 100% transparency for police analysts.
- **Criminal Network Visualization:** D3.js-powered force-directed graphs to visualize syndicate links (associates, gang members, co-accused).
- **Predictive Threat Alerts:** Automated rule-based engine to detect regional crime spikes and hotspot formations.
- **Hands-Free Voice Mode:** Immersive, interruptible Web Speech API interface tailored for officers in the field.
- **Role-Based Access Control:** Secure Catalyst embedded authentication supporting Investigator, Analyst, Supervisor, and Admin clearance tiers.
- **One-Click PDF Export:** Instantly download AI conversations as formatted, court-ready investigator reports.

---

## 🏗️ Architecture & Tech Stack

CrimeIQ uses a fully serverless, zero-maintenance architecture deployed entirely on Zoho Catalyst.

| Component | Technology Used | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite, Tailwind CSS | High-performance SPA, hosted on Catalyst Slate. |
| **Backend API** | Node.js (Catalyst Basic I/O) | Serverless functions for lightning-fast query resolution. |
| **Database** | Zoho Catalyst Data Store | Relational NoSQL storage holding synthetic CCTNS data. |
| **AI Engine** | Groq API (`llama-3.3-70b-versatile`) | Ultra-low latency LLM inference for natural language understanding. |
| **Authentication** | Catalyst Auth & User Profiles | Secure embedded login with email/password and social OAuth. |
| **Visualization** | D3.js | Interactive rendering of complex criminal hierarchies. |

### 🏆 Datathon Catalyst Services Compliance
CrimeIQ strictly adheres to the mandatory deployment guidelines, heavily leveraging the native Zoho Catalyst ecosystem.

| Datathon Rule | Required Service | Implementation in CrimeIQ |
| :--- | :--- | :--- |
| **Rule #1** (Serverless backend logic) | **Catalyst Serverless** | Basic I/O functions power the `chat-function`, `role-function`, and `seed-function`. |
| **Rule #4** (Frontend/SPA Hosting) | **Catalyst Slate** | The entire React/Vite web client is hosted via Slate. |
| **Rule #6 & #10** (Relational DB & Search) | **Catalyst Data Store** | ZCQL query engine powers complex relational JOINs, text searches, and data retrieval across all crime tables. |
| **Rule #17** (User Auth & Login) | **Catalyst Authentication** | Secure Officer Login is handled natively via Embedded Auth. |
| **Rule #18** (API routing & security) | **Catalyst API Gateway** | Basic I/O functions are securely exposed and routed via Catalyst's managed API gateway endpoints. |

> [!NOTE]
> **Technical Justification for LLM Selection (Exception to Rule #11)**
> CrimeIQ utilizes the `llama-3.3-70b-versatile` model via the **Groq API** instead of Catalyst QuickML. This architecture deviation was strictly necessary to support CrimeIQ's immersive **Voice Mode**, which demands ultra-low latency inference (~300 tokens/second) to facilitate real-time, interruptible conversational interactions ("walkie-talkie" style). Furthermore, QuickML LLM Serving is currently in restricted Early Access and cannot be reliably provisioned for all deployment environments.

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
│       ├── App.jsx            # Main chat interface and logic core
│       ├── Login.jsx          # Embedded auth and role selection
│       ├── NetworkGraph.jsx   # D3.js visualization component
│       ├── VoiceOverlay.jsx   # Voice mode UI
│       └── main.jsx           # React DOM renderer
└── functions/
    ├── chat-function/         # AI query engine & ZCQL orchestrator (Basic I/O)
    ├── role-function/         # User authorization & persistence (Basic I/O)
    └── seed-function/         # Database initialization routine
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

### Environment Variables (Important)
CrimeIQ requires a Groq API Key to power the LLM. For security, this is strictly managed via Catalyst Environment Variables and is **never** committed to source code.

1. Go to the **Catalyst Console** → `crimeiq` project.
2. Navigate to **Serverless** → **Functions** → `chat-function` → **Configurations**.
3. Under **Environment Variables**, add:
   - Key: `GROQ_API_KEY`
   - Value: `your_groq_api_key_here`

---

## 👨‍💻 Author
**Nishanth Konchada**  
Built for the Karnataka State Police (KSP) Datathon 2026.
