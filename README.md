# 🔍 LogDoc — Full-Fledged Log Intelligence & Diagnostics Platform

**LogDoc** is a high-performance, full-stack log analysis and automated incident diagnostic platform. It seamlessly ingests, auto-detects, parses, and clusters logs from diverse enterprise sources, detects anomalies and volume spikes in real-time, and generates automated root-cause analyses (RCA) using both rule-based heuristic intelligence and Google Gemini LLMs.

**Live Deployment**: [`https://logdoc.cyberforage.space`](https://logdoc.cyberforage.space)  
**GitHub Repository**: [`https://github.com/nishchaygaur/LogDoc`](https://github.com/nishchaygaur/LogDoc)

---

## 🚀 Key Capabilities

### 1. 🌐 Universal Log Parsing & Auto-Detection
- **JSON & NDJSON**: Kubernetes, Docker, Bunyan, Winston, Serilog, Logstash formats with automatic field mapping (`timestamp`, `level`, `service`, `message`, plus arbitrary nested metadata).
- **NGINX & Apache Access Logs**: Combined and Common log formats with IP, status codes, request methods, paths, byte transfer, and user agents.
- **Syslog**: Both BSD RFC 3164 and modern RFC 5424 formats with facility and priority severity extraction.
- **Spring Boot & Java Stacktraces**: Multi-line exception grouping (e.g., `NullPointerException`, `NestedServletException`, `Caused by:` lines attached to parent events).
- **Logfmt**: Key=value structured logs commonly used in Go microservices and Heroku.
- **Generic Fallback**: Flexible regex matching for custom timestamp, log level, and component patterns.

### 2. 🧩 Drain Log Template Mining (Message Clustering)
- Implements an online **Drain algorithm** that mines structured templates from tens of thousands of unstructured log events.
- Replaces dynamic variables (IPs, UUIDs, hashes, hex codes, timestamps, URLs, numbers) with `<*>` wildcards.
- Condenses 50,000 messy log lines into a handful of clean, actionable templates with exact occurrence counts and error rates.
- One-click template filtering to inspect every concrete event belonging to a template.

### 3. 🚨 Telemetry Anomaly & Spike Detection
- **Error Burst Detection**: Moving-window z-score and thresholding to immediately identify sudden jumps in error rates.
- **HTTP Outlier Alerts**: Tracks abnormal surges in 500, 502 Bad Gateway, 504 Gateway Timeout, and 401/403 responses.
- **Security & Brute Force Detection**: Correlates repeated authentication failures and password attempts from offending source IPs.
- **Rare Template Signatures**: Flags newly surfaced or isolated error signatures that indicate silent regressions.

### 4. 🤖 AI-Powered Incident Diagnostics & Root Cause Analysis
- **Dual-Engine Architecture**:
  - **Expert Heuristic Engine**: Zero-latency, rule-based diagnostic system for Database pool exhaustion, Memory saturation (OOM), Cascading microservice timeouts, Auth attacks, and Null references. Works completely offline with no API key needed!
  - **Google Gemini Integration**: Powered by `gemini-2.5-flash` via the official `google-genai` SDK. Synthesizes executive summaries, technical root causes, impact assessments, and actionable remediation checklists.
- **Executive Incident Reports**: One-click generation of print-ready, standalone HTML incident post-mortems.

### 5. 📡 Real-Time Live Tailing & WebSockets
- Real-time event streaming directly into the browser via high-performance WebSockets.
- Built-in **Live Simulator** mode to test real-time streaming, auto-scroll, and dynamic clustering without needing a production daemon.

### 6. 📊 Visual Analytics & Interactive Filtering
- **Time-Series Histogram**: Stacked volume visualization by log level (INFO, WARN, ERROR, DEBUG) across dynamically calculated time buckets.
- **Search & Filter Engine**: Full-text keyword search, Regular Expression (`.*`) queries, log level toggles, service selectors, and sorting.
- **Structured Inspector**: Click any row to expand structured metadata attributes, stack traces, and raw lines with copy-to-clipboard.
- **Multi-Format Export**: Export filtered log subsets as JSON or CSV spreadsheets.

---

## 🏗️ Architecture

```
LogDoc/
├── backend/
│   ├── app/
│   │   ├── parsers/         # Universal log parsers (JSON, NGINX, Syslog, SpringBoot, Logfmt)
│   │   ├── analytics/       # Drain clustering, Anomaly detection, Metrics & AI diagnostics
│   │   ├── generator/       # Synthetic log generators for 1-click demos
│   │   ├── streaming/       # WebSockets & live log simulation
│   │   ├── store.py         # Indexed in-memory log dataset store
│   │   └── main.py          # FastAPI application & REST/WebSocket routes
│   └── tests/               # Pytest automated test suite
├── frontend/                # React 19 + TypeScript + Vite + TailwindCSS + Recharts
│   └── src/
│       ├── components/      # UI components (Navbar, LogStream, Histogram, Modals)
│       ├── api/             # REST & WebSocket API clients
│       └── types/           # Strongly typed data models
├── sample_logs/             # Pre-built sample logs (Microservices, Nginx, SSH, SpringBoot)
├── run_logdoc.bat           # Windows one-click start script
├── run_logdoc.ps1           # PowerShell one-click start script
└── README.md
```

---

## ⚡ Quickstart Guide

### Prerequisites
- **Python 3.10+**
- **Node.js 18+** & **npm**

### Option A: One-Click Launcher (Windows)
Double-click `run_logdoc.bat` or run:
```powershell
.\run_logdoc.ps1
```
This automatically starts the FastAPI backend on `http://127.0.0.1:8000` and the React frontend on `http://localhost:3000`.

### Option B: Manual Execution

#### 1. Setup Backend
```bash
# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate  # Windows (or source .venv/bin/activate on Linux/Mac)

# Install dependencies
pip install -r backend/requirements.txt

# Run backend
python backend/run.py
```

#### 2. Setup Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

## 🧪 Testing

Run the automated backend test suite:
```bash
.venv\Scripts\python.exe -m pytest backend/tests/test_backend.py -v
```

All 7 test suites verify:
- ✅ JSON / NDJSON parsing with metadata extraction
- ✅ NGINX / Apache combined access log parsing
- ✅ Syslog BSD RFC 3164 and RFC 5424 parsing
- ✅ Multi-line Java Spring Boot stacktrace grouping
- ✅ Logfmt key=value parsing
- ✅ Drain log template mining and parameter extraction
- ✅ FastAPI REST & WebSocket endpoints and HTML report generation

---

## 📖 API Documentation

Once the backend is running, explore the interactive OpenAPI Swagger documentation at:
**`http://127.0.0.1:8000/docs`**

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health status |
| `GET` | `/api/datasets` | List available datasets |
| `POST` | `/api/datasets/select` | Switch active dataset |
| `POST` | `/api/upload` | Upload and parse raw log file |
| `POST` | `/api/load-sample` | Load pre-configured sample dataset |
| `GET` | `/api/logs` | Query, search, and paginate logs |
| `GET` | `/api/clusters` | Get Drain mined template clusters |
| `GET` | `/api/anomalies` | Get detected telemetry anomalies |
| `GET` | `/api/metrics` | Summary metrics, error rate & histogram |
| `POST` | `/api/diagnostics` | Run Heuristic or Gemini AI root cause analysis |
| `POST` | `/api/simulator/control` | Start/stop live tail simulation |
| `GET` | `/api/export` | Export filtered logs (JSON or CSV) |
| `GET` | `/api/export/report` | Standalone print-ready HTML report |
| `WS` | `/ws` | Live log streaming WebSocket |

---

## 📄 License
MIT License. Built for modern DevOps, SREs, and Platform Engineers.
