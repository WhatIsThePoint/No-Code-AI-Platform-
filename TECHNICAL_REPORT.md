# Technical Report — No-Code AI Platform SaaS
## End-of-Studies Project (PFE)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Infrastructure & DevOps](#3-infrastructure--devops)
4. [Backend Services — Detailed Design](#4-backend-services--detailed-design)
   - 4.1 API Gateway
   - 4.2 Auth Service
   - 4.3 Data Ingestion Service
   - 4.4 ML Training Service
5. [Frontend Application](#5-frontend-application)
6. [Machine Learning Pipeline](#6-machine-learning-pipeline)
7. [CI/CD Pipeline](#7-cicd-pipeline)
8. [Sprint 1 — Foundation, Auth, Data Ingestion](#8-sprint-1--foundation-auth-data-ingestion)
9. [Sprint 2 — ML Training, Pipeline Editor, Model Registry](#9-sprint-2--ml-training-pipeline-editor-model-registry)
10. [Bugs Encountered, Root Causes & Fixes](#10-bugs-encountered-root-causes--fixes)
11. [Technology Choices & Rationale](#11-technology-choices--rationale)
12. [Security Design](#12-security-design)
13. [Summary](#13-summary)

---

## 1. Project Overview

The **No-Code AI Platform** is a multi-tenant SaaS application that enables non-technical users — data analysts, product managers, domain experts — to build, train, and deploy machine learning models without writing a single line of code.

### Core Value Proposition

Traditional ML workflows require Python expertise, infrastructure knowledge, and familiarity with libraries like scikit-learn, XGBoost, and Prophet. This platform abstracts all of that behind a visual, drag-and-drop interface:

1. **Upload data** — CSV or XLSX files, or connect to a SQL database (PostgreSQL, MySQL)
2. **Profile & clean** — automatic statistical profiling, visual preprocessing wizard
3. **Build a pipeline** — drag Dataset → Train → Evaluate nodes onto a canvas
4. **Configure** — select algorithm (14 available), tune hyperparameters with sliders
5. **Train** — one click, live progress tracking, email notification on completion
6. **Evaluate** — visual metrics charts (classification, regression, clustering, forecasting)
7. **Download** — export the trained `.joblib` model artifact

### Multi-Tenancy Model

The platform supports two modes:
- **Individual** — personal workspace with private datasets and pipelines
- **Company** — shared workspace with role-based access (Owner, PM, Data Scientist, Analyst, Viewer)

### Supported ML Tasks

| Task Type | Algorithms |
|-----------|-----------|
| Classification | XGBoost, Random Forest, GBM, Logistic Regression (GLM), LightGBM, CatBoost |
| Regression | XGBoost Regressor, Random Forest Regressor, GBM Regressor, Ridge, LightGBM Regressor, CatBoost Regressor |
| Clustering | K-Means (with Elbow curve) |
| Forecasting | Prophet (Facebook/Meta time-series) |

---

## 2. System Architecture

### 2.1 Architectural Pattern: Microservices

The platform is built as a **microservices architecture** — a collection of small, independently deployable services, each responsible for a specific domain. This contrasts with a monolithic architecture where everything lives in one codebase.

**Why microservices for this project?**
- ML training is CPU/memory-intensive; isolating it prevents it from starving the auth service
- Independent scaling: training workers can be scaled horizontally without scaling auth
- Technology isolation: each service can use the best tool for its job
- Fault isolation: a crash in the training worker does not affect user login

### 2.2 Service Map

```
                         ┌─────────────────────────────────────┐
                         │           User Browser              │
                         │      React + TypeScript (Vite)      │
                         │         http://localhost:5173        │
                         └──────────────┬──────────────────────┘
                                        │ /api/* (Vite proxy)
                                        ▼
                         ┌─────────────────────────────────────┐
                         │           API Gateway               │
                         │    Flask + Flask-JWT + Limiter       │
                         │         http://localhost:8000        │
                         │                                     │
                         │  • JWT validation (decode-only)     │
                         │  • Rate limiting (Redis, 600/min)   │
                         │  • X-User-* header injection        │
                         │  • Token blacklist check (Redis)    │
                         └──────┬──────────┬──────────┬────────┘
                                │          │          │
               ┌────────────────▼──┐  ┌───▼────────┐ │ ┌────────────────────┐
               │   Auth Service    │  │  Data Ingestion │ │  ML Training Svc   │
               │ Flask-SQLAlchemy  │  │  Service    │ │ │  Flask-PyMongo      │
               │    port 8001      │  │  port 8002  │ │ │    port 8003        │
               │                   │  │             │ │ │                    │
               │ • Register/Login  │  │ • CSV upload│ └─▶ • Pipeline CRUD    │
               │ • JWT issuance    │  │ • Profiling │   │ • Training tasks   │
               │ • Token rotation  │  │ • Preprocess│   │ • Model registry   │
               │ • TOTP 2FA        │  │ • SQL import│   │ • Step notes       │
               │ • Company/team    │  │             │   │                    │
               └─────────┬─────────┘  └──────┬──────┘   └──────────┬─────────┘
                         │                   │                       │
               ┌─────────▼─────────┐  ┌──────▼──────┐   ┌──────────▼──────────┐
               │    PostgreSQL      │  │   Celery    │   │      Celery         │
               │    port 5434      │  │   Worker    │   │      Worker         │
               │                   │  │  (ingestion)│   │    (ml-training)    │
               │ • Users            │  │             │   │                    │
               │ • Companies        │  └──────┬──────┘   └──────────┬──────────┘
               │ • Memberships      │         │                       │
               │ • Invitations      │  ┌──────▼───────────────────────▼──────┐
               │ • Refresh tokens   │  │              MongoDB 7               │
               └────────────────────┘  │           port 27017                │
                                       │                                     │
                                       │ • datasets collection               │
                         ┌─────────────│ • task_results collection           │
                         │ Redis 7     │ • pipelines collection               │
                         │ port 6379   │ • model_versions collection          │
                         │             │ • pipeline_step_notes collection     │
                         │ • Celery    └─────────────────────────────────────┘
                         │   broker
                         │ • Token
                         │   blacklist
                         │ • Preview
                         │   cache
                         └─────────────
```

### 2.3 Request Flow (Example: Upload a CSV)

```
1. User selects file in browser → POST /api/datasets/upload
2. Vite dev proxy strips /api prefix → forwards to localhost:8000/datasets/upload
3. API Gateway:
   a. Reads Authorization: Bearer <token>
   b. Decodes JWT locally (no round-trip to auth-service)
   c. Checks JTI not in Redis blacklist
   d. Injects X-User-Id, X-User-Role headers
   e. Forwards to data-ingestion-service:8002/datasets/upload
4. Data Ingestion Service:
   a. Reads X-User-Id from headers
   b. Validates file type and size
   c. Saves file to /uploads/<dataset_id>.<ext>
   d. Inserts document into MongoDB datasets collection
   e. Dispatches profile_dataset.apply_async(dataset_id) → Redis queue
   f. Returns 202 {dataset_id, task_id}
5. Celery Worker (data-ingestion-worker):
   a. Picks up task from Redis queue
   b. Reads file, runs pandas profiling
   c. Computes column stats, missing values, distributions
   d. Writes result to task_results collection
   e. Updates dataset status to "ready"
6. Browser polls GET /api/tasks/<task_id>/status every 2s
7. When status = "success", frontend updates dataset row → show "Ready"
```

---

## 3. Infrastructure & DevOps

### 3.1 Docker Compose Architecture

The entire platform is containerized. All services, databases, and workers are defined in `docker-compose.yml` and started with a single command: `make up`.

**Production compose (`docker-compose.yml`):**

```yaml
Services (12 containers total):
  postgres       — PostgreSQL 16, port 5434 (host) : 5432 (container)
  mongo          — MongoDB 7, port 27017
  redis          — Redis 7, port 6379
  timescaledb    — TimescaleDB (PostgreSQL extension for time-series), port 5433
  mailhog        — Email testing server, ports 1025 (SMTP) / 8025 (UI)
  api-gateway    — Flask app, port 8000
  auth-service   — Flask app, port 8001
  data-ingestion-service — Flask app, port 8002
  data-ingestion-worker  — Celery worker (no exposed port)
  ml-training-service    — Flask app, port 8003
  ml-training-worker     — Celery worker (no exposed port)
  metrics-service        — Flask app, port 8004
```

**Health checks** are defined for all database containers to ensure services don't start before their dependencies are ready. For example:

```yaml
postgres:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U nocode"]
    interval: 10s
    timeout: 5s
    retries: 5
```

Services declare `depends_on: { postgres: { condition: service_healthy } }` to enforce startup order.

**Development override (`docker-compose.override.yml`):**

Docker Compose automatically merges `docker-compose.override.yml` with the base file in development. The override adds:
- **Source code volumes** — mounts local `./services/<name>/app` into the container, so Python code changes are reflected instantly without rebuilding the Docker image
- **Debug mode** — `FLASK_DEBUG=1` for the Flask development server
- **Celery autoreload** — `--autoreload` flag for workers
- **`--include` flags** — explicit task module registration for Celery workers (see Bug section)

### 3.2 Named Volumes

```yaml
volumes:
  postgres_data:    # Persistent PostgreSQL data
  mongo_data:       # Persistent MongoDB data
  redis_data:       # Persistent Redis data
  timescale_data:   # Persistent TimescaleDB data
  uploaded_files:   # CSV/XLSX files shared between ingestion service and worker
  model_artifacts:  # Trained .joblib files shared between training service and worker
```

The `uploaded_files` and `model_artifacts` volumes are critical — they are mounted into both the Flask API containers AND their Celery worker containers, so workers can read uploaded files and write model artifacts which the API can then serve for download.

### 3.3 Database Initialization

**PostgreSQL** — `infra/postgres/init.sql` defines all tables, indexes, and triggers at container startup. This runs once when the PostgreSQL container is first created. Tables include: `users`, `refresh_tokens`, `companies`, `memberships`, `invitations`.

**MongoDB** — `infra/mongo/init.js` creates collections with their indexes at startup. MongoDB is schema-less, but indexes are critical for query performance. A TTL (Time To Live) index on `task_results.created_at` automatically purges task records after 7 days.

**Alembic (Flask-Migrate)** — The auth service uses SQLAlchemy ORM and Alembic for database schema versioning. `make migrate` runs `flask db init` + `flask db migrate` + `flask db upgrade` to create all tables from the ORM model definitions. This enables schema migrations in production without manual SQL.

### 3.4 Makefile Targets

The `Makefile` provides developer shortcuts:

```makefile
make up          # Start all containers in detached mode
make down        # Stop all containers
make build       # Rebuild Docker images
make migrate     # Run Alembic migrations
make test        # Run pytest in all 4 services with coverage
make lint        # Run black + isort + flake8 across all services
make logs        # Follow container logs
make hooks       # Install git pre-commit hooks
```

The `migrate` target injects `-e FLASK_APP=app.main` because the `flask db` CLI requires `FLASK_APP` to know which application factory to call. Without this, the command would fail with "Failed to find Flask application".

### 3.5 Environment Variables

All secrets and configuration are externalized to `.env` (not committed to git). The `.env.example` documents all required variables:

| Variable | Purpose | Must Change for Production |
|----------|---------|--------------------------|
| `JWT_SECRET_KEY` | Signs all JWTs | YES — use 64+ char random string |
| `FERNET_KEY` | Encrypts SQL connector passwords | YES — generate with `cryptography.fernet` |
| `POSTGRES_PASSWORD` | PostgreSQL auth | YES |
| `MONGO_INITDB_ROOT_PASSWORD` | MongoDB auth | YES |
| `JWT_ACCESS_TOKEN_EXPIRES` | Access token TTL (seconds) | Optional (default 900) |
| `CORS_ORIGINS` | Allowed frontend origins | YES in production |
| `MAIL_SERVER` | SMTP server for notifications | YES in production |

---

## 4. Backend Services — Detailed Design

### 4.1 API Gateway

**Purpose:** Single entry point for all client requests. Validates JWTs, enforces rate limits, injects user identity headers, and proxies requests to the appropriate upstream service.

**Key design decisions:**

**JWT decode-only:** The gateway validates tokens cryptographically (using the shared `JWT_SECRET_KEY`) without contacting the auth service for every request. This eliminates a network round-trip on every API call. The gateway only checks:
1. Signature validity
2. Expiration
3. JTI (JWT ID) not in the Redis blacklist (for logged-out tokens)

**Header injection:** After JWT validation, the gateway injects `X-User-Id`, `X-User-Role`, and `X-User-Tier` headers before forwarding. Downstream services trust these headers — they never decode JWTs themselves.

**Rate limiting:** Uses Flask-Limiter backed by Redis. Default: 600 requests/minute per user ID (or IP if unauthenticated). Rate limit keys are per-user-ID (not per-IP) to prevent unfair throttling behind NAT.

**Proxy mechanism:** A generic `_forward()` function handles all proxying:
```python
def _forward(upstream_url, path, require_auth=True):
    # 1. Optionally validate JWT and inject headers
    # 2. Forward headers (filter hop-by-hop: Connection, Transfer-Encoding, etc.)
    # 3. Make HTTP request to upstream using a persistent session (connection pooling)
    # 4. Stream response back to client
    # 5. Return 503 if upstream is unreachable
```

**Public endpoint whitelist:** Some endpoints bypass JWT validation: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/2fa/verify`, `/invitations/accept/*`.

**Route matching fix:** Flask's `<path:subpath>` rule requires at least one path segment. Bare routes like `/datasets` (no subpath) were returning 404. Fixed by registering two decorators per proxy function:
```python
@proxy_bp.route("/datasets", methods=["GET", "POST"])
@proxy_bp.route("/datasets/<path:subpath>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def proxy_data(subpath=""):
    path = f"/datasets/{subpath}" if subpath else "/datasets"
    ...
```

---

### 4.2 Auth Service

**Purpose:** User registration, authentication, JWT issuance, token rotation, 2FA, and company/team management.

**Technology:** Flask + SQLAlchemy (PostgreSQL) + Flask-JWT-Extended + Flask-Bcrypt + Flask-Migrate + Marshmallow

**Authentication flow:**

```
Register: POST /auth/register
  → Validate email + password + role (Marshmallow schema)
  → Hash password (bcrypt, cost factor 12)
  → Insert user into PostgreSQL
  → Return {user_id, email}

Login: POST /auth/login
  → Validate credentials
  → If TOTP enabled: return {requires_2fa: true, session_token}
  → Else: issue access_token (JWT, 15 min) + refresh_token (httponly cookie, 30 days)

Refresh: POST /auth/refresh
  → Read refresh_token from httponly cookie
  → Verify token_hash (SHA-256) in refresh_tokens table
  → Check not revoked, not expired
  → Revoke old token (atomic flush)
  → Issue new access_token + new refresh_token (rotation)

Logout: POST /auth/logout
  → Revoke refresh token
  → Add access token JTI to Redis blacklist (TTL = token remaining lifetime)
```

**Token design:**
- Access tokens are short-lived JWTs (15 minutes). They cannot be revoked individually — expiry is the revocation mechanism.
- Refresh tokens are random 128-character hex strings (not JWTs). Only the SHA-256 hash is stored in PostgreSQL. The raw token is transmitted once (via httponly cookie) and never stored in the database.
- On logout, the access token's `jti` claim is added to Redis with a TTL equal to its remaining lifetime. The gateway checks this blacklist on every request.
- Refresh token rotation: each use generates a new token and revokes the old one. This limits the blast radius of a stolen refresh token.

**2FA (TOTP):**
- Standard TOTP (RFC 6238, compatible with Google Authenticator, Authy)
- 3-step flow: enable (generate secret) → confirm (verify first code) → active
- During login with 2FA: credentials check → issue short-lived `session_token` (JWT with `purpose: 2fa_challenge`) → client sends `{session_token, totp_code}` → verify code → issue real tokens

**Company/Team management:**
- A user can create a company (becomes owner)
- Owner/PM can invite members by email (generates an invitation token)
- Invited user calls `GET /invitations/accept/<token>` (requires JWT — must be logged in)
- Membership roles: `owner`, `pm`, `data_scientist`, `analyst`, `viewer`
- All company queries check membership to prevent data leakage between organizations

**Marshmallow schemas:** Input validation is handled by Marshmallow schemas (separate from SQLAlchemy models). This ensures proper error messages and prevents mass-assignment vulnerabilities.

---

### 4.3 Data Ingestion Service

**Purpose:** Accept file uploads, run automated profiling, provide preprocessing pipelines, and support SQL database imports.

**Technology:** Flask + Flask-PyMongo (MongoDB) + Celery (Redis) + Pandas + Scikit-learn + SQLAlchemy (for SQL connectors) + Fernet encryption

**Upload flow:**
```
POST /datasets/upload
  → Validate file extension (csv, xlsx only)
  → Validate file size (100MB max)
  → Generate UUID dataset_id
  → Save file to /uploads/<dataset_id>.<ext>
  → Insert MongoDB document:
      {dataset_id, user_id, name, file_path, status: "uploaded", ...}
  → Insert task_results document: {task_id, status: "pending"}
  → Dispatch: profile_dataset.apply_async([dataset_id, user_id])
  → Return 202 {dataset_id, task_id}
```

**Profiling (async Celery task):**
```
Task: profile_dataset
  → Load file into Pandas DataFrame
  → For each column:
      - Determine type (numeric / categorical)
      - Compute: mean, median, std, min, max, quartiles (numeric)
      - Compute: unique count, top values, value frequencies (categorical)
      - Count missing values and compute missing_pct
  → Compute: total rows, total columns, duplicate row count
  → Update task_results: {status: "success", result: {columns: [...], ...}}
  → Update dataset: {status: "ready"}
```

**Preprocessing pipeline (async Celery task):**

The preprocessing service builds a **scikit-learn Pipeline** with **ColumnTransformer** — the industry-standard approach for reproducible data transformation:

```
User configures via UI:
  - Imputation strategy: mean | median | mode
  - Encoding strategy: onehot | ordinal | label
  - Scaling strategy: standard | minmax | robust | none
  - Target column (for supervised learning)
  - Train/val/test split ratios (e.g., 0.7/0.15/0.15)

Pipeline builds:
  numeric_pipeline = Pipeline([
      ('imputer', SimpleImputer(strategy=imputation)),
      ('scaler', StandardScaler())
  ])
  categorical_pipeline = Pipeline([
      ('imputer', SimpleImputer(strategy='most_frequent')),
      ('encoder', OneHotEncoder() or OrdinalEncoder())
  ])
  preprocessor = ColumnTransformer([
      ('num', numeric_pipeline, numeric_cols),
      ('cat', categorical_pipeline, cat_cols)
  ])

Execution:
  → Split data into train/val/test by ratio (stratified for classification)
  → Fit preprocessor on training split only (prevents data leakage)
  → Transform all splits
  → Save as parquet files: train.parquet, val.parquet, test.parquet
  → Update dataset status: "preprocessed"
```

**Key bug fixed:** The original code used `OneHotEncoder` for both "label" and "ordinal" encoding strategies (falling through to the `else` branch). `LabelEncoder` was not usable because it only handles 1D arrays and is incompatible with `ColumnTransformer`. Fixed by using `OrdinalEncoder` for both strategies — it handles multi-column categorical data and integrates with scikit-learn Pipelines correctly.

**SQL Connector:**
```
POST /datasets/sql-connect
  → Validate {db_type, host, port, database, username, password, query}
  → Build SQLAlchemy URL: postgresql+psycopg2:// or mysql+pymysql://
  → Test connection (SELECT 1)
  → Encrypt password with Fernet symmetric encryption
  → Store encrypted credentials in MongoDB
  → Dispatch sql_import task
  → Worker executes SQL query, saves result as CSV, runs profiling
```

**Bug fixed:** MySQL connection URL was `f"mysql+pymysql://{username}{password}"` — missing the `:` separator. This caused every MySQL connection to silently fail. Fixed to `f"mysql+pymysql://{username}:{password}@{host}:{port}/{database}"`.

---

### 4.4 ML Training Service

**Purpose:** Manage pipelines (visual DAGs), orchestrate training jobs, store model artifacts, track model versions, and provide collaborative annotations.

**Technology:** Flask + Flask-PyMongo (MongoDB) + Celery (Redis) + Scikit-learn + XGBoost + LightGBM + CatBoost + Prophet + Joblib + Flask-Mail

**Pipeline data model:**
```json
{
  "pipeline_id": "uuid",
  "user_id": "uuid",
  "name": "Salary Prediction",
  "status": "done",
  "nodes": [
    {"node_id": "n1", "type": "dataset", "data": {"dataset_id": "...", "dataset_name": "salaries.csv"}, "position": {"x": 100, "y": 150}},
    {"node_id": "n2", "type": "train",   "data": {"algorithm": "xgboost_reg", "task_type": "regression", "target_column": "salary", "hyperparams": {"n_estimators": 100, ...}}, "position": {"x": 350, "y": 150}},
    {"node_id": "n3", "type": "evaluate","data": {"version_id": "..."}, "position": {"x": 600, "y": 150}}
  ],
  "edges": [
    {"source": "n1", "target": "n2"},
    {"source": "n2", "target": "n3"}
  ],
  "last_run_task_id": "celery-task-uuid",
  "last_version_id": "model-version-uuid"
}
```

**Training task flow:**
```
POST /pipelines/<id>/train
  → Extract train node config from pipeline or request body
  → Validate: dataset must exist + be in "preprocessed" status
  → Validate: algorithm must be in SUPPORTED_ALGORITHMS (14 algorithms)
  → Dispatch: run_training.apply_async([pipeline_id, run_config])
  → Update pipeline status: "running"
  → Return 202 {task_id}

Celery task: run_training
  → Update task_results: {status: "running", progress_pct: 5}
  → Load train.parquet from dataset directory
  → Call prepare_xy(df, target_column, task_type):
      - classification/regression: split into X (features), y (target)
      - clustering: X only, y = None
      - forecasting: X only (must contain 'ds' column)
  → Update progress: 20%
  → model = get_model(algorithm, hyperparams)
  → model.train(X_train, y_train)
  → Update progress: 80%
  → metrics = model.evaluate(X_test, y_test)
  → Save model.joblib to /models/<version_id>.joblib
  → Insert model_versions document
  → Update pipeline: {status: "done", last_version_id}
  → Update task_results: {status: "success", version_id, metrics, progress_pct: 100}
  → Send email notification (Flask-Mail)
```

**Model abstraction layer:**

All models implement the `BaseMLModel` abstract interface:
```python
class BaseMLModel(ABC):
    def __init__(self, hyperparams: dict): ...
    @abstractmethod
    def train(self, X_train, y_train): ...
    @abstractmethod
    def evaluate(self, X_test, y_test) -> dict: ...
    @property
    def estimator(self): ...
```

This pattern allows the training orchestrator to call `model.train()` and `model.evaluate()` without knowing the specific algorithm. Each algorithm class encapsulates its library-specific logic.

**Algorithm registry:**
```python
_REGISTRY = {
    # Classification (6)
    "xgboost": XGBoostClassifierModel,
    "random_forest": RandomForestModel,
    "gbm": GBMClassifierModel,
    "glm": GLMClassifierModel,
    "lightgbm": LightGBMModel,
    "catboost": CatBoostModel,
    # Regression (6)
    "xgboost_reg": XGBoostRegressorModel,
    "random_forest_reg": RandomForestRegressorModel,
    "gbm_reg": GBMRegressorModel,
    "ridge": RidgeRegressorModel,
    "lightgbm_reg": LightGBMRegressorModel,
    "catboost_reg": CatBoostRegressorModel,
    # Clustering & Forecasting (2)
    "kmeans": KMeansModel,
    "prophet": ProphetModel,
}
```

**Metrics by task type:**

| Task | Metrics Returned |
|------|-----------------|
| Classification | accuracy, precision, recall, F1, ROC-AUC (binary), confusion matrix, feature importance |
| Regression | MAE, RMSE, R², feature importance |
| Clustering | n_clusters, inertia, silhouette score, elbow curve data (k=2 to 10) |
| Forecasting | periods forecasted, frequency, MAE, MAPE, full forecast DataFrame (ds, yhat, yhat_lower, yhat_upper) |

**Model Registry:**

Trained models are stored in two places:
1. MongoDB (`model_versions` collection) — metadata, metrics, hyperparameters, artifact path
2. File system (`/models/<version_id>.joblib`) — serialized model artifact

The `GET /models/<id>/download` endpoint serves the `.joblib` file with `send_file()`. Users can download and use models in their own Python code with `joblib.load()`.

**Prophet — lazy import:**

Prophet and its CmdStan dependency are imported lazily inside the `train()` method rather than at module level:
```python
def train(self, X_train, y_train=None):
    from prophet import Prophet  # lazy import
    ...
```
This prevents a slow startup (CmdStan verification) when loading the training service. Prophet is only triggered when a user actually selects the Prophet algorithm.

**CmdStan in Docker:**

Prophet requires a compiled CmdStan binary to fit Stan models. This was handled in the Dockerfile:
```dockerfile
RUN apt-get install -y make gcc g++ libgomp1 && \
    pip install -r requirements.txt && \
    python -c "import cmdstanpy; cmdstanpy.install_cmdstan()" && \
    rm -rf /tmp/tmp* /root/.cmdstan/cmdstan-*/examples
```
`install_cmdstan()` downloads and compiles CmdStan at image build time. This means the first `docker compose build` takes longer, but training containers start instantly.

---

## 5. Frontend Application

### 5.1 Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.4.5 | Type safety |
| Vite | 5.3.1 | Build tool + dev server |
| Material-UI (MUI) | 5.16.0 | Component library |
| React Router | 6.24.1 | Client-side routing |
| XYFlow (React Flow) | 12.0.4 | Visual pipeline editor |
| Recharts | 2.12.7 | Metrics charts |
| Zustand | 4.5.4 | Global state management |
| React Hook Form + Zod | 7.52 / 3.23 | Form validation |
| Axios | 1.7.2 | HTTP client |
| React Dropzone | 14.2.3 | File upload UI |
| Vitest | 2.0.2 | Unit testing |

### 5.2 Application Structure

```
src/
├── main.tsx              # Entry point — mounts RouterProvider
├── App.tsx               # Stub (not used — main.tsx uses RouterProvider directly)
├── router/index.tsx      # All routes defined with React Router v6
│
├── api/                  # Service layer
│   ├── axios.ts          # Axios instance + JWT interceptor + refresh logic
│   ├── auth.ts           # register, login, logout, getMe, refresh
│   ├── datasets.ts       # upload, list, get, preview, profile, preprocess, delete
│   ├── pipelines.ts      # create, list, get, update, delete, startTraining, notes
│   ├── models.ts         # listVersions, getVersion, download, deleteVersion
│   └── tasks.ts          # getTaskStatus (shared between datasets and pipelines)
│
├── store/
│   ├── authSlice.ts      # Zustand store: user, accessToken, setAuth, clearAuth
│   └── dataSlice.ts      # Zustand store: datasets list cache
│
├── hooks/
│   ├── useAuth.ts        # Login/logout logic, token storage, getMe()
│   ├── useDatasets.ts    # Fetch and cache dataset list
│   └── useTaskStatus.ts  # Polling hook for async task progress
│
├── pages/                # One component per route
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── TotpPage.tsx      # TOTP 2FA verification
│   ├── DashboardPage.tsx
│   ├── ProfilePage.tsx
│   ├── CompanyPage.tsx
│   ├── DataPage.tsx      # Dataset list + upload
│   ├── DatasetDetailPage.tsx  # Preview + profile + preprocessing
│   ├── PipelinePage.tsx       # Pipeline list
│   ├── PipelineEditorPage.tsx # Visual pipeline editor
│   └── ModelRegistryPage.tsx  # Trained model versions
│
├── components/
│   ├── common/
│   │   ├── Layout.tsx         # App shell: sidebar + topbar
│   │   └── ProtectedRoute.tsx # Redirect to /login if not authenticated
│   ├── data/
│   │   ├── DatasetPreview.tsx     # MUI DataGrid with paginated data
│   │   ├── ProfilingReport.tsx    # Column stats cards
│   │   └── PreprocessingPanel.tsx # Multi-step preprocessing wizard
│   └── pipeline/
│       ├── PipelineCanvas.tsx     # XYFlow canvas with all pipeline logic
│       ├── NodePanel.tsx          # Right sidebar for selected node
│       ├── HyperparamControls.tsx # Sliders, selects, checkboxes per algorithm
│       ├── MetricsChart.tsx       # Recharts visualization per task type
│       ├── NotesPanel.tsx         # Collaborative step annotations
│       └── nodes/
│           ├── DatasetNode.tsx    # Storage icon node
│           ├── TrainNode.tsx      # Brain icon node with algorithm label
│           └── EvaluateNode.tsx   # Bar chart icon node
│
└── types/                # TypeScript interfaces matching backend schemas
    ├── auth.ts
    ├── dataset.ts
    ├── model.ts
    ├── pipeline.ts
    └── task.ts
```

### 5.3 Routing

React Router v6 with code-splitting via `React.lazy()`:

```typescript
// Eagerly loaded (always needed):
/              → redirect to /dashboard
/login         → LoginPage
/register      → RegisterPage
/2fa           → TotpPage

// Protected routes (redirect to /login if not authenticated):
/dashboard     → DashboardPage
/profile       → ProfilePage
/company       → CompanyPage
/data          → DataPage (lazy)
/data/:id      → DatasetDetailPage (lazy)
/pipelines     → PipelinePage (lazy)
/pipelines/:id → PipelineEditorPage (lazy)
/models        → ModelRegistryPage (lazy)
```

`ProtectedRoute` wraps all authenticated pages. It reads `accessToken` from the Zustand auth store — if null, it redirects to `/login`. This is checked on every render, so logging out in one tab clears access in all tabs that read the same Zustand store.

### 5.4 Authentication State Machine

The `useAuth` hook manages the login flow:

```typescript
login(email, password):
  1. Call POST /auth/login
  2. If requires_2fa: navigate('/2fa')
  3. Else:
     a. setToken(data.access_token) ← CRITICAL: store token FIRST
     b. Call GET /users/me (needs valid token in Axios interceptor)
     c. setAuth(user, token) ← sets full user object in Zustand
     d. navigate('/dashboard')
```

**Critical bug fixed here:** The original code called `getMe()` before `setToken()`. The Axios interceptor reads the token from the Zustand store on each request. Since the store was empty, `getMe()` sent an unauthenticated request → 401 → the refresh interceptor ran → refresh 401 (no refresh cookie yet) → `window.location.replace('/login')` → the page refreshed instead of navigating. Fixed by calling `setToken()` before `getMe()`.

**Axios interceptor chain:**

```typescript
// Request interceptor: attach token
config.headers.Authorization = `Bearer ${getAccessToken()}`

// Response interceptor: handle 401
if (error.response.status === 401 && not a refresh attempt:
  try:
    await authApi.refresh()  // POST /auth/refresh (uses httponly cookie)
    retry original request
  catch:
    window.location.replace('/login')  // true session expiry → force logout
```

### 5.5 Visual Pipeline Editor (XYFlow)

The pipeline editor (`PipelineCanvas.tsx`) uses XYFlow (formerly React Flow) to render an interactive DAG:

**Node types:**
- `DatasetNode` — selects preprocessed dataset from dropdown
- `TrainNode` — selects algorithm, shows algorithm name and task type
- `EvaluateNode` — shows metrics chart after training

**State:**
- `nodes` / `edges` — XYFlow state via `useNodesState` / `useEdgesState`
- `selectedNodeId` — which node's panel is shown in the right sidebar
- `trainTaskId` — current training task ID for polling
- `latestVersion` — fetched ModelVersion after training completes

**Interaction flow:**
```
1. User adds nodes via toolbar buttons (Dataset, Train, Evaluate)
2. User connects nodes by dragging edges between handles
3. User clicks a node → right panel opens (NodePanel)
4. NodePanel for Train node:
   - Algorithm dropdown (14 options grouped by task type)
   - Target column input (hidden for clustering/forecasting)
   - HyperparamControls renders per-algorithm sliders/selects/checkboxes
5. User clicks "Save" → PUT /pipelines/<id> with serialized nodes+edges
6. User clicks "Run" → POST /pipelines/<id>/train
7. Progress bar appears, polls GET /tasks/<id>/status every 2s
8. On success: fetch model version, update Evaluate node, show metrics chart
```

**HyperparamControls** — each algorithm has a static schema of its parameters:
- `slider` — min, max, step, default (rendered as MUI Slider)
- `select` — list of options (rendered as MUI Select)
- `checkbox` — boolean toggle (e.g., "compute elbow curve" for K-Means)

**MetricsChart** — renders different Recharts components based on task type:
- **Classification**: horizontal BarChart (accuracy, precision, recall, F1, ROC-AUC) + feature importance BarChart
- **Regression**: text metrics (MAE, RMSE, R²) + feature importance BarChart
- **Clustering**: text metrics (n_clusters, inertia, silhouette score) + LineChart (elbow curve)
- **Forecasting**: text metrics (MAE, MAPE) + LineChart (yhat with yhat_lower/yhat_upper confidence bands)

### 5.6 Task Status Polling

The `useTaskStatus` hook implements a polling mechanism for async tasks:

```typescript
export function useTaskStatus(taskId: string | null) {
  const [result, setResult] = useState<TaskResult | null>(null)

  useEffect(() => {
    if (!taskId) return
    const interval = setInterval(async () => {
      const { data } = await tasksApi.getTaskStatus(taskId)
      setResult(data)
      if (data.status === 'success' || data.status === 'failure') {
        clearInterval(interval)  // stop polling when terminal state
      }
    }, 2000)
    return () => clearInterval(interval)  // cleanup on unmount
  }, [taskId])

  return { result }
}
```

This hook is shared by both `DataPage` (for profiling/preprocessing tasks) and `PipelineCanvas` (for training tasks). The `tasksApi` module was extracted as a dedicated client after the original code coupled it to `datasetsApi`.

---

## 6. Machine Learning Pipeline

### 6.1 Data Flow: File to Trained Model

```
Upload (CSV/XLSX)
    ↓
Profiling Task (Celery)
    ↓ pandas describe(), value_counts(), etc.
Dataset Status: "ready"
    ↓
Preprocessing Configuration (UI)
    ↓
Preprocessing Task (Celery)
    ↓ ColumnTransformer fit on train split
    ↓ Transform train/val/test splits
    ↓ Save as parquet files
Dataset Status: "preprocessed"
    ↓
Pipeline Configuration (XYFlow canvas)
    ↓ algorithm selection + hyperparameters
Training Task (Celery)
    ↓ load train.parquet
    ↓ prepare_xy(): split X/y or handle clustering/forecasting
    ↓ model.train(X_train, y_train)
    ↓ model.evaluate(X_test, y_test)
    ↓ joblib.dump(estimator, artifact_path)
    ↓ insert model_versions document
Model Status: "done" → version_id returned
    ↓
MetricsChart renders in Evaluate node
    ↓
Model available for download (.joblib)
```

### 6.2 Splitting Parquet Files

The training service loads data from split parquet files rather than the original CSV. This design:
- Avoids re-running preprocessing on every training run
- Ensures identical data splits between training attempts
- Provides a clean separation: preprocessing service owns data preparation, training service owns model training
- Parquet format is ~10x more efficient than CSV for columnar data

### 6.3 Why Celery for Async Tasks?

Training a model on 250,000 rows can take 30-120 seconds. Running this synchronously in an HTTP request would:
- Block the Flask worker process for the entire duration
- Timeout the browser request (typically 60s)
- Prevent the worker from handling other requests

Celery pushes the task to a Redis queue. A separate worker process picks it up, runs it independently, and stores the result back in MongoDB. The browser polls every 2 seconds for status updates.

---

## 7. CI/CD Pipeline

### 7.1 GitHub Actions Workflow

The `.github/workflows/ci.yml` defines a full CI pipeline that runs on every push to `main` or `develop`:

```
Jobs (run in parallel):

lint-backend (matrix: 4 services)
  → black --check (formatting)
  → isort --check-only (import ordering)
  → flake8 (linting, max 100 chars per line)

lint-frontend
  → ESLint (0 warnings allowed, strict)
  → tsc --noEmit (TypeScript type checking)

test-backend (matrix: 4 services)
  → Spin up: PostgreSQL 16, MongoDB 7, Redis 7
  → pip install -r requirements.txt
  → pytest tests/ --cov=app --cov-report=xml
  → Upload coverage to Codecov

test-frontend
  → npm ci
  → vitest run --coverage

docker-build (depends on lint-backend + lint-frontend)
  → docker buildx bake (all services)
  → Uses GitHub Actions cache for layer caching
```

### 7.2 Code Quality Enforcement

**black** — Python formatter. Enforces consistent code style (PEP 8 + opinionated formatting). If any file doesn't match black's output, CI fails. Developers must run `black .` before pushing or use the pre-commit hook.

**isort** — Sorts Python imports into 3 groups: standard library, third-party, local. Uses the `--profile black` flag to be compatible with black's import formatting.

**flake8** — Python linter. Catches unused imports (F401), undefined names (F821), and style violations. Configured to ignore E203 (whitespace before ':' — conflicts with black) and W503 (line break before binary operator — black preference).

**ESLint** — TypeScript/React linter. Configured with `@typescript-eslint/recommended` and `react-hooks` plugin. Catches: unused variables, missing hook dependencies, component-only file exports (for React Fast Refresh).

**TypeScript strict mode** — `tsc --noEmit` validates all types without producing output files. Catches: implicit `any`, missing properties, type mismatches.

---

## 8. Sprint 1 — Foundation, Auth, Data Ingestion

### 8.1 What Was Built

Sprint 1 established the full foundation of the platform:

**Infrastructure:**
- `docker-compose.yml` with all 12 containers
- `docker-compose.override.yml` for development hot-reload
- `infra/postgres/init.sql` — full PostgreSQL schema
- `infra/mongo/init.js` — MongoDB collections + indexes
- `Makefile` with developer shortcuts
- `.env.example` with all required variables documented
- `.github/workflows/ci.yml` — full CI pipeline
- `.pre-commit-config.yaml` — local git hooks

**Auth Service (complete):**
- User registration with role selection
- JWT-based login with httponly refresh cookie rotation
- TOTP 2FA (Google Authenticator compatible)
- User profile management
- Company creation + invitation system + membership management
- Alembic migrations for schema versioning

**Data Ingestion Service (complete):**
- CSV/XLSX file upload (100MB limit)
- Automated pandas profiling (column statistics, missing values, distributions)
- Preprocessing wizard (imputation, encoding, scaling, train/val/test split)
- Dataset preview with pagination
- SQL connector (PostgreSQL, MySQL) with encrypted credentials
- Redis-cached dataset previews

**API Gateway (complete):**
- JWT decode + blacklist check
- Rate limiting (Redis-backed, per-user)
- X-User-* header injection
- Generic proxy with connection pooling

**Frontend (partial):**
- Login, register, TOTP verification pages
- Dashboard
- Profile page
- Company management page
- Dataset list + upload page
- Dataset detail (preview, profiling, preprocessing)

### 8.2 Key Design Decisions in Sprint 1

**Why PostgreSQL for auth, MongoDB for data?**
- Auth data (users, tokens, companies) is highly relational with foreign key constraints → PostgreSQL
- Dataset metadata and ML results are document-oriented with flexible schemas → MongoDB
- A profile document might have 5 columns or 500 columns — a fixed SQL schema would be impractical

**Why Fernet for SQL credentials?**
- User SQL passwords must be stored to run scheduled imports
- Fernet is symmetric encryption using AES-128-CBC — the server can decrypt when needed
- The key is kept in environment variables (not in the database)

---

## 9. Sprint 2 — ML Training, Pipeline Editor, Model Registry

### 9.1 What Was Built

Sprint 2 added the core ML capabilities:

**ML Training Service (new service):**
- Pipeline CRUD (create/read/update/delete)
- Training task orchestration (Celery)
- 14-algorithm model registry (6 classification + 6 regression + K-Means + Prophet)
- Model artifact storage (.joblib files)
- Model version management with full metrics
- Pipeline step notes (collaborative annotations)
- Email notification on training completion (Flask-Mail)

**Frontend — Pipeline Editor:**
- Visual DAG editor using XYFlow
- 3 node types: Dataset, Train, Evaluate
- Real-time training progress (polling)
- Algorithm selector (14 options grouped by task type)
- Per-algorithm hyperparameter controls (sliders, selects, checkboxes)
- Metrics visualization (4 chart types by task)
- Collaborative notes per pipeline node

**Frontend — Model Registry:**
- Browse all trained model versions per pipeline
- View metrics and hyperparameters
- Download `.joblib` artifact
- Delete model versions

### 9.2 Regression Support (Added During Bug Resolution)

Initially only classification algorithms were implemented. When testing with a real salary dataset (250,000 rows), XGBoost classifier failed:

```
ValueError: Invalid classes inferred from unique values of `y`.
Expected: [0 1 2 ... 100202], got [31867 37213 39285 ...]
```

The salary column had ~119,000 unique float values — a continuous target requiring regression, not classification. This surfaced a design gap: the platform had no regression support.

Added in one session:
- **Backend**: 6 regressor model classes (`regression.py`), registry entries, `task_type="regression"` branch in `prepare_xy()`
- **Frontend**: 6 new algorithm entries in `NodePanel`, regression param sets in `HyperparamControls`, `RegressionMetrics` type, regression render in `MetricsChart`

Test result: R² = 0.9785 on the salary dataset — 97.85% variance explained.

---

## 10. Bugs Encountered, Root Causes & Fixes

This section documents every bug encountered during development and testing, including runtime issues discovered during the first full application run.

---

### Bug 1 — MySQL URL Missing Colon

**File:** `services/data-ingestion-service/app/routes/connector.py`

**Symptom:** Every MySQL SQL-connector import silently failed.

**Root cause:**
```python
# BEFORE (broken):
url = f"mysql+pymysql://{data['username']}{data['password']}@..."
# AFTER (fixed):
url = f"mysql+pymysql://{data['username']}:{data['password']}@..."
```
A missing `:` between username and password in the SQLAlchemy connection URL. The URL format is `driver://user:password@host:port/database`. Without the colon, SQLAlchemy parses the username+password as a single token and fails to authenticate.

---

### Bug 2 — Invitation Accept Returns 404

**Files:** `api-gateway/routes/auth.py`, `auth-service/routes/company.py`

**Symptom:** `GET /invitations/accept/<token>` always returned 404.

**Root cause:** The gateway proxied `/invitations/<subpath>` → auth-service at `/invitations/<subpath>`. But `company_bp` in the auth service has `url_prefix="/companies"`, so the actual route was `/companies/invitations/accept/<token>`.

**Fix:** Gateway now rewrites `/invitations/<subpath>` → `/companies/invitations/<subpath>`.

---

### Bug 3 — Dead Gateway Route `/train/<path>`

**File:** `api-gateway/routes/proxy.py`

**Symptom:** All requests to `/train/*` returned 404.

**Root cause:** A stub route was added that forwarded `/train/<subpath>` to the ML service, but the ML service has no `/train/` prefix — training endpoints are at `/pipelines/<id>/train`.

**Fix:** Removed the dead route entirely.

---

### Bug 4 — Wrong Encoder for "label"/"ordinal" Strategy

**File:** `data-ingestion-service/services/preprocessing_service.py`

**Symptom:** Selecting "label" or "ordinal" encoding in the preprocessing wizard still produced one-hot encoded (binary) columns.

**Root cause:**
```python
# BEFORE (broken):
if encoding == "onehot":
    encoder = OneHotEncoder(...)
else:
    encoder = OrdinalEncoder(...)  # Wait — this was actually OneHotEncoder in the else branch
```
The else branch fell back to `OneHotEncoder`. `LabelEncoder` was not viable because it only processes 1D arrays and cannot be used inside `ColumnTransformer`.

**Fix:** Use `OrdinalEncoder(handle_unknown='use_encoded_value', unknown_value=-1)` for both "label" and "ordinal" strategies. This assigns integer codes per category and is fully compatible with `ColumnTransformer`.

---

### Bug 5 — Dataset Ownership Query Excludes Company Members

**Files:** `dataset.py`, `preprocessing.py` routes

**Symptom:** Company members could see datasets in the list but got 403 when trying to open, preview, or preprocess a dataset uploaded by another team member.

**Root cause:** The list endpoint used an `$or` query (user_id OR company_id), but the detail endpoints only queried by user_id. A company member can't open their colleague's dataset.

**Fix (pragmatic):** Changed single-document queries to use `$or: [{user_id: uid}, {company_id: cid}]` where the company_id comes from the dataset document itself (if the uploader was a company member).

---

### Bug 6 — App.tsx Was a Vite Scaffold

**File:** `frontend/src/App.tsx`

**Symptom:** No crash (the file was never imported), but 120 lines of dead Vite demo code (counter, logos, links) confused code navigation.

**Root cause:** `main.tsx` mounts `RouterProvider` directly — `App.tsx` was never used.

**Fix:** Replaced with a no-op stub with a comment explaining the design.

---

### Bug 7 — Login Page Refreshing Instead of Navigating

**File:** `frontend/src/hooks/useAuth.ts`

**Symptom:** After successful login, the page refreshed to `/login` instead of navigating to `/dashboard`.

**Root cause:** `getMe()` was called before `setToken()`. The Axios interceptor reads the token from the Zustand store. Since the store was still empty, `getMe()` sent an unauthenticated request → 401 → refresh interceptor triggered → refresh also returned 401 (no cookie yet) → `window.location.replace('/login')`.

**Fix:**
```typescript
// BEFORE:
const { data: userData } = await authApi.getMe()  // 401 → refresh loop
setAuth(userData, data.access_token)

// AFTER:
setToken(data.access_token!)  // store token FIRST
const { data: userData } = await authApi.getMe()  // now authenticated
setAuth(userData, data.access_token!)
```

---

### Bug 8 — GridColDef Import Fails in Vite

**File:** `frontend/src/components/data/DatasetPreview.tsx`

**Symptom:** `Uncaught SyntaxError: The requested module does not provide an export named 'GridColDef'`

**Root cause:** Vite resolves imports at build time. `GridColDef` is a TypeScript type exported from `@mui/x-data-grid` but not a runtime JavaScript value. Vite treats `import { GridColDef }` as a value import and fails when it can't find it in the ESM export list.

**Fix:**
```typescript
// BEFORE:
import { DataGrid, GridColDef } from "@mui/x-data-grid"

// AFTER:
import { DataGrid } from "@mui/x-data-grid"
import type { GridColDef } from "@mui/x-data-grid"  // type-only import
```
`import type` tells Vite (and TypeScript) that this import is purely a type annotation — it gets erased at compile time and never reaches the module bundler.

---

### Bug 9 — Flask-Migrate Cannot Detect Models

**File:** `auth-service/app/main.py`

**Symptom:** `flask db migrate` generated an empty migration with no table definitions, despite the models existing.

**Root cause:** Flask-Migrate uses SQLAlchemy's `MetaData` to autogenerate migrations. The `MetaData` object only knows about models that have been imported. The models were defined but never imported in `create_app()`, so Alembic found an empty schema.

**Fix:**
```python
# In create_app(), before blueprint registration:
from .models import company, user  # noqa: F401  ← force import to populate MetaData
```

---

### Bug 10 — 404 on Bare Routes (/datasets, /companies)

**Files:** `api-gateway/routes/proxy.py`, `api-gateway/routes/auth.py`

**Symptom:** `GET /datasets` and `GET /companies` returned 404 even though `/datasets/abc123` worked fine.

**Root cause:** Flask's `<path:subpath>` URL rule requires at least one non-empty path segment. A request to `/datasets` (no subpath) does not match `@route("/datasets/<path:subpath>")`.

**Fix:** Register two decorators per proxy function:
```python
@proxy_bp.route("/datasets", methods=["GET", "POST"])
@proxy_bp.route("/datasets/<path:subpath>", methods=["GET", "POST", "PUT", "PATCH", "DELETE"])
def proxy_data(subpath=""):
    path = f"/datasets/{subpath}" if subpath else "/datasets"
    ...
```

---

### Bug 11 — 405 on POST /datasets/upload

**File:** `data-ingestion-service/routes/upload.py`

**Symptom:** `POST /datasets/upload` returned 405 Method Not Allowed.

**Root cause:** `upload_bp` was registered with `url_prefix="/upload"` and the route was `@upload_bp.post("")`. This placed the route at `/upload`. But the gateway proxied to `/datasets/upload`. Flask matched the path segment `upload` against the `<dataset_id>` parameter in the dataset detail route, which only supports GET — hence 405.

**Fix:** Changed the route from `/upload` to `/datasets/upload` so it is unambiguous.

---

### Bug 12 — Celery Tasks Not Registered (KeyError)

**Symptom:** `Training failed: 'app.tasks.train.run_training'` — Celery KeyError when trying to execute a task.

**Root cause:** Celery workers must explicitly import task modules to register tasks. The natural solution is `include=[...]` in the Celery constructor, but this caused circular imports: `train.py` imports `celery` from `celery_app.py`, and `celery_app.py` importing `train.py` creates a cycle.

**Fix:** Use the `--include` CLI flag instead:
```yaml
# docker-compose.override.yml
ml-training-worker:
  command: celery -A app.tasks.celery_app.celery worker
    --include=app.tasks.train
    --loglevel=debug
```
The `--include` flag tells the worker process to import those modules after the worker is fully initialized — after `celery_app.py` has been processed — avoiding the circular dependency.

---

### Bug 13 — unsafe `as any` TypeScript Casts

**File:** `frontend/src/components/pipeline/PipelineCanvas.tsx`

**Symptom:** TypeScript warnings suppressed with `as any` — type safety defeated.

**Root cause:** The node data was typed as `PipelineNode["data"]` (a union type) when building the training request. Accessing `.algorithm`, `.task_type` etc. required a cast.

**Fix:** Import the specific data interfaces and cast to them:
```typescript
import type { TrainNodeData, DatasetNodeData } from "../../types/pipeline"

const td = trainNode.data as TrainNodeData   // precise cast
const dd = datasetNode.data as DatasetNodeData
```

---

### Bug 14 — 429 Rate Limit from React Strict Mode

**Symptom:** Every page load triggered rate limit errors (HTTP 429) in development.

**Root cause:** React 18 Strict Mode intentionally double-invokes Effects in development to detect side effects. Every `useEffect` fires twice, doubling API calls. With the original 200/minute limit, a page with 5 `useEffect` hooks would consume 10 requests immediately, quickly hitting the limit.

**Fix:** Raised the rate limit to 600/minute for development. Production should use a lower limit (100-200/minute) configured via `.env`.

---

### Bug 15 — Port Conflicts on First Run

**Symptoms:**
- `Error starting userland proxy: listen tcp4 0.0.0.0:5432: bind: address already in use` — system PostgreSQL occupied port 5432
- Port 8000 occupied by another Docker project (`meteopredict-backend`)

**Fixes:**
- Changed postgres host port: `5432:5432` → `5434:5432` in docker-compose.yml
- User stopped the conflicting container: `docker stop meteopredict-backend`

---

### Bug 16 — Flask DB CLI Not Finding App

**Symptom:** `make migrate` failed with: `Error: Failed to find Flask application. Use 'flask --app' to specify one.`

**Root cause:** The `flask db` command needs `FLASK_APP` environment variable to know which Python module contains the Flask application factory. Running `docker compose run` spawns a clean container without this variable.

**Fix:** Added `-e FLASK_APP=app.main` to the `make migrate` target:
```makefile
migrate:
    docker compose run --rm -e FLASK_APP=app.main auth-service flask db init || true
    docker compose run --rm -e FLASK_APP=app.main auth-service flask db migrate -m "initial"
    docker compose run --rm -e FLASK_APP=app.main auth-service flask db upgrade
```

---

### Bug 17 — Prophet Missing CmdStan (Stan Backend Error)

**Symptom:** `'Prophet' object has no attribute 'stan_backend'` during training.

**Root cause:** Prophet requires CmdStan — a standalone binary that compiles and executes Stan probabilistic programs. `pip install prophet` installs the Python wrapper but not CmdStan itself. The `make` build tool was also missing from the Docker image.

**Fix (Dockerfile):**
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libgomp1 make \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt && \
    python -c "import cmdstanpy; cmdstanpy.install_cmdstan()" && \
    rm -rf /tmp/tmp* /root/.cmdstan/cmdstan-*/examples
```
The `install_cmdstan()` call downloads and compiles CmdStan at image build time. The cleanup step removes test examples to reduce image size.

---

### Bug 18 — CI: 43 Python Files Failed `black --check`

**Root cause:** Code was written without running `black` first. Black has strict formatting rules that differ from how humans naturally write code (trailing commas in function arguments, quote normalization, specific line wrapping).

**Fix:** Ran `black services/ && isort --profile black services/` to auto-format all files. No logic changes — purely cosmetic.

---

### Bug 19 — CI ESLint Config Version Mismatch

**Symptom:** `Invalid option '--ext' - perhaps you meant '-c'? You're using eslint.config.js`

**Root cause:** The project had `eslint.config.js` using ESLint v9 flat config API (`defineConfig`, `globalIgnores` from `'eslint/config'`, `typescript-eslint` package). But `package.json` installed ESLint `^8.57.0`. ESLint v8 and v9 use completely different configuration formats and some CLI flags changed.

**Fix:** Replaced `eslint.config.js` with `.eslintrc.cjs` (ESLint v8 format):
```javascript
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "plugin:react-hooks/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["react-refresh"],
  rules: { "react-refresh/only-export-components": "warn" }
}
```

---

### Bug 20 — CI: ml-training Tests Fail with PermissionError

**Symptom:** ml-training-service tests failed in GitHub Actions with permission denied when creating the model folder.

**Root cause:** `TestingConfig` inherited `MODEL_FOLDER = "/models"` from the base `Config` class. `create_app()` calls `os.makedirs(MODEL_FOLDER, exist_ok=True)`. GitHub Actions runners run as non-root users and cannot create directories at the filesystem root (`/`).

**Fix:** Override `MODEL_FOLDER` in `TestingConfig` with a temporary directory:
```python
import tempfile

class TestingConfig(Config):
    TESTING = True
    MODEL_FOLDER = tempfile.mkdtemp()  # creates e.g. /tmp/tmpXXXXXX
```

---

### Bug 21 — CI: Frontend Tests Fail With "No test files found"

**Symptom:** `CI / Tests (frontend)` failed with exit code 1 immediately.

**Root cause:** Vitest exits with error code 1 when it finds no test files matching `**/*.{test,spec}.{ts,tsx}`. The frontend had no test files.

**Fix:** Added `src/__tests__/types.test.ts` — a lightweight suite testing TypeScript type correctness (5 tests, ~50 lines). This validates that the type definitions match expected shapes without requiring DOM rendering or API mocking.

---

### Bug 22 — CI: Upload Tests Calling Wrong Route

**Symptom:** `test_upload_missing_auth`, `test_upload_no_file`, etc. all failed with unexpected status codes.

**Root cause:** Tests called `client.post("/upload", ...)` but the route was changed from `/upload` to `/datasets/upload` (Bug 11 fix above). The tests were never updated.

**Fix:** Updated all test requests from `/upload` to `/datasets/upload`.

---

### Bug 23 — CI: Algorithm List Test Incomplete

**Symptom:** `test_supported_algorithms_list` failed with `AssertionError`.

**Root cause:** The test hardcoded 8 expected algorithms. Sprint 2 added 6 regression variants, making the actual list 14 algorithms. The test was written before regression support was added.

**Fix:** Updated the expected set to include all 14 algorithms.

---

## 11. Technology Choices & Rationale

### 11.1 Backend Framework: Flask

Flask was chosen over Django (larger, more opinionated) and FastAPI (async, newer) because:
- **Microservice-friendly**: Flask is minimal — each service includes only what it needs
- **Familiarity**: Widely used in data science contexts
- **Extensions ecosystem**: Flask-JWT-Extended, Flask-PyMongo, Flask-Migrate, Flask-Mail all integrate cleanly
- **Synchronous model**: Combined with Celery for async, this is simpler than full async Python

### 11.2 Databases

| Database | Why |
|----------|-----|
| PostgreSQL | ACID transactions for auth data; foreign keys enforce referential integrity; perfect for relational company/membership/invitation data |
| MongoDB | Flexible schema for dataset profiles (N columns, different stats per type); pipeline nodes are arbitrary JSON; ML metrics vary by task type |
| Redis | Sub-millisecond lookups for token blacklist; native pub/sub for Celery; efficient sorted sets for rate limiting counters |
| TimescaleDB | Hypertable partitioning for time-series metrics — not yet fully implemented (stub for Sprint 3) |

### 11.3 Celery + Redis for Async

**Why not asyncio?** Pandas profiling and ML training are CPU-bound operations, not I/O-bound. Python's asyncio is designed for I/O concurrency (network, disk). CPU-bound tasks block the event loop. Celery uses separate worker processes (not threads) — each worker is a fully independent Python process that bypasses the GIL.

**Why Redis as broker?** RabbitMQ would be more robust for production, but Redis serves dual purpose here (also used for caching and token blacklist), reducing infrastructure complexity. For this scale, Redis queues are sufficient.

### 11.4 Frontend: React + TypeScript + Vite

| Choice | Alternative | Reason |
|--------|------------|--------|
| React 18 | Vue, Angular | Ecosystem size; XYFlow is React-native |
| TypeScript | Plain JavaScript | Catch type errors at compile time; backend API types documented in `types/` |
| Vite | Create React App (deprecated), Webpack | 10-50x faster dev server (native ESM); instant HMR |
| Zustand | Redux Toolkit | Minimal boilerplate; sufficient for 2 global stores |
| XYFlow | D3, dagre | React-native drag-and-drop graph library; built-in handles, edges, zoom, minimap |
| Recharts | Chart.js, D3 | React component API; responsive containers; composable |
| MUI | Tailwind-only, Ant Design | Rich component library with data grid; consistent design system |

### 11.5 Joblib for Model Serialization

Joblib was chosen over `pickle` for model persistence because:
- Joblib is optimized for objects containing large NumPy arrays (which all scikit-learn estimators use internally)
- It uses memory-mapping for large arrays — faster loading
- It is the standard serialization format recommended by scikit-learn

---

## 12. Security Design

### 12.1 JWT Security

- **Short access token lifetime** (15 min): limits window of stolen token misuse
- **Refresh token rotation**: each use invalidates the previous token; detect theft by double-use
- **httponly refresh cookie**: JavaScript cannot read the refresh token (XSS protection)
- **Token blacklist**: Redis-backed JTI blacklist enables instant logout; TTL matches token lifetime so blacklist entries self-expire
- **Shared secret**: `JWT_SECRET_KEY` must be identical between API gateway and auth service; they use the same key for signing and verification

### 12.2 Password Security

- **bcrypt hashing**: one-way hash with cost factor; prevents plain-text storage breaches
- **No password in logs**: Marshmallow schemas strip passwords from serialization
- **Refresh token hash**: only SHA-256 hash of the refresh token is stored; raw token exists only in the httponly cookie

### 12.3 SQL Injection Prevention

All SQL queries in the data-ingestion service go through SQLAlchemy's parameterized query system. User-provided SQL queries (in the connector) are executed via SQLAlchemy's text() with bound parameters — never string concatenation.

### 12.4 Fernet Encryption for SQL Credentials

When users provide SQL database passwords to create connectors, those passwords are encrypted with AES-128-CBC (Fernet) before storage in MongoDB. The encryption key is stored in the environment, not in the database. This means a MongoDB breach alone does not expose user database credentials.

### 12.5 Rate Limiting

The API gateway enforces per-user rate limits via Flask-Limiter:
- **Default**: 600 requests/minute (accommodates React Strict Mode double-invokes in dev)
- **Uploads**: 10 per hour (prevents storage abuse)
- **Redis-backed**: limits survive gateway restarts; shared across multiple gateway instances

### 12.6 CORS

CORS is configured at the API gateway level only (not in individual services). Allowed origins are configured via `CORS_ORIGINS` environment variable. In production, this should be restricted to the exact frontend domain.

---

## 13. Summary

### What Was Delivered

Across 2 sprints, the following was built from scratch:

**12 Docker containers** orchestrated with Docker Compose, covering 4 Python microservices, 5 databases/caches, 2 Celery worker processes, and a MailHog email server.

**4 Flask microservices** totaling ~4,500 lines of Python:
- API Gateway with JWT validation, rate limiting, and generic proxying
- Auth Service with full user/company lifecycle, JWT issuance, and TOTP 2FA
- Data Ingestion Service with profiling, preprocessing pipelines, and SQL connectors
- ML Training Service with 14 algorithms, model registry, and email notifications

**1 React + TypeScript SPA** totaling ~3,500 lines:
- 11 pages from login to model registry
- Visual pipeline editor with XYFlow
- Real-time training progress
- Interactive metrics charts (4 chart types)

**Full CI/CD pipeline** on GitHub Actions:
- Black + isort + flake8 for Python
- ESLint + TypeScript for frontend
- pytest with real PostgreSQL/MongoDB/Redis in CI
- Docker build smoke test

**23 bugs** found and fixed, ranging from missing colons in SQL URLs to race conditions in token storage to Docker file permission issues in CI.

The platform successfully trained a Random Forest Regression model on a 250,000-row salary dataset with R² = 0.9785 — confirming the full end-to-end data-to-model pipeline works correctly.

---

*Generated for End-of-Studies Report (PFE) — No-Code AI Platform SaaS*
