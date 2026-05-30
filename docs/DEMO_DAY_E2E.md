# Demo Day — End-to-End Showcase Script

A step-by-step demo runbook covering every module of the platform, with
explicit MailHog inbox checkpoints for OTP / verification / invitation
emails. Built for a 25–35 minute live demo on the GTX 1660 Super box.

## 0. URLs you keep open in tabs

| Tab | URL | Why |
|---|---|---|
| App | http://localhost:5173 | The demo surface |
| MailHog | http://localhost:8025 | OTP, password-reset, invite mails |
| API health | http://localhost:8000/health | Quick "everything is up" check |
| Ollama | http://localhost:11434/api/tags | Confirms Llama 3.2 is loaded |
| MongoExpress (optional) | http://localhost:8081 | Live pipeline/dataset doc inspector |

## 1. Pre-flight (T-15 min before the jury arrives)

```bash
# 1. Clean slate — wipes auth tables, re-seeds the 12 demo users.
make down && make up
# wait until `docker compose ps` shows every service "Up (healthy)"
make migrate
make seed

# 2. Pre-pull the LLM so it doesn't stream-download on stage.
docker compose exec ollama ollama list | grep -q llama3.2:3b \
  || docker compose exec ollama ollama pull llama3.2:3b

# 3. Pre-build the demo image dataset (for the DL module).
python3 scripts/seed_demo_image_dataset.py /tmp/demo_images.zip

# 4. Pre-empty MailHog so the inbox shown to the jury is "clean".
curl -X DELETE http://localhost:8025/api/v1/messages

# 5. Smoke-check the DL service before the jury walks in.
curl -fsS http://localhost:8000/health | jq
curl -fsS http://localhost:8005/health | jq
```

Demo credentials (all password: `Demo1234!`):

| Email | Tier | Role | Use for |
|---|---|---|---|
| `admin@nocode-ai.io` | super-admin | platform admin | Module 9 (Admin Console) |
| `alice@acme-ml.com` | company | ACME owner | Modules 1–7 (main flow) |
| `bob@acme-ml.com` | company | data scientist | Module 8 (collaboration, second window) |
| `carol@acme-ml.com` | company | analyst | Module 8 (read-only role demo) |
| `dave@solo-dev.io` | solo | individual | Tier-cap demo (Module 7c) |
| `eve@free-mail.io` | free | individual | Free-tier cap demo (Module 7c) |

---

## Module 1 — Authentication, 2FA, Password Reset (MailHog)

Showcase: gateway-only JWT, OTP via MailHog, password reset round-trip.

### 1a. Plain login

1. **App tab** → `http://localhost:5173` → **Sign In**.
2. Email `alice@acme-ml.com`, password `Demo1234!` → Sign in.
3. DevTools → Application → Session Storage → confirm `auth-storage` holds the access token. Mention out loud: *"Access token lives in sessionStorage with a 15-minute TTL, refresh cookie is HttpOnly."*
4. Sign out.

### 1b. Enable TOTP — pull the seed code from MailHog

1. Sign back in as `alice` → avatar menu → **Security** → **Enable 2FA**.
2. Modal shows a QR + a `setup_email_sent` toast.
3. **Switch to the MailHog tab** (`http://localhost:8025`):
   - The newest mail is `Your No-Code AI 2FA setup code`.
   - Click it. The body contains the **base-32 TOTP secret** plus a one-time verification code.
4. Paste the code into the modal → **Verify**. Banner: *"Two-factor authentication enabled."*
5. Log out, log back in — the second step now asks for a 6-digit code.
   For the demo, generate it with:
   ```bash
   docker compose exec auth-service python -c \
     "import pyotp; print(pyotp.TOTP('<SECRET_FROM_MAILHOG>').now())"
   ```
6. Mention: *"TOTP is optional per-user, but super-admins can force it per-tier from the admin panel."*

### 1c. Password reset (full MailHog round-trip)

