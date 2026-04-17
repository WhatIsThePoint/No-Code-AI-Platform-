# No-Code AI Platform — Complete Guide (Sprints 1-3)

## Table of Contents

1. [Environment Variables Reference](#1-environment-variables-reference)
2. [First-Time Setup](#2-first-time-setup)
3. [Architecture Overview](#3-architecture-overview)
4. [App Feature Walkthrough](#4-app-feature-walkthrough)
5. [Subscription Tiers & Feature Limits](#5-subscription-tiers--feature-limits)
6. [API Reference](#6-api-reference)
7. [Common Issues & Fixes](#7-common-issues--fixes)
8. [Production Deployment Checklist](#8-production-deployment-checklist)

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

### Stripe Billing (Sprint 3)

| Variable | Default | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | _(empty)_ | Get from [Stripe Dashboard](https://dashboard.stripe.com/apikeys). Test-mode keys start with `sk_test_`. **Leave empty for local dev** — billing degrades gracefully to 503. |
| `STRIPE_PUBLISHABLE_KEY` | _(empty)_ | Starts with `pk_test_`. Not used server-side; reserved for future frontend Stripe.js integration. |
| `STRIPE_WEBHOOK_SECRET` | _(empty)_ | Get after running: `stripe listen --forward-to localhost:8001/billing/webhook`. Starts with `whsec_`. |
| `STRIPE_PRICE_SOLO_MONTHLY` | _(empty)_ | Stripe Price ID for Solo Monthly plan (Products > Prices). |
| `STRIPE_PRICE_SOLO_YEARLY` | _(empty)_ | Stripe Price ID for Solo Yearly plan. |
| `STRIPE_PRICE_COMPANY_MONTHLY` | _(empty)_ | Stripe Price ID for Company Monthly plan. |
| `STRIPE_PRICE_COMPANY_YEARLY` | _(empty)_ | Stripe Price ID for Company Yearly plan. |

> **Without Stripe configured:** The app runs fully. The billing page displays plans but clicking "Subscribe" shows a user-friendly "Stripe is not configured" message. All tier limits default to `free`. To unlock paid features in dev, use the super admin panel to manually override a user's tier.

### API Gateway

| Variable | Default | Notes |
|---|---|---|
| `AUTH_SERVICE_URL` | `http://auth-service:8001` | Internal Docker hostname — leave as-is |
| `DATA_SERVICE_URL` | `http://data-ingestion-service:8002` | Internal Docker hostname — leave as-is |
| `ML_SERVICE_URL` | `http://ml-training-service:8003` | Internal Docker hostname — leave as-is |
| `METRICS_SERVICE_URL` | `http://metrics-service:8004` | Internal Docker hostname — leave as-is |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins. **[MUST CHANGE]** for prod. |
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

# 4. Build all images (takes 5-10 min on first run — Prophet/CatBoost are large)
make build

# 5. Start all services in the background
make up

# 6. Wait for databases to be ready (~10 seconds), then run Alembic migrations
#    This creates all auth tables including Sprint 3 tables:
#    users, refresh_tokens, companies, memberships, invitations,
#    subscriptions, audit_logs, announcements
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

### Running tests

```bash
# Run all backend tests (auth, gateway, data-ingestion, ml-training)
make test

# Lint all services (black + isort + flake8)
make lint
```

---

## 3. Architecture Overview

```
Browser (localhost:5173)
    |
    |  All /api/* requests proxied by Vite dev server
    v
API Gateway  :8000
    |  Decodes JWT, injects X-User-Id / X-User-Role / X-User-Tier headers
    |  Rate limits via Redis
    |
    +---> Auth Service        :8001  -- PostgreSQL (users, companies, invitations,
    |                                    TOTP, subscriptions, audit_logs, announcements)
    |
    +---> Data Ingestion      :8002  --+
    |        |                         +-- MongoDB (datasets, task_results)
    |        +---> Ingestion Worker    |   Redis (Celery queue: ingestion, connectors)
    |             (Celery)  ----------+
    |
    +---> ML Training         :8003  --+
    |        |                         +-- MongoDB (pipelines, model_versions,
    |        +---> Training Worker     |     pipeline_step_notes, task_results)
    |             (Celery)  ----------+   Redis (Celery queue: training)
    |                                     Volume: /models (joblib artifacts)
    |
    +---> Metrics Service     :8004  -- TimescaleDB (time-series metrics)

Supporting infrastructure:
    PostgreSQL  :5434   (auth tables via Alembic migrations)
    MongoDB     :27017  (all document data)
    Redis       :6379   (rate limiting, Celery broker + result backend, preview cache)
    TimescaleDB :5433   (metrics time series)
    MailHog     :1025 (SMTP) / :8025 (web UI)  -- dev email server
```

### JWT & Header Flow

1. `POST /auth/login` -> auth-service returns `access_token` + sets `refresh_token` cookie.
2. Frontend stores `access_token` in Zustand store (in-memory, not localStorage).
3. Every API request sends `Authorization: Bearer <token>`.
4. API gateway decodes the JWT (same `JWT_SECRET_KEY`), extracts claims, and adds headers:
   - `X-User-Id` — user UUID
   - `X-User-Role` — `data_scientist`, `admin`, or `super_admin`
   - `X-User-Tier` — `free`, `solo`, or `company` (from JWT claims, updated via Stripe)
5. Upstream services read these headers for authorization and tier-limit checks.
6. When the access token expires (15 min), the frontend automatically calls `POST /auth/refresh` using the httpOnly cookie to get a new access token.

### Database Schema

**PostgreSQL (auth-service) — 8 tables via Alembic:**
- `users` — id, email, password_hash, full_name, role, tier, totp_secret, totp_enabled, is_active
- `refresh_tokens` — id, user_id FK, token_hash, expires_at, revoked
- `companies` — id, name, slug (unique), owner_id FK
- `memberships` — id, company_id FK, user_id FK, role, status
- `invitations` — id, company_id FK, email, role, token (unique), expires_at, accepted
- `subscriptions` — id, user_id FK (unique), stripe_customer_id, stripe_subscription_id, plan, status, trial_end, current_period_end
- `audit_logs` — id, actor_id FK (nullable), action, target_type, target_id, detail (JSON), ip_address
- `announcements` — id, created_by FK, title, body, is_active

**MongoDB (nocode_ingestion) — 5 collections:**
- `datasets` — dataset_id, user_id, company_id, name, source_type, file_path, status, profiling_summary, row_count
- `task_results` — task_id, dataset_id/pipeline_id, task_type, status, progress_pct, error_message, version_id, metrics (TTL: 7 days)
- `pipelines` — pipeline_id, user_id, name, nodes[], edges[], status, last_run_task_id, last_version_id
- `model_versions` — version_id, pipeline_id, user_id, algorithm, task_type, hyperparams, metrics, artifact_path, training_duration_s
- `pipeline_step_notes` — note_id, pipeline_id, node_id, user_id, content, created_at

---

## 4. App Feature Walkthrough

### 4.1 Register & Login

1. Navigate to **http://localhost:5173**.
2. Click **Register** — fill in name, email, password (min 8 chars), role.
3. You are redirected to the login page. Enter your credentials.
4. On success you receive a JWT access token (stored in memory) and a refresh token (httpOnly cookie). You are redirected to the **Dashboard**.

### 4.2 Two-Factor Authentication (2FA)

1. Go to **Profile** (sidebar > Profile).
2. Click **Enable 2FA**.
3. Scan the displayed QR code with Google Authenticator, Authy, or any TOTP app.
4. Enter the 6-digit code to confirm setup.
5. On subsequent logins, after entering your password you will be prompted for your TOTP code. The session is valid for 5 minutes while you retrieve the code.

> To disable 2FA: Profile > Security > Disable Two-Factor Authentication.

### 4.3 Profile Management

- Change your name under **Profile > Personal Info**.
- Email is read-only after registration.
- Password changes are managed through the profile security section.

### 4.4 Companies

**Create a company:**
1. Click **Company** in the left sidebar.
2. Click **Create Company** and enter a name.
3. You become the owner of the company.

**Invite a team member:**
1. Open your company > **Members** > **Invite Member**.
2. Enter the user's email and select a role (`admin` or `data_scientist`).
3. The system generates an invitation link. In development the link is shown directly; in production it is sent via email (check MailHog at http://localhost:8025).

**Accept an invitation:**
1. Visit the invitation link (`/invitations/accept/<token>`).
2. If already logged in you are added to the company. Otherwise you are prompted to log in first.

### 4.5 Dashboard (Sprint 3 — enhanced)

The dashboard is the home page after login. It shows:

- **Announcement banners** — active system-wide announcements set by the super admin appear as blue info bars at the top of the page.
- **Stats row** — total datasets, datasets in ready/preprocessed state, total pipelines, and trained pipelines.
- **Datasets tab** — project cards for each dataset with status chip (color-coded), row count, source type, creation date. Actions: open, delete.
- **Pipelines tab** — project cards for each pipeline with status chip, node count, last updated date. Actions: open, duplicate, delete.

Both tabs include quick-action buttons to navigate to the Datasets or Pipelines creation pages.

### 4.6 Datasets

**Upload a CSV or Parquet file:**
1. Navigate to **Datasets** (sidebar) > **Upload File**.
2. Select your file (max depends on tier — free: 10 MB, solo: 100 MB, company: 500 MB).
3. Optionally select a company to make the dataset visible to all company members.
4. Click **Upload**. A background Celery task runs:
   - Validates and stores the raw file.
   - Profiles the dataset (column types, missing values, cardinality, value distributions).
   - Saves a Parquet copy for fast downstream reads.
5. A progress bar appears. When the task reaches 100% the status chip changes to **Ready**.

**Dataset limits by tier:**
| Tier | Max Datasets | Max File Size |
|---|---|---|
| Free | 3 | 10 MB |
| Solo | 20 | 100 MB |
| Company | Unlimited | 500 MB |

**Preview data:**
1. Click on a dataset name to open it.
2. The **Preview** tab shows the first 50 rows in a paginated table (cached in Redis).
3. Column types, null counts, and sample values are shown in the **Profile** tab.

**Data profiling report:**
- The **Profile** tab renders a full statistical summary: min/max/mean/std, top-N values, missing percentage, and a histogram bar per column.

**Preprocessing:**
1. Open a dataset > **Preprocess** tab.
2. Configure each column via a 4-step wizard:
   - **Step 1 — Columns:** Select which columns to include/exclude.
   - **Step 2 — Strategies:**
     - Numeric imputation: mean, median, or most_frequent.
     - Categorical encoding: OneHot, Label (OrdinalEncoder), or Ordinal.
     - Numeric scaling: StandardScaler, MinMaxScaler, RobustScaler, or none.
   - **Step 3 — Split:** Set train/validation/test split percentages (must sum to 100%).
   - **Step 4 — Run:** Execute preprocessing.
3. A Celery task builds an sklearn `ColumnTransformer`, applies it, and saves `train.parquet`, `val.parquet`, and `test.parquet` splits to the volume.
4. When complete, the dataset status changes to **Preprocessed** and the output files are ready for model training.

**Connect a SQL database:**
1. Datasets > **SQL Connect** (requires solo or company tier).
2. Select `postgres` or `mysql`, fill in host/port/database/credentials.
3. Enter a SELECT query. The result is saved as a dataset (same profiling pipeline runs).

**Delete a dataset:**
- Dashboard > dataset card > delete icon, or dataset detail > three-dot menu > **Delete**.

### 4.7 Pipelines

**Create a pipeline:**
1. Navigate to **Pipelines** (sidebar) > click the **+** FAB (bottom-right).
2. Enter a pipeline name. Click **Create**.
3. Click the pipeline card to open the **Pipeline Editor**.

**Pipeline limits by tier:**
| Tier | Max Pipelines | Max Training Runs | Max Models/Pipeline |
|---|---|---|---|
| Free | 2 | 5 | 3 |
| Solo | 10 | 50 | 20 |
| Company | Unlimited | Unlimited | Unlimited |

**Building the pipeline graph:**

The editor is a drag-and-drop canvas (React Flow) with three node types:

| Node | Purpose |
|---|---|
| **Dataset** | Source node — select a preprocessed dataset |
| **Train** | Training node — pick an algorithm and configure hyperparameters |
| **Evaluate** | Output node — shows metrics and download button after training |

1. Click **+ Dataset** in the toolbar — a Dataset node appears. Click it to open the config panel and select a preprocessed dataset from the dropdown.
2. Click **+ Train** — a Train node appears. Connect the Dataset node's output handle to the Train node's input handle by dragging. In the config panel:
   - Select an **Algorithm** (see table below).
   - Set the **Target Column** (for classification/regression).
   - Adjust **Hyperparameters** using the sliders and dropdowns.
3. Click **+ Evaluate** — an Evaluate node appears. Connect Train's output to Evaluate's input.
4. Click **Save** in the toolbar to persist the graph.

**Supported algorithms:**

| Category | Algorithm | Key Hyperparams |
|---|---|---|
| Classification | XGBoost Classifier | n_estimators, max_depth, learning_rate, subsample |
| Classification | Random Forest | n_estimators, max_depth, min_samples_split |
| Classification | Gradient Boosting (GBM) | n_estimators, learning_rate, max_depth |
| Classification | Logistic Regression (GLM) | C (regularization), solver, max_iter |
| Boosting | LightGBM | n_estimators, num_leaves, learning_rate |
| Boosting | CatBoost | iterations, depth, learning_rate |
| Regression | XGBoost Regressor | n_estimators, max_depth, learning_rate |
| Regression | GBM Regressor | n_estimators, learning_rate, max_depth |
| Regression | Random Forest Regressor | n_estimators, max_depth |
| Regression | Ridge Regression | alpha, solver |
| Clustering | K-Means | n_clusters, init method, max_iter, compute_elbow |
| Forecasting | Prophet | changepoint_prior_scale, seasonality_prior_scale, periods |

**Running training:**
1. Click **Run** in the toolbar.
2. A progress bar appears at the top of the canvas (updates every 2 seconds via polling).
3. Training progress stages: data load (10%) -> model fit (25-75%) -> evaluation (90%) -> artifact save (100%).
4. On completion:
   - The Evaluate node shows the `version_id`.
   - The metrics panel opens automatically in the side drawer.
   - You receive an email notification at your registered email (visible in MailHog at http://localhost:8025).
5. On failure: the progress bar turns red with an error message, and a failure email is sent.

**Step notes:**
- Click any node > **Notes** tab in the side drawer.
- Add a note (markdown supported). Notes are saved per pipeline node and visible to all pipeline collaborators.
- Edit or delete your own notes inline.

### 4.8 Model Registry

1. Navigate to **Model Registry** in the sidebar.
2. Models are grouped by pipeline in tabs.
3. Each version shows: algorithm, training date, dataset used, all evaluation metrics, and a metrics chart.
4. Click **Download** to download the `.joblib` artifact — a complete sklearn/XGBoost/LightGBM/CatBoost pipeline object loadable with `joblib.load("model.joblib")` in Python.
5. Click **Delete** to remove a specific version (artifact + MongoDB document).

### 4.9 Results Page (Sprint 3)

After training, navigate to a specific model version's results:

1. From the Model Registry, click a model version card.
2. Or from the pipeline editor's Evaluate node, follow the version link.
3. Route: `/models/:versionId/results`

The Results page displays:
- **Model info card** — version ID, algorithm, task type, training duration, creation date.
- **Hyperparameters card** — all hyperparameters used for this training run.
- **Metrics charts** — rendered by task type (see Metrics section below).
- **Confusion matrix** (classification only) — color-coded table, diagonal = green (correct), off-diagonal with non-zero = red (misclassified).
- **ROC-AUC score** (classification only) — large percentage display.
- **Action buttons** — Download Model (.joblib), Compare Models (navigates to comparison page).

### 4.10 Model Comparison (Sprint 3)

Compare 2-10 model versions side-by-side:

1. Navigate to `/pipelines/:pipelineId/compare` (linked from Results page or Model Registry).
2. A table lists all model versions for this pipeline with checkboxes.
3. Select 2 or more versions and click **Compare N Models**.
4. The comparison view shows:
   - **Metrics table** — each row is a model, each column is a metric. The best value per metric is marked with a star icon. For error metrics (RMSE, MAE, MSE, inertia) lower is better; for all others higher is better.
   - **Bar chart** — overlaid Recharts bar chart comparing all selected models across all metric keys.

> **Tier restriction:** Model comparison requires a Solo or Company plan. Free-tier users see an upgrade prompt.

### 4.11 Batch Predictions (Sprint 3)

Upload a CSV and get predictions back:

1. Use `POST /models/<version_id>/predict` via the API (frontend integration planned for Sprint 4).
2. Upload a CSV file as multipart form data.
3. The server:
   - Loads the `.joblib` model artifact.
   - Runs inference based on task type:
     - **Classification** — adds `predicted_class` column.
     - **Regression** — adds `prediction` column.
     - **Clustering** — adds `cluster` column.
     - **Forecasting** — adds `yhat` (and `yhat_lower`/`yhat_upper` if available) columns. Requires a `ds` column in the input.
   - Returns the augmented CSV as a file download.

> **Tier restriction:** Batch predictions require a Solo or Company plan (HTTP 402 for free tier).

### 4.12 Metrics & Evaluation

The **Evaluate** node side panel and the Results page render charts based on the task type:

**Classification metrics:**
- Accuracy, Precision, Recall, F1 (macro-averaged) shown as a bar chart.
- ROC-AUC score.
- Confusion matrix (raw values, color-coded).
- Feature importance bar chart (where applicable).

**Regression metrics:**
- MAE, RMSE, R-squared displayed as text values.
- Feature importance bar chart.

**Clustering metrics:**
- n_clusters, inertia, silhouette score.
- Elbow curve (inertia vs. k, only when `compute_elbow=true`).

**Forecasting metrics:**
- MSE, MAE.
- Forecast data line chart (historical actuals + predicted future values).

### 4.13 Billing & Subscriptions (Sprint 3)

Navigate to **Billing** in the sidebar.

**Plan overview:**
Five subscription plans are available:

| Plan | Tier | Price | Billing |
|---|---|---|---|
| Free | free | $0 | — |
| Solo Monthly | solo | $29 | /month |
| Solo Yearly | solo | $290 | /year (save 17%) |
| Company Monthly | company | $99 | /month |
| Company Yearly | company | $990 | /year (save 17%) |

**Subscribing:**
1. Click **Subscribe** on a plan card.
2. You are redirected to a Stripe Checkout session (14-day free trial included).
3. After completing payment, you return to `/billing?success=1` and your tier is upgraded immediately.
4. The JWT `tier` claim is updated, and all tier-restricted features unlock.

**Managing your subscription:**
- Click **Manage Subscription** to open the Stripe Customer Portal (update payment method, cancel, switch plans).

**Current plan display:**
- Shows your current plan name, subscription status (active/trialing/past_due/canceled), trial end date, and renewal date.

**Without Stripe configured (dev mode):**
- The plans are displayed normally.
- Clicking "Subscribe" shows: "Stripe is not configured in this environment. This is a demo."
- Use the Super Admin panel to manually set a user's tier for testing.

### 4.14 Super Admin Panel (Sprint 3)

Navigate to **Admin Panel** (only visible in sidebar for users with `role = super_admin`).

> To make yourself a super admin in dev, update your user directly in PostgreSQL:
> ```bash
> docker compose exec postgres psql -U nocode -d nocode_auth \
>   -c "UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';"
> ```

**Overview tab:**
- Stats cards: Total Users, Active Users, Suspended Users, Total Companies, Paid Subscriptions.

**Users tab:**
- Search by email or name.
- For each user: email, name, role, tier, active/suspended status.
- Actions: Suspend (blocks login), Reactivate, Delete.

**Companies tab:**
- List of all companies with name, slug, creation date.
- Action: Delete company.

**Audit Logs tab:**
- Chronological log of all admin actions (user suspend/delete, company delete, subscription override, announcement create).
- Shows: timestamp, action type, target, IP address.

**Announcements tab:**
- Create system-wide announcements (title + body) that appear as banners on every user's dashboard.
- Toggle announcements active/hidden with a single click.
- Delete announcements.

**Subscription override (via API):**
```bash
# Manually set a user to solo tier (bypasses Stripe)
curl -X PATCH http://localhost:8000/api/admin/subscriptions/<user_id> \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"plan": "solo_monthly", "status": "active"}'
```

---

## 5. Subscription Tiers & Feature Limits

Every API request carries the user's tier via the `X-User-Tier` header (extracted from JWT claims by the API gateway). Backend services check tier limits before processing. When a limit is exceeded, the API returns **HTTP 402 Payment Required** with:

```json
{
  "error": "limit_exceeded" | "feature_not_available",
  "upgrade_required": true,
  "tier": "free",
  ...
}
```

### Data Ingestion Limits

| Feature | Free | Solo | Company |
|---|---|---|---|
| Max datasets | 3 | 20 | Unlimited |
| Max file size | 10 MB | 100 MB | 500 MB |
| Preprocessing | Yes | Yes | Yes |
| SQL Connector | No | Yes | Yes |

### ML Training Limits

| Feature | Free | Solo | Company |
|---|---|---|---|
| Max pipelines | 2 | 10 | Unlimited |
| Max training runs | 5 | 50 | Unlimited |
| Max models per pipeline | 3 | 20 | Unlimited |
| Batch predictions | No | Yes | Yes |
| Model comparison | No | Yes | Yes |

### Tier Upgrade Flow

1. User clicks "Subscribe" on Billing page -> Stripe Checkout (14-day trial).
2. Stripe sends `checkout.session.completed` webhook -> auth-service updates the `subscriptions` table and sets `user.tier` to the corresponding tier.
3. The next JWT issued includes the new tier claim.
4. If a subscription is canceled or payment fails, Stripe sends `customer.subscription.updated/deleted` or `invoice.payment_failed` webhook -> tier is downgraded to `free`.

---

## 6. API Reference

### Auth Service (proxied via `/api/auth/*`, `/api/users/*`, `/api/companies/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Register a new user |
| POST | `/auth/login` | No | Login (returns JWT) |
| POST | `/auth/refresh` | Cookie | Refresh access token |
| POST | `/auth/logout` | Yes | Revoke refresh token |
| POST | `/auth/2fa/enable` | Yes | Start 2FA setup (returns QR) |
| POST | `/auth/2fa/confirm` | Yes | Confirm 2FA setup with TOTP code |
| POST | `/auth/2fa/verify` | No | Verify TOTP code during login |
| DELETE | `/auth/2fa/disable` | Yes | Disable 2FA |
| GET | `/users/me` | Yes | Get current user profile |
| PATCH | `/users/me` | Yes | Update profile (name, role) |
| POST | `/companies` | Yes | Create a company |
| GET | `/companies/:id` | Yes | Get company details |
| GET | `/companies/:id/members` | Yes | List company members |
| POST | `/companies/:id/invite` | Yes | Invite a member |
| DELETE | `/companies/:id/members/:uid` | Yes | Remove a member |
| GET | `/invitations/accept/:token` | No | Accept an invitation |

### Billing (proxied via `/api/billing/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/billing/plans` | No | List all subscription plans |
| GET | `/billing/subscription` | Yes | Get current user's subscription |
| POST | `/billing/checkout` | Yes | Create Stripe checkout session |
| POST | `/billing/portal` | Yes | Create Stripe customer portal session |
| POST | `/billing/webhook` | No* | Stripe webhook receiver (*Stripe-signed) |
| GET | `/announcements` | No | Get active announcements |

### Admin (proxied via `/api/admin/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats` | Admin | Platform statistics |
| GET | `/admin/users` | Admin | List/search users |
| GET | `/admin/users/:id` | Admin | Get user details |
| PATCH | `/admin/users/:id` | Admin | Update user (suspend, change role/tier) |
| DELETE | `/admin/users/:id` | Admin | Delete user |
| GET | `/admin/companies` | Admin | List companies |
| DELETE | `/admin/companies/:id` | Admin | Delete company |
| GET | `/admin/subscriptions` | Admin | List all subscriptions |
| PATCH | `/admin/subscriptions/:uid` | Admin | Override subscription (manual plan set) |
| GET | `/admin/logs` | Admin | List audit logs |
| GET | `/admin/announcements` | Admin | List all announcements |
| POST | `/admin/announcements` | Admin | Create announcement |
| PATCH | `/admin/announcements/:id` | Admin | Update announcement |
| DELETE | `/admin/announcements/:id` | Admin | Delete announcement |

### Data Ingestion (proxied via `/api/datasets/*`, `/api/tasks/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/datasets/upload` | Yes | Upload CSV/Parquet file |
| POST | `/datasets/sql-connect` | Yes | Import from SQL database |
| GET | `/datasets` | Yes | List datasets (paginated) |
| GET | `/datasets/:id` | Yes | Get dataset metadata |
| GET | `/datasets/:id/preview` | Yes | Preview first N rows |
| GET | `/datasets/:id/profile` | Yes | Get profiling summary |
| POST | `/datasets/:id/preprocess` | Yes | Start preprocessing task |
| DELETE | `/datasets/:id` | Yes | Delete dataset |
| GET | `/tasks/:id/status` | Yes | Get task progress |

### ML Training (proxied via `/api/pipelines/*`, `/api/models/*`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/pipelines` | Yes | Create pipeline |
| GET | `/pipelines` | Yes | List pipelines |
| GET | `/pipelines/:id` | Yes | Get pipeline details |
| PUT | `/pipelines/:id` | Yes | Update pipeline (nodes, edges) |
| DELETE | `/pipelines/:id` | Yes | Delete pipeline |
| POST | `/pipelines/:id/train` | Yes | Start training run |
| GET | `/pipelines/:id/models` | Yes | List model versions |
| GET | `/pipelines/:id/nodes/:nid/notes` | Yes | List step notes |
| POST | `/pipelines/:id/nodes/:nid/notes` | Yes | Create step note |
| PATCH | `/pipelines/:id/nodes/:nid/notes/:noteId` | Yes | Update step note |
| DELETE | `/pipelines/:id/nodes/:nid/notes/:noteId` | Yes | Delete step note |
| GET | `/models/:vid` | Yes | Get model version details |
| GET | `/models/:vid/download` | Yes | Download .joblib artifact |
| DELETE | `/models/:vid` | Yes | Delete model version |
| POST | `/models/:vid/predict` | Yes | Batch prediction (CSV in/out) |
| POST | `/models/compare` | Yes | Compare 2-10 model versions |

---

## 7. Common Issues & Fixes

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

**Fix:** This is safe to ignore — Alembic tracks applied migrations in the `alembic_version` table and skips already-applied ones. If you see a real error, check:
```bash
docker compose exec postgres psql -U nocode -d nocode_auth -c "SELECT * FROM alembic_version;"
```

The codebase has two Alembic migrations:
1. `2829b50bc034` — Sprint 1: users, refresh_tokens, companies, memberships, invitations.
2. `3a7f8d9e1b2c` — Sprint 3: subscriptions, audit_logs, announcements.

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

**Fix (already applied in this codebase):** The API gateway rewrites `/invitations/accept/<token>` to `/companies/invitations/accept/<token>` before forwarding to the auth-service, because the companies blueprint is mounted at `/companies`. Make sure you are running the latest version of `services/api-gateway/app/routes/auth.py`.

---

### Billing page shows "Stripe is not configured"

**Symptom:** Clicking "Subscribe" returns a 503 error with "Stripe is not configured".

**Fix:** This is expected in dev mode when `STRIPE_SECRET_KEY` is empty. The app degrades gracefully. To test billing:

1. Install the [Stripe CLI](https://stripe.com/docs/stripe-cli).
2. Get your test-mode API keys from the Stripe Dashboard.
3. Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and the four `STRIPE_PRICE_*` variables in `.env`.
4. Run `stripe listen --forward-to localhost:8001/billing/webhook` to get `STRIPE_WEBHOOK_SECRET`.
5. Restart auth-service: `docker compose restart auth-service`.

**Alternative for dev testing:** Use the admin panel to manually override a user's tier without Stripe.

---

### Free tier user gets 402 on batch predictions or model comparison

**Symptom:** `POST /models/:id/predict` or `POST /models/compare` returns 402 with `feature_not_available`.

**Fix:** These are paid features. Either:
- Subscribe to a Solo or Company plan via the Billing page.
- Ask a super admin to override your subscription via `PATCH /admin/subscriptions/:userId`.

---

### Creating a super admin user

There is no UI for creating the first super admin. Use SQL:
```bash
docker compose exec postgres psql -U nocode -d nocode_auth \
  -c "UPDATE users SET role = 'super_admin' WHERE email = 'your@email.com';"
```
After updating, log out and log back in to get a new JWT with the `super_admin` role claim. The "Admin Panel" link will appear in the sidebar.

---

## 8. Production Deployment Checklist

Before going to production, change these values in `.env`:

- [ ] `POSTGRES_PASSWORD` — strong random password
- [ ] `MONGO_INITDB_ROOT_PASSWORD` — strong random password
- [ ] `JWT_SECRET_KEY` — 64+ char random hex string
- [ ] `FERNET_KEY` — valid Fernet key (44 chars)
- [ ] `CORS_ORIGINS` — your actual frontend domain(s)
- [ ] `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USE_TLS`, `MAIL_USERNAME`, `MAIL_PASSWORD` — real SMTP credentials
- [ ] `FRONTEND_URL` — your production frontend URL (used in email links and Stripe redirects)
- [ ] `STRIPE_SECRET_KEY` — live Stripe secret key (starts with `sk_live_`)
- [ ] `STRIPE_PUBLISHABLE_KEY` — live Stripe publishable key (starts with `pk_live_`)
- [ ] `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret for production endpoint
- [ ] `STRIPE_PRICE_*` — Stripe Price IDs for your production plans
- [ ] Remove port exposures for internal services (postgres, mongo, redis) from `docker-compose.yml`
- [ ] Put the API gateway and frontend behind a TLS-terminating reverse proxy (nginx, Caddy, etc.)
- [ ] Run `make migrate` to apply all Alembic migrations
- [ ] Create a super admin user via SQL and verify the admin panel loads
