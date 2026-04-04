# No-Code AI Platform — Environment Guide & App Walkthrough

## Table of Contents

1. [Environment Variables Reference](#1-environment-variables-reference)
2. [First-Time Setup](#2-first-time-setup)
3. [App Feature Walkthrough](#3-app-feature-walkthrough)
4. [Architecture Overview](#4-architecture-overview)
5. [Common Issues & Fixes](#5-common-issues--fixes)

---

## 1. Environment Variables Reference

Copy `.env.example` to `.env` before first run. Variables marked **[MUST CHANGE]** are insecure placeholders that must be replaced before any internet-facing deployment.

### Global / Docker Compose (databases)

| Variable | Default | Notes |
|---|---|---|
| `POSTGRES_USER` | `nocode` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `nocode_secret` | **[MUST CHANGE]** PostgreSQL password |
| `POSTGRES_DB` | `nocode_auth` | PostgreSQL database name (auth tables) |
| `POSTGRES_HOST` | `postgres` | Hostname inside Docker network |
| `POSTGRES_PORT` | `5432` | PostgreSQL port |
| `MONGO_INITDB_ROOT_USERNAME` | `nocode` | MongoDB root username |
| `MONGO_INITDB_ROOT_PASSWORD` | `nocode_secret` | **[MUST CHANGE]** MongoDB root password |
| `MONGO_DB` | `nocode_ingestion` | MongoDB database name (datasets, pipelines, tasks) |
| `REDIS_URL` | `redis://redis:6379/0` | Redis connection string (Celery broker) |
| `CELERY_BROKER_URL` | `redis://redis:6379/0` | Celery task queue broker |
| `CELERY_RESULT_BACKEND` | `redis://redis:6379/1` | Celery result storage (separate DB index) |

### Auth Service

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET_KEY` | `change-me-in-production-...` | **[MUST CHANGE]** Signs all JWT tokens. Must be identical in `auth-service` and `api-gateway`. Generate: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_ACCESS_TOKEN_EXPIRES` | `900` | Access token lifetime in seconds (15 min) |
| `JWT_REFRESH_TOKEN_EXPIRES` | `2592000` | Refresh token lifetime in seconds (30 days) |
| `FERNET_KEY` | `change-me-generate-...` | **[MUST CHANGE]** Encrypts sensitive fields (e.g., DB connector passwords). Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |

> **Note:** The Fernet key must be exactly 44 characters (URL-safe base64-encoded 32 bytes). The placeholder value will raise a `ValueError` on first request — generate a real key before running.

### API Gateway

| Variable | Default | Notes |
|---|---|---|
| `AUTH_SERVICE_URL` | `http://auth-service:8001` | Internal Docker hostname — leave as-is |
| `DATA_SERVICE_URL` | `http://data-ingestion-service:8002` | Internal Docker hostname — leave as-is |
| `ML_SERVICE_URL` | `http://ml-training-service:8003` | Internal Docker hostname — leave as-is |
| `METRICS_SERVICE_URL` | `http://metrics-service:8004` | Internal Docker hostname — leave as-is |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins. **[MUST CHANGE]** for prod (e.g., `https://app.yourdomain.com`) |
| `RATELIMIT_DEFAULT` | `100 per minute` | Default rate limit per IP |
| `RATELIMIT_UPLOAD` | `10 per hour` | Rate limit for file upload endpoints |

### Data Ingestion Service

| Variable | Default | Notes |
|---|---|---|
| `MONGO_URL` | _(built from Mongo vars)_ | Full MongoDB URI including `authSource=admin` — set automatically by docker-compose |
| `UPLOAD_FOLDER` | `/uploads` | Mount point for the `uploaded_files` Docker volume |
| `MAX_UPLOAD_SIZE_MB` | `100` | Maximum CSV/Parquet upload size |

### ML Training Service

| Variable | Default | Notes |
|---|---|---|
| `MONGO_URL` | _(built from Mongo vars)_ | Same MongoDB instance, same `nocode_ingestion` DB |
| `MONGO_DB` | `nocode_ingestion` | Database name (read by PyMongo extension) |
| `MODEL_FOLDER` | `/models` | Mount point for the `model_artifacts` Docker volume |
| `MAIL_SERVER` | `mailhog` | SMTP host. Dev uses MailHog. **[MUST CHANGE]** for prod (e.g., `smtp.sendgrid.net`) |
| `MAIL_PORT` | `1025` | SMTP port. MailHog uses 1025. Prod TLS: `587` |
| `MAIL_USE_TLS` | `false` | Set to `true` for real SMTP with STARTTLS |
| `MAIL_USERNAME` | _(empty)_ | SMTP username — leave blank for MailHog |
| `MAIL_PASSWORD` | _(empty)_ | SMTP password — leave blank for MailHog |
| `MAIL_DEFAULT_SENDER` | `noreply@nocode-ai.local` | From address on training notifications |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL included in email links. **[MUST CHANGE]** for prod |

### Frontend

The frontend has no `.env` file — the Vite dev server proxies all `/api/*` requests to `http://localhost:8000` (the API gateway). This is configured in `frontend/vite.config.ts` and requires no changes for local development.

For production builds, set the `VITE_API_BASE` environment variable if your API gateway is on a different origin, or configure your web server (nginx/Caddy) to reverse-proxy `/api` to the gateway.

---

## 2. First-Time Setup

### Prerequisites

- Docker Engine 24+ and Docker Compose v2
- Node.js 20+ (only needed if running frontend outside Docker)
- `make` (standard on Linux/macOS; Windows: use Git Bash or WSL)

### Steps

```bash
# 1. Clone the repository
git clone <repo-url> && cd PFE

# 2. Create your .env file
cp .env.example .env

# 3. Generate and fill in the two required secrets
#    JWT secret key:
python -c "import secrets; print(secrets.token_hex(32))"
#    → paste the output as JWT_SECRET_KEY in .env

#    Fernet key:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
#    → paste the output as FERNET_KEY in .env

# 4. Build all images (takes 5–10 min on first run — Prophet/CatBoost are large)
make build

# 5. Start all services in the background
make up

# 6. Wait for databases to be ready (~10 seconds), then run Alembic migrations
make migrate

# 7. Open the app
#    Frontend:    http://localhost:5173
#    API Gateway: http://localhost:8000
#    MailHog UI:  http://localhost:8025   (dev email inbox)
```

### Verifying everything is healthy

```bash
docker compose ps
# All 12 containers should show status "Up" or "Up (healthy)"

# Tail logs for any startup errors:
make logs
```

---

## 3. App Feature Walkthrough

### 3.1 Register & Login

1. Navigate to **http://localhost:5173**.
2. Click **Register** — fill in name, email, password (min 8 chars).
3. You are redirected to the login page. Enter your credentials.
4. On success you receive a JWT access token (stored in memory) and a refresh token (httpOnly cookie). You are redirected to the **Dashboard**.

### 3.2 Two-Factor Authentication (2FA)

1. Go to **Profile** (top-right avatar menu → Profile).
2. Click **Enable 2FA**.
3. Scan the displayed QR code with Google Authenticator, Authy, or any TOTP app.
4. Enter the 6-digit code to confirm setup.
5. On subsequent logins, after entering your password you will be prompted for your TOTP code. The session is valid for 5 minutes while you retrieve the code.

> To disable 2FA: Profile → Security → Disable Two-Factor Authentication.

### 3.3 Profile Management

- Change your name or email under **Profile → Personal Info**.
- Change your password under **Profile → Security → Change Password** (requires current password).

### 3.4 Companies

**Create a company:**
1. Click **Companies** in the left sidebar.
2. Click **Create Company** and enter a name.
3. You become the owner of the company.

**Invite a team member:**
1. Open your company → **Members** tab → **Invite Member**.
2. Enter the user's email and select a role (`admin` or `data_scientist`).
3. The system generates an invitation link. In development the link is shown directly; in production it is sent via email (check MailHog at http://localhost:8025).

**Accept an invitation:**
1. Visit the invitation link (`/invitations/accept/<token>`).
2. If already logged in you are added to the company. Otherwise you are prompted to log in first.

### 3.5 Datasets

**Upload a CSV or Parquet file:**
1. Navigate to **Datasets** → **Upload File**.
2. Select your file (max 100 MB by default).
3. Optionally select a company to make the dataset visible to all company members.
4. Click **Upload**. A background Celery task runs:
   - Validates and stores the raw file.
   - Profiles the dataset (column types, missing values, cardinality, value distributions).
   - Saves a Parquet copy for fast downstream reads.
5. A progress bar appears. When the task reaches 100% the status chip changes to **Ready**.

**Preview data:**
1. Click on a dataset name to open it.
2. The **Preview** tab shows the first 50 rows in a paginated table.
3. Column types, null counts, and sample values are shown in the **Profile** tab.

**Data profiling report:**
- The **Profile** tab renders a full statistical summary: min/max/mean/std, top-N values, missing percentage, and a histogram bar per column.

**Preprocessing:**
1. Open a dataset → **Preprocess** tab.
2. Configure each column:
   - **Numeric:** StandardScaler, MinMaxScaler, RobustScaler, or no scaling.
   - **Categorical:** OneHotEncoder or OrdinalEncoder (label/ordinal strategies).
   - **Drop:** exclude a column entirely.
3. Click **Run Preprocessing**. A Celery task builds an sklearn `ColumnTransformer`, applies it, and saves `train.parquet` and `test.parquet` splits to the volume.
4. When complete, the dataset status changes to **Preprocessed** and the output files are ready for model training.

**Connect a SQL database:**
1. Datasets → **SQL Connect**.
2. Select `postgres` or `mysql`, fill in host/port/database/credentials.
3. Enter a SELECT query. The result is saved as a dataset (same profiling pipeline runs).

**Delete a dataset:**
- Dataset list → three-dot menu → **Delete**. This removes the MongoDB document and all associated files from the volume.

### 3.6 Pipelines

**Create a pipeline:**
1. Navigate to **Pipelines** → click the **+** button (bottom-right).
2. Enter a pipeline name and optional description. Click **Create**.
3. Click the pipeline card to open the **Pipeline Editor**.

**Building the pipeline graph:**

The editor is a drag-and-drop canvas with three node types:

| Node | Purpose |
|---|---|
| **Dataset** | Source node — select a preprocessed dataset |
| **Train** | Training node — pick an algorithm and configure hyperparameters |
| **Evaluate** | Output node — shows metrics and download button after training |

1. Click **+ Dataset** in the toolbar — a Dataset node appears. Click it to open the config panel and select a preprocessed dataset from the dropdown.
2. Click **+ Train** — a Train node appears. Connect the Dataset node's output handle to the Train node's input handle by dragging. In the config panel:
   - Select an **Algorithm** (see table below).
   - Adjust **Hyperparameters** using the sliders and dropdowns.
3. Click **+ Evaluate** — an Evaluate node appears. Connect Train's output to Evaluate's input.
4. Click **Save** in the toolbar to persist the graph.

**Supported algorithms:**

| Category | Algorithm | Key hyperparams |
|---|---|---|
| Classification | XGBoost Classifier | n_estimators, max_depth, learning_rate, subsample |
| Classification | Random Forest | n_estimators, max_depth, min_samples_split |
| Classification | Gradient Boosting (GBM) | n_estimators, learning_rate, max_depth |
| Classification | Logistic Regression (GLM) | C (regularization), solver, max_iter |
| Boosting | LightGBM | n_estimators, num_leaves, learning_rate |
| Boosting | CatBoost | iterations, depth, learning_rate |
| Clustering | K-Means | n_clusters, init method, max_iter, compute_elbow |
| Forecasting | Prophet | changepoint_prior_scale, seasonality_prior_scale, periods |

**Running training:**
1. Click **Run** in the toolbar.
2. A progress bar appears at the top of the canvas (updates every 2 seconds via polling).
3. Training progress stages: data load (10%) → model fit (25–75%) → evaluation (90%) → artifact save (100%).
4. On completion:
   - The Evaluate node shows the `version_id`.
   - The metrics panel opens automatically in the side drawer.
   - You receive an email notification at the address used to log in (visible in MailHog at http://localhost:8025).
5. On failure: the progress bar turns red, an error message is shown, and a failure email is sent.

**Step notes:**
- Click any node → **Notes** tab in the side drawer.
- Add a note (markdown supported). Notes are saved per pipeline node and visible to all pipeline collaborators.
- Edit or delete your own notes inline.

### 3.7 Metrics & Evaluation

The **Evaluate** node side panel renders charts based on the task type:

**Classification metrics:**
- Accuracy, Precision, Recall, F1 (macro-averaged) shown as a bar chart.
- ROC-AUC score.
- Confusion matrix (raw values).
- Feature importance bar chart (where applicable).

**Clustering metrics:**
- Silhouette score.
- Elbow curve (inertia vs. k, only when `compute_elbow=true`).

**Forecasting metrics:**
- Forecast line chart (historical actuals + predicted future values).
- MAE and RMSE.

### 3.8 Model Registry

1. Navigate to **Model Registry** in the sidebar.
2. Models are grouped by pipeline in tabs.
3. Each version shows: algorithm, training date, dataset used, and all evaluation metrics.
4. Click **Download** to download the `.joblib` artifact — this is a complete sklearn/XGBoost/LightGBM/CatBoost pipeline object that can be loaded directly with `joblib.load("model.joblib")` in Python.
5. Click **Delete** to remove a specific version (artifact + MongoDB document).

---

## 4. Architecture Overview

```
Browser (localhost:5173)
    │
    │  All /api/* requests proxied by Vite dev server
    ▼
API Gateway  :8000
    │  Decodes JWT, injects X-User-Id / X-User-Role headers
    │  Rate limits via Redis
    │
    ├──► Auth Service        :8001  ── PostgreSQL (users, companies, invitations, TOTP)
    │
    ├──► Data Ingestion      :8002  ──┐
    │        │                        ├── MongoDB (datasets, task_results)
    │        └──► Ingestion Worker    │   Redis (Celery queue: ingestion, connectors)
    │             (Celery)  ──────────┘
    │
    ├──► ML Training         :8003  ──┐
    │        │                        ├── MongoDB (pipelines, model_versions, notes, task_results)
    │        └──► Training Worker     │   Redis (Celery queue: training)
    │             (Celery)  ──────────┘   Volume: /models (joblib artifacts)
    │
    └──► Metrics Service     :8004  ── TimescaleDB (time-series metrics)

Supporting infrastructure:
    PostgreSQL  :5432   (auth tables via Alembic migrations)
    MongoDB     :27017  (all document data)
    Redis       :6379   (rate limiting, Celery broker + result backend)
    TimescaleDB :5433   (metrics time series)
    MailHog     :1025 (SMTP) / :8025 (web UI)  — dev email server
```

**JWT flow:**
1. `POST /auth/login` → auth-service returns `access_token` + sets `refresh_token` cookie.
2. Frontend stores `access_token` in Zustand store (in-memory, not localStorage).
3. Every API request sends `Authorization: Bearer <token>`.
4. API gateway decodes the JWT (same `JWT_SECRET_KEY`), adds `X-User-Id` and `X-User-Role` headers, then proxies to the target service.
5. When the access token expires (15 min), the frontend automatically calls `POST /auth/refresh` using the httpOnly cookie to get a new access token.

---

## 5. Common Issues & Fixes

### Fernet key error on startup

**Symptom:** `ValueError: Fernet key must be 32 url-safe base64-encoded bytes`

**Fix:** The placeholder `FERNET_KEY` in `.env.example` is not a valid key. Generate a real one:
```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
Paste the output (44 characters, ends with `=`) into `.env`.

---

### JWT signature verification fails (401 on every request after login)

**Symptom:** Login succeeds but every subsequent API call returns 401.

**Fix:** `JWT_SECRET_KEY` must be identical in both `auth-service` and `api-gateway`. Both read from the same `.env` file when using docker-compose, so this only happens if you override the key in one service's environment directly without updating the other. Restart both services after changing the key:
```bash
docker compose restart auth-service api-gateway
```

---

### MongoDB connection refused / authSource error

**Symptom:** Services fail to start with `Authentication failed` or `connection refused`.

**Fix:** The connection string requires `authSource=admin`. This is already set in `docker-compose.yml`. If you connect externally (e.g., with mongosh or Compass), use:
```
mongodb://nocode:nocode_secret@localhost:27017/nocode_ingestion?authSource=admin
```

---

### `make migrate` fails — "relation already exists"

**Symptom:** Re-running `make migrate` on an existing database.

**Fix:** This is safe to ignore — Alembic tracks applied migrations in the `alembic_version` table and skips already-applied ones. If you see a real error, connect to postgres and check:
```bash
docker compose exec postgres psql -U nocode -d nocode_auth -c "SELECT * FROM alembic_version;"
```

---

### Training job stuck at 0% / never starts

**Symptom:** After clicking **Run**, the progress bar stays at 0%.

**Checks:**
1. Confirm the training worker is running: `docker compose ps ml-training-worker` — should show `Up`.
2. Check worker logs: `docker compose logs ml-training-worker`.
3. The most common cause is the dataset not being in **Preprocessed** status — only preprocessed datasets produce the `train.parquet` / `test.parquet` files the training task reads.

---

### Prophet / CatBoost not found

**Symptom:** Training fails with `ModuleNotFoundError: No module named 'prophet'`.

**Fix:** These packages require native dependencies (gcc, g++, libgomp). The `ml-training-service` Dockerfile installs these via apt. If you are running the service outside Docker you need them installed:
```bash
# Ubuntu/Debian
sudo apt-get install -y gcc g++ libgomp1

# macOS (Homebrew)
brew install libomp
```

---

### Email notifications not arriving

**Symptom:** Training completes but no email appears in MailHog (http://localhost:8025).

**Fix:** Email delivery is best-effort — a failure never crashes training. Check the training worker logs:
```bash
docker compose logs ml-training-worker | grep -i mail
```
Confirm MailHog is running: `docker compose ps mailhog`. In production, replace `MAIL_SERVER=mailhog` with your real SMTP server and set `MAIL_USE_TLS=true`, `MAIL_PORT=587`, `MAIL_USERNAME`, and `MAIL_PASSWORD`.

---

### Invitation link returns 404

**Symptom:** Clicking an invitation link returns `{"error": "Not found"}`.

**Fix (already applied in this codebase):** The API gateway was proxying `/invitations/accept/<token>` directly to the auth-service, but the auth-service mounts the companies blueprint at `/companies`, so the actual route is `/companies/invitations/accept/<token>`. The gateway now correctly rewrites the path. If you see this issue, make sure you are running the latest version of `services/api-gateway/app/routes/auth.py`.

---

### Frontend shows a blank counter page instead of the app

**Symptom:** Navigating to http://localhost:5173 shows a Vite scaffold with a counter button.

**Fix (already applied):** `src/App.tsx` contained the default Vite demo template. `main.tsx` uses `RouterProvider` directly — `App.tsx` is never imported. The file has been replaced with a no-op stub.

---

### Production deployment checklist

Before going to production, change these values in `.env`:

- [ ] `POSTGRES_PASSWORD` — strong random password
- [ ] `MONGO_INITDB_ROOT_PASSWORD` — strong random password
- [ ] `JWT_SECRET_KEY` — 64+ char random hex string
- [ ] `FERNET_KEY` — valid Fernet key (44 chars)
- [ ] `CORS_ORIGINS` — your actual frontend domain
- [ ] `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USE_TLS`, `MAIL_USERNAME`, `MAIL_PASSWORD` — real SMTP credentials
- [ ] `FRONTEND_URL` — your production frontend URL (used in email links)
- [ ] Remove port exposures for internal services (postgres, mongo, redis) from `docker-compose.yml`
- [ ] Put the API gateway and frontend behind a TLS-terminating reverse proxy (nginx, Caddy, etc.)