1. Sign out. On the login page → **Forgot password?**
2. Type `bob@acme-ml.com` → Submit. Toast: *"If that email exists, we sent a reset link."* (the form never confirms the email exists — anti-enumeration).
3. **MailHog tab** → newest message `Reset your No-Code AI password`.
4. Click the link in the body — it carries you to `/reset-password?token=…`.
5. Enter `NewDemo1234!` twice → Submit.
6. Log in as Bob with the new password — works. Mention: *"Refresh-token JTI for Bob is now in the Redis blacklist; the old token can't be replayed."*
7. Reset Bob back to `Demo1234!` the same way (or skip — Bob isn't needed again until Module 8).

### 1d. Email-verification flow (optional, if a fresh sign-up is in scope)

1. **Sign Up** → `demo.guest@example.com` / `Demo1234!`.
2. Toast: *"Check your inbox to verify."*
3. MailHog → newest mail `Verify your No-Code AI email`. Click the verification link.
4. Account is now active; you're auto-logged in.

---

## Module 2 — Billing & Tier Upgrade (Stripe Checkout)

Showcase: Stripe Checkout in test mode + per-tier quota uplift.

> Requires `STRIPE_*` env vars set in `.env` (test keys). If unset, the
> **Manage Plan** button surfaces a stub message — skip this module and
> say *"Stripe is wired but the demo box runs without keys."*

1. Sign in as **Dave (solo)**.
2. Avatar → **Manage Plan** → tier comparison page.
3. Click **Upgrade to Company → Monthly**.
4. Lands on Stripe Checkout (test mode). Card `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
5. Stripe redirects back → toast: *"Subscription active."*
6. DevTools → Network → `GET /api/users/me` → `tier: "company"`, `limits.max_chunks` and `limits.max_vram_mb` jump.
7. Mention: *"The webhook hits `/api/billing/webhook`; quota uplift is reflected on the next JWT refresh, which the frontend triggers automatically on tier change."*

### Stripe Customer Portal (cancellation)

1. **Manage Plan** → **Manage in Stripe**.
2. Stripe Customer Portal opens → **Cancel plan** → confirm.
3. Back in the app, `tier` returns to `solo` after the webhook fires.

---

## Module 3 — Data Ingestion (CSV + SQL Connector + Encrypted Credentials)

Showcase: shared-volume upload, async Celery profiling, Fernet-encrypted DB creds.

### 3a. CSV upload + asynchronous profile

1. Sign in as **Alice**.
2. **Datasets** → **Upload CSV / Excel** → pick `infra/sample-data/titanic.csv`.
3. Watch the status pill: `uploading` → `extracting` → `profiling` → `ready`.
4. Open the dataset → **Overview** shows row/column counts; **Schema** lists inferred dtypes.
5. **Profiling** tab — open it and mention the headline points:
   - Skewness alert (any column with skew > 1.0).
   - Imbalance alert once you set Target = `Survived`.
   - Per-column box+violin plots, outlier badges.
   - Correlation heatmap.
6. Mention: *"Profile is a Celery task; the upload itself returns in <100 ms. The CSV lives on the `uploaded_files` named volume mounted into both the API and the worker — no streaming protocol needed."*

### 3b. SQL connector with Fernet-encrypted credentials

1. **Datasets** → **Connect a database** → MySQL.
2. Pre-seeded sample: host `mysql-sample`, port `3306`, db `sample`, user `nocode`, password `nocode_pw`. (Or use the Postgres sample on port `5435`.)
3. **Test Connection** → green chip.
4. **Save**. Mention: *"Credentials are encrypted with a Fernet key in the service env and stored in Mongo — never in plaintext."*
5. From the connector, click **Probe** on a table → schema and a 10-row preview appear.
6. Click **Import as Dataset** → it lands in the Datasets list like a CSV.

---

## Module 4 — Tabular ML Pipeline (Canvas + 14 Algorithms + Live Training)

Showcase: React Flow canvas, BaseMLModel registry, live SocketIO metrics.

1. **Pipelines** → **+ New Pipeline** → **ML (tabular)**, name `Titanic v1`.
2. Canvas opens. Three mode pills visible (ML / GenAI / DL). The ML pill is highlighted.
3. **Templates** → **ML starter** → auto-layouts `Dataset → Train → Evaluate`.
4. **Dataset node** → pick `titanic.csv`.
5. **Train node** → Algorithm = `XGBoost`, Task = `Classification`, Target = `Survived`, `n_estimators=200`, `max_depth=5`.
6. **Save**, then **Run**.
7. Live training chart fans out below the canvas. Stage chip cycles: `loading_data → preparing_features → fitting_model → training_done → saving_model`.
8. DevTools → WS frames → `training_progress`, `training_metric`, `training_complete` events appear in real time.
9. Open **Results**:
   - Confusion matrix heatmap.
   - SHAP feature importance bar chart (TreeExplainer fast path).
   - Per-row prediction explanation table.
10. **Models → Compare** — run a second pipeline with `LightGBM`, then compare side-by-side. Promote one to default.
11. **Export** → download zip with `model.joblib`, `inference.py`, `requirements.txt`, `README.md`. Open the README on screen and read the two-line launch instruction.

---

## Module 5 — Local Generative AI (RAG, fully offline)

Showcase: PDF → MiniLM → pgvector → Llama 3.2 streamed chat. No outbound calls.

1. **+ New Pipeline** → **GenAI** → **RAG starter** template.
2. **Document node** → drop `infra/sample-data/handbook.pdf`.
3. Status: `chunking → embedding → indexing → ready`. Chunk count badge updates.
4. Open the canvas chat panel.
5. **Ask:** *"What does the onboarding checklist say about week one?"*
6. Watch the answer stream token-by-token. A **`n sources used`** chip lists the chunks and their similarity scores.
7. **Proof of locality** — split-screen:
   ```bash
   docker compose logs -f ml-training-worker | grep -E "(embedding|ollama)"
   docker compose logs -f api-gateway | grep -E "(POST /companion|POST /rag/chat)"
   ```
   Show the embedding log line referencing `sentence-transformers/all-MiniLM-L6-v2`. Show that **no** outbound request goes to `api.openai.com`, `api.anthropic.com`, or any vendor host. Repeat the line: *"100% local — the documents never leave the machine."*

### 5b. AI Companion (in-app assistant)

1. Click the floating **🤖 Companion** FAB.
2. Ask *"How do I balance my classes?"*. Llama 3.2 answers in 3–8 s; chip shows `~XXXX ms · llama3.2:3b`.
3. Ask *"What does this screen do?"* — answer references the active page + dataset name. Mention: *"Same Llama, different prompt — the Companion injects the current route/dataset context server-side."*

---

## Module 6 — Deep Learning (Image Classification)

Showcase: PyTorch service, three CNN catalogue, VRAM guard, live training, inline inference.

### 6a. Upload the demo dataset

```bash
# From the host (pre-built in pre-flight)
curl -fsS -X POST http://localhost:8000/datasets/image-upload \
  -H "Authorization: Bearer $ALICE_JWT" \
  -F "file=@/tmp/demo_images.zip"
```

Or use the future UI button if shipped. Mention: *"It's a 30-image, 3-class synthetic dataset — red circles, green squares, blue triangles. Trains end-to-end in 30 seconds on the 1660 Super."*

### 6b. Train the model

1. **+ New Pipeline** → **Deep Learning** → **DL starter** template.
2. **Image Dataset node** → pick the demo dataset. Class chips light up; 3-per-class thumbnail strip lazy-loads.
3. **CNN Arch node** → `tiny_resnet`, input `64`, channels `3`. Toggle the **Pretrained** switch — it disables itself because tiny_resnet has no canonical ImageNet checkpoint; tooltip explains why.
4. **DL Train node** → 5 epochs, batch 32.
5. **Run**.
6. Live chart shows three series: `train_loss`, `val_loss`, `val_acc`, all sharing the epoch X-axis.
7. ~30 s later: success alert. The **Try it** panel renders inline.
8. Drop any image into Try-It — top-five softmax probabilities render as ranked horizontal bars; argmax highlighted.

### 6c. VRAM guard refusal (the demo-safety net)

1. On the DL Train node, switch architecture to `mobilenet_v3_small`, input `224`, batch as high as the slider allows. Click **Run**.
2. The route refuses with a structured payload:
   ```json
   {
     "error": "vram_budget_exceeded",
     "estimate": { "weights_mb": 10, "optimizer_mb": 30, "activations_mb": 6200, "total_mb": 7290 },
     "budget_mb": 5120
   }
   ```
3. Snackbar shows the human reason. Mention: *"Four layers of defence — UI slider clamps, route rejects, VRAM guard rejects, HARD_MAX is the final ceiling. A wrong batch-size press cannot OOM the GPU on stage."*

### 6d. Tier-aware ceilings (cross-tier demo)

1. Log out, log in as **Eve (free)**. The DL Train node sliders cap at 5 epochs, batch 32 — try to drag past, can't.
2. With DevTools, hand-craft a POST to `/dl/train` with `epochs: 20`. Server returns `epochs_over_tier_limit` (400).
3. Log back in as Alice for the rest of the demo.

### 6e. Optional CLI smoke run

```bash
bash scripts/dl_smoke.sh http://localhost:8000 "$ALICE_JWT" "$PIPELINE_ID" "$DATASET_ID"
```

Show the script terminal alongside the GPU monitor (`watch -n 1 nvidia-smi`) for "look, the GPU actually lights up" visual.

---

## Module 7 — Multi-tenant Collaboration (real-time presence + invite by email)

Showcase: per-pipeline ACL, cursors over SocketIO, invitation email via MailHog.

### 7a. Open the same pipeline in two browsers

1. Window A (Chrome) — Alice.
2. Window B (Firefox or Chrome incognito) — Bob.
3. Both open the `Titanic v1` pipeline.
4. Move Alice's mouse — Bob sees Alice's coloured cursor. Click a node in Alice's window — Bob sees the selection highlight.
5. Save a node edit in Bob's window — Alice's canvas live-updates without a refresh.

### 7b. Pipeline chat with @mention notification

1. Alice types in the pipeline chat: `@bob can you review the SHAP plot?`
2. Bob's window: bell badge increments, dropdown shows the mention.

### 7c. Invite a third user — email via MailHog

1. Alice → **Manage Access** → **Invite a user**.
2. Email `grace@acme-ml.com`, role `Analyst`. **Send invite**.
3. **MailHog tab** → newest mail `You've been invited to the Titanic v1 pipeline`.
4. Click the link → log in as Grace (`Demo1234!`).
5. Grace lands on the pipeline. The **Run** button is disabled with tooltip *"Analyst role can view but not run training."*
6. Alice → **Manage Access** → change Grace to `Data Scientist`. Grace's window: Run button enables within ~1 s.

### 7d. Google Meet one-click

1. From the pipeline chat: **Start a Meet** button.
2. (Mocked in demo mode — open the Google OAuth in a new tab and walk through, or skip with: *"OAuth is wired; behind a corp proxy we'd need a real Google client ID."*)

---

## Module 8 — Notifications, i18n, Accessibility, Undo/Redo

Showcase: persistent notification bell, EN/FR toggle, high-contrast theme, canvas history.

### 8a. Notification bell with localStorage persistence

1. Open the bell in the navbar. Past events visible: mention, training-done, document-indexed.
2. Hard-refresh the page → unread count survives. Mention: *"Persisted to localStorage so a refresh doesn't drop the count."*
3. Click an event → routes to the source pipeline.

### 8b. Internationalisation

1. Top-right **🌐 EN** toggle → click → switch to `Français`.
2. Every label translates (navbar, sidebar, modals, error toasts). URL stays put.
3. Mention: *"TypeScript bindings are generated from the English bundle. A missing French key fails the type-check rather than rendering as a raw key string."*

### 8c. High-contrast theme

1. Top-right contrast toggle → high-contrast mode.
2. Re-run a node action (e.g., save a pipeline). Visible focus rings, WCAG AA contrast on every button.
3. Optional: hit Tab repeatedly to walk the focus order. Every interactive element has an `aria-label`.

### 8d. Canvas undo / redo

1. Drag a node, drop somewhere new — `Cmd/Ctrl+Z` returns it; `Cmd/Ctrl+Shift+Z` reapplies.
2. Delete a node with `Delete`/`Backspace` — undo restores the node *and* incident edges.
3. Mention: *"50-snapshot history with drag-coalescing — one snapshot per drag, not per pixel."*

---

## Module 9 — Admin Console + Impersonation (super-admin)

Showcase: audit log, queue + hardware monitor, migration drift, impersonation with hard TTL.

1. Log out, log in as `admin@nocode-ai.io` / `Demo1234!`. Note: super-admin sessions show only the admin tab strip — no user sidebar.
2. **Stats & Logs** tab — audit log paginated; failed-login panel; security events flagged.
3. **User Management** tab:
   - Search `acme` → ACME team filters in.
   - **Override** a quota on Bob — bump `max_chunks` to 5000. Mention: *"Override takes effect on Bob's next JWT refresh — a limitation noted in the future-work section."*
   - **Delete** a user → typed-confirmation modal asks you to retype the email before the action button enables. Mention: *"Native `confirm()` was too easy to misclick during a live demo. Once was enough."*
4. **Impersonation:**
   - Click the **eye icon** on Alice's row.
   - Red banner across the top — `Acting as alice@acme-ml.com — 4:59 remaining`. Live countdown.
   - Browse around. Visit `/admin` — blocked, because the *impersonated* identity isn't super-admin.
   - Click **Exit** on the banner → back to admin, original super-admin token restored.
   - Stats & Logs tab now shows `admin.impersonate_start` and `admin.impersonate_end` audit events with the actor's IP.
   - Mention: *"Five-minute hard TTL. An impersonation that doesn't expire is, sooner or later, an incident."*
5. **Ops Console** tab:
   - Queue stats per Celery queue (ml, dl, rag, profiling).
   - Hardware monitor — CPU %, RAM %, GPU utilisation, GPU VRAM, sampled from `metrics-service` every 5 s.
   - **Migration drift panel** — confirms every service's latest Alembic revision matches the DB.
6. **Announcements** tab — create *"Demo Day — May 26, 2026"* announcement → it appears as a banner on every tenant's dashboard until dismissed.

---

## Module 10 — Local-Only Proof (the privacy claim, on camera)

The closing slide. Show on stage:

```bash
# 1. Tail the gateway. Every external call would pass through here.
docker compose logs -f api-gateway 2>&1 | grep -E "(api\.openai|anthropic|cohere|googleapis|huggingface\.co)"
# (no output — nothing leaves the box)

# 2. Confirm Ollama is the only LLM endpoint hit.
docker compose logs -f ollama 2>&1 | grep "POST /api/generate"

# 3. Disconnect the demo box from the internet — wifi off, ethernet pulled.
#    Re-run the RAG chat in Module 5. It still answers.
```

Mention: *"This is the whole point of the project. The platform never phones home — Stripe is the only optional outbound, and it's gated by `STRIPE_SECRET_KEY` being set."*

---

## Module 11 — Logout + Session Hygiene

1. Avatar → **Sign Out** as Alice (or whoever is currently signed in).
2. sessionStorage cleared, redirect to landing page. Companion FAB hides.
3. Open DevTools → run:
   ```js
   fetch('/api/users/me', { headers: { Authorization: 'Bearer ' + OLD_JWT }})
     .then(r => r.status)
   ```
   → returns `401 token_revoked`. The refresh-token JTI is now in the Redis blacklist.
4. **If the active session was an impersonation:** clicking Logout instead **exits the impersonation** and leaves the super-admin signed in. Mention: *"Demo-day footgun avoided — admin can't accidentally sign themselves out by tapping Logout under an impersonated identity."*

---

## Module 12 — Testing & Deployment Quick Hits (for the jury Q&A)

If asked *"how do you know it actually works?"*:

```bash
# 5 parallel CI jobs, ~14 min full-stack
docker compose run --rm auth-service           pytest tests/ -v --cov=app
docker compose run --rm api-gateway            pytest tests/ -v --cov=app
docker compose run --rm data-ingestion-service pytest tests/ -v --cov=app
docker compose run --rm ml-training-service    pytest tests/ -v --cov=app
docker compose run --rm dl-training-service    pytest tests/ -v --cov=app

# Frontend strict-mode type check (cheapest test)
cd frontend && npx tsc -b && npx eslint . --ext ts,tsx --max-warnings 0
```

If asked *"how do you deploy it?"*:

```bash
make up        # 14 containers come online via docker-compose
make migrate   # Alembic — idempotent, replayable
make seed      # demo users
```

---

## Module 13 — Reset Between Demo Runs

For back-to-back jury sessions:

```bash
# Wipe demo state, keep volumes (Ollama model + uploaded files survive)
make seed
curl -X DELETE http://localhost:8025/api/v1/messages
python3 scripts/seed_demo_image_dataset.py /tmp/demo_images.zip
```

Full nuke (only if you have ≥10 min):

```bash
make down
docker volume rm $(docker volume ls -q | grep no-code-ai-platform-)
make up && make migrate && make seed
docker compose exec ollama ollama pull llama3.2:3b
```

---

## Cheat sheet — where each module proves what claim

| Module | Sprint | What it proves |
|---|---|---|
| 1 | S1 | Stateless JWT, refresh rotation, OTP, MailHog SMTP wiring |
| 2 | S6 | Stripe Checkout + Customer Portal + quota uplift |
| 3 | S1 | Async profiling, shared-volume convention, Fernet-encrypted SQL creds |
| 4 | S2 | Visual canvas, 14-algorithm registry, live SocketIO metrics, SHAP, export |
| 5 | S3 | Local RAG end-to-end, no outbound traffic, streamed tokens |
| 6 | S4 | PyTorch service, VRAM guard, tier-aware ceilings, inline inference |
| 7 | S5 | Real-time presence, per-pipeline ACL, MailHog invitation flow |
| 8 | S6 | i18n EN/FR, high-contrast theme, persisted notifications, undo/redo |
| 9 | S6 | Audit log, hardware monitor, migration drift, 5-minute impersonation TTL |
| 10 | all | The privacy claim — no outbound LLM traffic, works offline |
| 11 | S1 | Token revocation, impersonation-aware logout |
| 12 | all | Tests + deployment story for the Q&A |

If every module passes on the demo box, the platform is demo-ready.
