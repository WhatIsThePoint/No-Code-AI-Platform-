# No-Code AI Platform

> **End-of-Studies Project (PFE)** — A privacy-first, no-code MLOps & GenAI platform that runs **100% locally** on commodity hardware.

[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Python](https://img.shields.io/badge/python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![License](https://img.shields.io/badge/license-Academic-lightgrey.svg)](#license)

---

## 1. Vision — Why This Project Exists

Most no-code ML platforms (DataRobot, Azure ML Studio, Vertex AI) deliver fantastic UX **at the cost of shipping every byte of your data to a third-party cloud**. For regulated industries — healthcare, finance, public sector — that trade-off is a non-starter.

This platform was built as a **graduation project (PFE)** to prove that the *entire* DataRobot/Azure ML experience — from CSV upload through training, explainability, and a chat-based AI copilot — can run **on a single workstation, with zero outbound network calls**.

### Core Philosophy: 100% Local, Data Privacy First

| Concern | Cloud SaaS | This Platform |
|---|---|---|
| Where does your data go? | Vendor's S3 buckets | Your laptop's `./data` volume |
| Who runs the LLM? | OpenAI / Anthropic / Google | Local **Ollama** (`llama3.2:3b`) |
| Where do embeddings live? | Pinecone / Weaviate Cloud | Local **PostgreSQL + pgvector** |
| Can it work air-gapped? | No | **Yes** |
| Per-token cost | $$$ | $0 |

Every AI feature — chat, RAG, embeddings, the in-app companion — routes through a **local Ollama runtime**. No `OPENAI_API_KEY` exists in this codebase.

---

## 2. Feature Highlights

### Sprint 1–3 — Foundations
- JWT auth with refresh tokens, RBAC (admin / user / company-admin), Redis blacklist
- Two-tier ACL: **personal workspaces** (free tier) vs **company workspaces** (team tier)
- CSV/Excel ingestion with chunked uploads, profiling, train/test split
- Visual pipeline builder (React Flow) + Celery-backed training of XGBoost / LightGBM / CatBoost / Ridge / Random Forest
- Model registry, results dashboard, billing & admin pages

### Sprint 4–5 — MLOps & Collaboration
- Guided MLOps wizard (target → algorithm → hyperparameters → train)
- **SHAP** explainability (global + per-prediction force plots)
- Real-time collaborative chat per pipeline (Flask-SocketIO)
- Pipeline templates & reusable presets

### Sprint 6 — Local GenAI & RAG
- **Local document RAG** powered by `sentence-transformers/all-MiniLM-L6-v2` + pgvector
- PDF/Markdown/CSV ingestion → chunking → embedding → semantic search
- RAG-augmented chat grounded in your own documents — no data ever leaves the box

### Sprint 7 — Production Polish
- **Module 1 — Model Portability:** export trained models as `.joblib` bundles + auto-generated FastAPI inference scripts. Run anywhere — laptop, Kubernetes, edge device.
- **Module 2 — Power BI-Grade Profiling:** z-score outlier detection, target imbalance alerts (SMOTE suggestions), skewness detection (log-transform recommendations), box/violin plots.
- **Module 3 — Real-Time Training Telemetry:** Azure-ML-style live charts. Redis-backed SocketIO `/training` namespace streams `progress_pct`, stage labels, and metric points; client renders dual-axis Plotly charts and confusion-matrix heatmaps as the model trains.
- **Module 4 — Context-Aware AI Companion:** floating chat FAB that knows what screen you're on. Asks Ollama questions like *"Which model should I pick for this dataset?"* with the active pipeline + dataset injected as system context.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend  —  React 18 + Vite + MUI + Zustand + Plotly + Reactflow │
└──────────────────────────────┬──────────────────────────────────┘
                               │ HTTPS / WebSocket
                ┌──────────────▼──────────────┐
                │   API Gateway (Flask)        │  ← JWT verify, rate limit,
                │   • routes/proxy             │    SocketIO hub, AI companion
                │   • routes/companion         │
                │   • sockets/{chat,training}  │
                └──┬─────────┬──────────┬──────┘
                   │         │          │
        ┌──────────▼──┐  ┌───▼───────┐ ┌▼──────────────┐
        │ auth-service │  │ data-     │ │ ml-training-  │
        │ Flask + JWT  │  │ ingestion │ │ service       │
        │              │  │ -service  │ │               │
        └──────┬───────┘  └─────┬─────┘ └───────┬───────┘
               │                │                │
               │           ┌────▼─────┐    ┌─────▼─────┐
               │           │ Celery   │    │ Celery    │
               │           │ ingestion│    │ training  │
               │           │ worker   │    │ worker    │
               │           └────┬─────┘    └─────┬─────┘
               │                │                │
   ┌───────────▼──┐  ┌──────────▼──┐  ┌──────────▼──┐  ┌─────────┐
   │ PostgreSQL   │  │ MongoDB     │  │ Redis       │  │ Ollama  │
   │ + pgvector   │  │ pipelines / │  │ broker /    │  │ local   │
   │ auth, RBAC,  │  │ datasets /  │  │ socketio    │  │ LLM     │
   │ embeddings   │  │ task_results│  │ message bus │  │ runtime │
   └──────────────┘  └─────────────┘  └─────────────┘  └─────────┘
```

### Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, MUI v5, Zustand, React Flow, Plotly.js, socket.io-client |
| API Gateway | Flask, Flask-JWT-Extended, Flask-Limiter, Flask-SocketIO (threading mode) |
| Microservices | Flask + Celery (data-ingestion, ml-training, auth) |
| Databases | PostgreSQL 15 + pgvector, MongoDB 6, Redis 7 |
| Local AI | Ollama (`llama3.2:3b`), sentence-transformers (`all-MiniLM-L6-v2`) |
| ML Algorithms | XGBoost, LightGBM, CatBoost, scikit-learn, SHAP |
| Orchestration | Docker Compose (single-host); Alembic migrations |

---

## 4. Local Setup

### Prerequisites
- Docker Desktop (or Docker Engine + Compose v2)
- 8 GB RAM minimum, 16 GB recommended (Ollama loads `llama3.2:3b` ≈ 2 GB)
- Optional: NVIDIA GPU with ≥ 4 GB VRAM for faster Ollama inference

### Three commands to a working platform

```bash
# 1. Boot every container
make up

# 2. Apply Alembic migrations to the auth-service DB
make migrate

# 3. Seed demo users + a sample company workspace
make seed
```

That's it. Open **<http://localhost:5173>** and log in:

| Email | Password | Role |
|---|---|---|
| `alice@acme-ml.com` | `Demo1234!` | Company admin (full demo) |

### Ollama model setup (one-time)

```bash
docker compose exec ollama ollama pull llama3.2:3b 
docker compose exec ollama ollama pull nomic-embed-text   # optional, for richer embeddings
```

### Useful Make targets

| Command | What it does |
|---|---|
| `make up` / `make down` | Start / stop the stack |
| `make logs` | Tail all container logs |
| `make test` | Run the full pytest suite across every backend service |
| `make lint` | black + isort + flake8 over all services |
| `make migration MSG="..."` | Generate a new Alembic migration |
| `make shell-auth` / `make shell-ml` / `make shell-ingestion` | Drop into a service container |

---

## 5. End-to-End Demo

Walk through the platform click-by-click using **[`docs/E2E_TEST_GUIDE.md`](docs/E2E_TEST_GUIDE.md)** — it covers onboarding, workspace creation, dataset upload & profiling, model training with live telemetry, results inspection, and one-click model export.

For deeper architectural context, see **[`TECHNICAL_REPORT.md`](TECHNICAL_REPORT.md)** (formal end-of-studies report) and the per-sprint walkthroughs (`WALKTHROUGH.md`, `WALKTHROUGH_SPRINT6.md`).

---

## 6. Repository Layout

```
.
├── frontend/                       # React 18 + Vite SPA
│   └── src/
│       ├── pages/                  # Route-level views
│       ├── components/             # Reusable UI (pipeline, profiling, companion, ...)
│       ├── api/                    # Axios + socket.io clients
│       └── store/                  # Zustand slices
├── services/
│   ├── api-gateway/                # Flask gateway, SocketIO hub, AI companion proxy
│   ├── auth-service/               # JWT, RBAC, ACL, billing, Alembic migrations
│   ├── data-ingestion-service/     # CSV/Excel upload, profiling, RAG ingestion
│   └── ml-training-service/        # Celery training, model registry, SHAP, export
├── infra/
│   └── postgres/                   # init scripts, seed.sql, pgvector extension
├── docker-compose.yml              # Single-host orchestration
├── Makefile                        # Developer ergonomics
├── docs/E2E_TEST_GUIDE.md          # Click-by-click happy-path script
└── TECHNICAL_REPORT.md             # Formal PFE technical report
```

---

## 7. Testing & Quality

- Backend: `pytest` per service (auth-service, data-ingestion-service, ml-training-service, api-gateway). Coverage gate enforced via `--cov=app`.
- Frontend: `npm run test` (Vitest) + `npx tsc --noEmit -p tsconfig.app.json` for type safety.
- Pre-commit hooks: black, isort, flake8 (Python); ESLint + Prettier (TypeScript).
- CI: GitHub Actions runs lint + tests on every push.

---

## 8. License

Released under an **academic / educational** license. Built as the End-of-Studies project (Projet de Fin d'Études).

---

*Built with care, espresso, and a strong belief that your data should never leave your machine.*
