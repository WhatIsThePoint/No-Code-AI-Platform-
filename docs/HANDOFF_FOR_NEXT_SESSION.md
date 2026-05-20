# Handoff — read this first when the next Claude session starts

> **Purpose.** This file is the durable memory of where the project stands and what was about to happen when the previous session ended. Read it top-to-bottom before doing anything else. Everything below is verified against the actual repo and running stack as of the moment this file was written; nothing is paraphrased or guessed.

---

## 1. What the project is, in one paragraph

A privacy-first, no-code AI platform built as an end-of-studies project (PFE). Non-technical users upload data (CSV, Excel, SQL, or a zip of images), build a pipeline visually on a React Flow canvas, and train one of three workload families — **traditional ML** (14 algorithms), **Generative AI / RAG** (local Ollama + pgvector), or **deep learning image classification** (PyTorch with three CNN architectures). Every workload runs locally; no data ever leaves the host. The architecture is five Python microservices behind a Flask API gateway, with strict zero-trust header injection at the gateway boundary. Demo hardware: laptop with 16 GB RAM and a GTX 1660 Super (6 GB VRAM).

---

## 2. Sprint history (Sprints 1–8 are all complete)

| # | Theme | Key deliverables |
|---|---|---|
| 1 | Auth + gateway | JWT, refresh-token rotation, Redis JTI blacklist, RBAC, gateway-only header injection |
| 2 | Ingestion + profiling | Async file uploads, SQL/S3 connectors with Fernet, Pandas profiling, Parquet train/val/test splits |
| 3 | Pipeline editor + tabular ML | React Flow canvas, BaseMLModel registry, 14 algorithms (XGBoost, LightGBM, CatBoost, Prophet, KMeans, etc.) |
| 4 | XAI + dashboard | SHAP, confusion-matrix heatmap, residual plots, model export, billing UI |
| 5 | Local RAG | sentence-transformers/all-MiniLM-L6-v2, pgvector, Ollama llama3.2:3b, streamed chat |
| 6 | Multi-tenancy + collab | 5-role project ACL, real-time presence (cursors + node highlights), pipeline chat, Google Meet integration |
| 7 | Polish + admin | i18n (en/fr), high-contrast theme, notification bell, admin operations console, **5-min view-as-user impersonation**, undo/redo on canvas, sessionStorage auth persist |
| 8 | Deep learning | New `dl-training-service`, image-classification with LeNet / Tiny ResNet / MobileNet-V3-Small, VRAM guard, tier-aware ceilings, "Try it" inference panel |

---

## 3. Repo + running stack

```
repo:        /home/yawsef/PFE/No-Code-AI-Platform-
git branch:  main
remote:      https://github.com/WhatIsThePoint/No-Code-AI-Platform-
last push:   commit cc2c156  ("Merge branch 'main' ...")
                e7e4976      ("feat: Sprint 7 — i18n, a11y, admin ops, ...")
```

**As of this handoff there are 43 uncommitted changes** spread across modified and new files. The Sprint-8 work, the post-Sprint-7 polish, and the doc rewrites have NOT been committed yet. See §10 for the exact list and a recommended commit plan.

### 3.1 Microservices

| Service | Port | Purpose |
|---|---|---|
| `api-gateway` | 8000 | JWT decode, header injection, proxy, SocketIO host |
| `auth-service` | 8001 | Users, billing, admin ops, project/company ACL |
| `data-ingestion-service` | 8002 | File uploads, profiling, RAG ingestion, image-dataset extraction |
| `ml-training-service` | 8003 | 14 tabular algorithms, model registry, RAG chat orchestration |
| `metrics-service` | 8004 | TimescaleDB-backed hardware telemetry |
| `dl-training-service` | 8005 | **NEW (Sprint 8)** PyTorch image classification |

Plus `data-ingestion-worker`, `ml-training-worker`, `dl-training-worker` Celery workers, and `mongo`, `postgres` (with pgvector), `redis`, `timescaledb`, `ollama`, `mailhog`. **14 compose services total.**

### 3.2 Frontend

React 18 + Vite + TypeScript, MUI components, React Flow canvas, Zustand state, i18next. Lives in `frontend/`. Dev server runs on `:5173` with API calls proxied through the gateway at `:8000`.

---

## 4. Current operational state of the running stack

Last verified live (gateway-proxied calls, JWT for `alice@acme-ml.com / Demo1234!`):

```
GET  /health (each port)                  200
POST /auth/login                          200
GET  /users/me                            200, includes limits payload:
                                          {max_chunks: 20000, max_vram_mb: 5120,
                                           max_dl_epochs: 50, max_dl_batch_size: 64}
GET  /datasets                            200, 2 items preserved
GET  /pipelines                           200, 4 items preserved
POST /api/companion/ask                   200, llama3.2:3b, ~8 s elapsed
GET  /dl/gpu (proxied)                    200,
                                          {"available": false, "torch": "2.4.1+cu121",
                                           "cuda": "12.1", "device_count": 0}
```

`dl-training-service` is **up** and **reachable** but **GPU-blind** because `nvidia-container-toolkit` was not installed on the host at the time of writing. The compose file's GPU reservation block is now uncommented for `dl-training-service` and `dl-training-worker` only — Ollama deliberately stays on CPU so it doesn't compete for the 6 GB of VRAM.

### 4.1 Demo credentials (from `make seed`)

| Email | Role | Tier | Password |
|---|---|---|---|
| `alice@acme-ml.com` | data_scientist | company | `Demo1234!` |
| `bob@acme-ml.com` | data_scientist | company | `Demo1234!` |
| `frank@acme-ml.com` | data_scientist | free | `Demo1234!` |

(There is also a super-admin in `seed.sql` — search the file for `super_admin`.)

---

## 5. WHAT WAS LEFT UNFINISHED

Two tasks were in-flight when the session ended.

### 5.1 GPU enablement (most recent task — interrupted)

The user asked to enable the GPU but keep Ollama on CPU so it doesn't fight DL training for VRAM. Status:

- ✅ `docker-compose.yml` GPU reservations **uncommented** on `dl-training-service` and `dl-training-worker`. Ollama left untouched (CPU).
- ❌ `nvidia-container-toolkit` is **not installed** on the host. Sudo password was required and the session ran out before it could be entered.
- ❌ Containers **not yet recreated** with the new compose block.
- ❌ `/dl/gpu` still reports `available: false`.

**To finish this** (in order):

```bash
# 1) On the host (interactive terminal, paste with leading ! in Claude's prompt):
sudo apt update
sudo apt install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# 2) Verify the toolkit is wired up (should print the GTX 1660 Super):
docker run --rm --gpus all nvidia/cuda:12.1.0-base-ubuntu22.04 nvidia-smi

# 3) Recreate the two DL containers so they pick up the GPU reservation:
docker compose up -d --force-recreate dl-training-service dl-training-worker

# 4) Confirm GPU is now visible from inside the container:
curl -fsS http://localhost:8005/dl/gpu
# expected:
# {"available": true, "device_name": "NVIDIA GeForce GTX 1660 SUPER",
#  "total_memory_mb": 6144, "compute_capability": "7.5",
#  "torch_version": "2.4.1+cu121", "cuda_version": "12.1"}
```

If step 4 still reports `available: false`, the container can't see the device — re-check `docker info | grep -i nvidia` and that `daemon.json` lists the `nvidia` runtime.

### 5.2 Sprint-8 frontend gap (known, not yet fixed)

There is no UI affordance for **uploading an image-dataset zip** on the Data page. The backend endpoint `POST /datasets/image-upload` exists and is tested (`services/data-ingestion-service/app/routes/image_dataset.py`), but the Data page only shows the CSV/Excel uploader and the database connector wizard. To upload images today the user has to curl the gateway:

```bash
JWT=$(curl -fsS -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@acme-ml.com","password":"Demo1234!"}' | jq -r .access_token)

python3 scripts/seed_demo_image_dataset.py /tmp/demo.zip
curl -fsS -H "Authorization: Bearer $JWT" -F file=@/tmp/demo.zip \
  http://localhost:8000/datasets/image-upload
```

A future sprint should add an "Upload images (zip)" button next to the existing two on `frontend/src/pages/DataPage.tsx`, calling `dlApi.uploadImageZip()` (already exported in `frontend/src/api/dl.ts`).

---

## 6. What was just fixed (reference)

This is what the previous session shipped — DO NOT redo any of these:

- **Login 500 (UndefinedColumn `subscriptions.max_dl_epochs`).** Migration `9a7d5e3c2b50` had not been applied. `make migrate` ran it; auth-service was restarted to drop SQLAlchemy's cached column list.
- **Postgres data corruption.** The `users / refresh_tokens / companies / memberships / invitations / subscriptions / audit_logs / announcements / project_members` tables were missing despite `alembic_version` at head. Repaired non-destructively: replayed `infra/postgres/init.sql` (idempotent), then surgically `CREATE TABLE IF NOT EXISTS` for the four post-init tables at their final head-of-migrations shape, then re-stamped `alembic_version = 9a7d5e3c2b50`. `make seed` re-inserted the demo users. **Mongo data was untouched throughout** — datasets, pipelines, and model versions all preserved.
- **api-gateway missing `DL_SERVICE_URL`.** The running container was older than the compose-file change. `docker compose up -d --force-recreate api-gateway` picked up the new env.
- **Layout sidebar.** For super-admin sessions the entire `<Drawer>` is now hidden — the admin navigates via the AdminPage's tab strip. Tenant users still get the full sidebar. See `frontend/src/components/common/Layout.tsx`.
- **DataPage button parity.** "Upload CSV / Excel" and "Connect a database" now render at the same medium height (the latter no longer uses `size="small"`).
- **RAGConfigNode slider overflow.** The 0% and 100% mark dots are translated inward (`translate(0, -50%)` / `translate(-100%, -50%)`) so they sit fully inside the node's rounded border. Container padding asymmetric `pl=1.25, pr=2`.
- **Sprint 8 in full.** New `services/dl-training-service/` microservice (Flask + Celery, port 8005), three CNN architectures, VRAM guard, model storage helper, image-dataset upload + extract on `data-ingestion-service`, three new frontend node types (`ImageDatasetNode`, `CNNArchNode`, `DLTrainNode`), `dlStarter` preset, `DLPredictPanel`, tier-aware ceilings via `auth-service/app/services/plan_limits.py`.
- **`docs/E2E_TEST_GUIDE.md`.** Rewritten end-to-end to cover Sprints 1–8 including the DL section, the admin-no-sidebar note, the slider/button fix verifications, and a sprint coverage map.
- **`report.tex`.** Rewritten in first-person student voice, expanded from ~500 to ~1500 lines, 14 chapters, 27 `\figureplaceholder{...}{...}` placeholders, 15 references, abstract added, sprints 6/7/8 chapters added, reflections + future-work chapter added. Title-page metadata still has `[Student Name]` / `[Supervisor Name]` placeholders the user will fill in.

---

## 7. Critical files to know

```
docs/
  E2E_TEST_GUIDE.md                        ← rewritten, Sprint 1–8 walkthrough
  HANDOFF_FOR_NEXT_SESSION.md              ← THIS FILE
report.tex                                 ← rewritten thesis (still has [Student Name] placeholder)

services/dl-training-service/               ← entirely new
  Dockerfile                                CUDA-12.1 torch wheels
  requirements.txt                          Flask + Celery + Pillow (NO torch — pulled separately)
  app/main.py                               /health + /dl/gpu
  app/config.py                             HARD_MAX_EPOCHS=20, HARD_MAX_BATCH_SIZE=64
  app/archs/{lenet,tiny_resnet,mobilenet}.py + __init__.py registry
  app/services/vram_guard.py                static MB estimator
  app/services/model_storage.py             save/load model.pt + sidecars
  app/services/realtime_emitter.py          gateway-bound socket events
  app/services/image_dataset.py             ImageFolder loader + transforms
  app/services/plan_limits.py               per-tier defaults
  app/routes/train.py                       POST/GET /dl/train
  app/routes/predict.py                     POST /dl/predict/<version_id>
  app/tasks/celery_app.py                   queue: dl_training
  app/tasks/train_image.py                  full PyTorch loop with AMP
  tests/                                    22 unit tests

services/data-ingestion-service/app/
  routes/image_dataset.py                   POST /datasets/image-upload + GET preview
  tasks/image_extract.py                    zip → ImageFolder layout

services/auth-service/
  migrations/versions/9a7d5e3c2b50_sprint8_dl_quota_overrides.py
  app/services/plan_limits.py               tier defaults source-of-truth

frontend/src/
  api/dl.ts                                 dlApi: train / status / predict / gpuStatus / etc
  components/pipeline/nodes/{ImageDataset,CNNArch,DLTrain}Node.tsx
  components/pipeline/DLPredictPanel.tsx    drop-zone + top-K bars
  components/pipeline/PipelineCanvas.tsx    DL toggle, 3-family lock, dlStarter
  components/pipeline/LiveTrainingChart.tsx training_epoch handler added
  components/common/Layout.tsx              sidebar hidden for super_admin

scripts/
  dl_smoke.sh                               end-to-end probe for dl-training
  seed_demo_image_dataset.py                synthetic 30-image / 3-class zip
  check_migration_drift.py                  exists; not Sprint-8

infra/postgres/
  init.sql                                  the canonical schema (CREATE IF NOT EXISTS)
  seed.sql                                  alice/bob/frank + ACME company
docker-compose.yml                          GPU block uncommented for dl-* only
docker-compose.override.yml                 dev hot-reload via volume mounts

Makefile
  make up / down / build / test / lint / migrate / seed
```

---

## 8. Things to know before doing ANYTHING

### 8.1 The migration / Postgres state

`alembic_version` is at `9a7d5e3c2b50` (Sprint 8 head). Running `make migrate` is now a no-op. Do NOT downgrade — the migration chain assumes `init.sql` ran first. If you ever wipe the postgres volume, the order is `make up postgres → wait for healthy → make migrate → make seed`.

### 8.2 The auth header convention

`api-gateway` strips every client-supplied `X-User-*`, `X-Company-*`, `X-Project-*` header before forwarding, then re-injects them from the decoded JWT. Downstream services trust those headers absolutely. **If you add a new microservice route, never read identity from the request body — always from the headers.**

### 8.3 The 3-family lock on the canvas

Once any node of one family is on the canvas, the other two families' toggle buttons are disabled. The lock is enforced by `ML_NODE_TYPES` / `RAG_NODE_TYPES` / `DL_NODE_TYPES` sets in `frontend/src/components/pipeline/PipelineCanvas.tsx`. To switch modes the user must clear the canvas first.

### 8.4 The VRAM guard is calibrated against documented Turing numbers, not measured

The static per-pixel constants in `services/dl-training-service/app/services/vram_guard.py` (`_ACTIVATION_PER_PIXEL_MB`) are conservative empirical guesses. The first real GPU run on the 1660 Super will probably need them nudged. The unit-test suite enforces the *envelope shape* (monotonic, quadratic in input size, fits 6 GB minus 1 GB headroom for every catalog combination) but not the absolute MB. Expect to adjust within ±20 % on first calibration.

### 8.5 Chats stream over SocketIO `/training`, not `/`

The training updates and DL epoch events go to room `pipeline_<id>` on the `/training` namespace. The pipeline chat goes to `/`. Don't conflate them.

### 8.6 Two pieces of UX state are persisted

`useAuthStore` (Zustand) is wrapped in `persist(... sessionStorage)` — refresh keeps the user logged in and preserves any in-flight impersonation session. Notification bell state lives in `useNotifications` and is persisted to `localStorage`.

### 8.7 Strict-mode-friendly rate limit

Per-user rate limit at the gateway is `600/min` in development, deliberately loose because React 18 Strict Mode double-invokes `useEffect` and would otherwise trigger 429s.

---

## 9. How to navigate "where am I?" on resume

```bash
# 1) Confirm the running stack
cd /home/yawsef/PFE/No-Code-AI-Platform-
docker compose ps

# 2) Confirm health
for p in 8000 8001 8002 8003 8004 8005; do
  printf '%s :%s\n' "$(curl -fsS -o /dev/null -w '%{http_code}' http://localhost:$p/health || echo down)" "$p"
done

# 3) Smoke a full E2E HTTP path
JWT=$(curl -fsS -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@acme-ml.com","password":"Demo1234!"}' | jq -r .access_token)
curl -fsS -H "Authorization: Bearer $JWT" http://localhost:8000/users/me | jq '.limits'
curl -fsS -H "Authorization: Bearer $JWT" http://localhost:8000/dl/gpu

# 4) Run the type-check + lint (fast, doesn't need the stack)
cd frontend && npx tsc -b && npx eslint . --ext ts,tsx --max-warnings 0 ; cd ..

# 5) git status to see the uncommitted Sprint-8 + polish work
git status --short
git log --oneline -5
```

If `/dl/gpu` returns `{"available": true, ...}`, the post-resume task is to fine-tune the VRAM guard. If it still reports `false`, the post-resume task is **§5.1** — finish the GPU enablement.

---

## 10. The 43 uncommitted changes — recommended commit plan

```bash
# Inspect first:
git status --short

# Recommended split (run from repo root):

# Commit 1: Sprint 8 backend
git add services/dl-training-service/ \
        services/data-ingestion-service/app/routes/image_dataset.py \
        services/data-ingestion-service/app/tasks/image_extract.py \
        services/data-ingestion-service/app/tasks/celery_app.py \
        services/data-ingestion-service/app/main.py \
        services/data-ingestion-service/app/config.py \
        services/data-ingestion-service/requirements.txt \
        services/data-ingestion-service/tests/test_image_dataset.py \
        services/auth-service/app/models/subscription.py \
        services/auth-service/app/services/admin_service.py \
        services/auth-service/app/services/plan_limits.py \
        services/auth-service/app/routes/admin.py \
        services/auth-service/app/routes/profile.py \
        services/auth-service/app/schemas/billing.py \
        services/auth-service/migrations/versions/9a7d5e3c2b50_sprint8_dl_quota_overrides.py \
        services/api-gateway/app/config.py \
        services/api-gateway/app/routes/proxy.py \
        services/ml-training-service/app/routes/models.py
git commit -m "feat(sprint-8): dl-training-service + image-classification pipeline

- new microservice services/dl-training-service (Flask + Celery, port 8005)
  with three CNN archs (LeNet, Tiny ResNet, MobileNet-V3-Small),
  static VRAM guard, model-storage helper, AMP-aware training task,
  /dl/train, /dl/train/<id>, /dl/predict/<version_id>, /dl/gpu
- data-ingestion: POST /datasets/image-upload, GET /datasets/<id>/image-preview,
  image_extract Celery task with zip safety caps, Pillow dependency
- auth-service: max_dl_epochs and max_dl_batch_size override columns
  (migration 9a7d5e3c2b50), per-tier defaults table (plan_limits.py),
  /users/me embeds resolved limits
- api-gateway: /dl/* proxy, DL_SERVICE_URL env
- ml-training-service: download endpoint framework-aware (h2o vs pytorch)"

# Commit 2: Sprint 8 frontend
git add frontend/src/api/dl.ts \
        frontend/src/api/pipelines.ts \
        frontend/src/components/pipeline/nodes/ImageDatasetNode.tsx \
        frontend/src/components/pipeline/nodes/CNNArchNode.tsx \
        frontend/src/components/pipeline/nodes/DLTrainNode.tsx \
        frontend/src/components/pipeline/nodes/validation.ts \
        frontend/src/components/pipeline/DLPredictPanel.tsx \
        frontend/src/components/pipeline/PipelineCanvas.tsx \
        frontend/src/components/pipeline/LiveTrainingChart.tsx \
        frontend/src/types/auth.ts \
        frontend/src/types/dataset.ts \
        frontend/src/types/model.ts \
        frontend/src/types/pipeline.ts \
        frontend/src/lib/pipelinePresets.ts \
        frontend/src/i18n/locales/en.ts \
        frontend/src/i18n/locales/fr.ts
git commit -m "feat(sprint-8): canvas + DL nodes + tier-aware sliders

- 3 new node components (ImageDataset, CNNArch, DLTrain)
- PipelineCanvas: 3-family lock, DL mode toggle, dlStarter preset,
  handleRun branches on canvasMode
- LiveTrainingChart: training_epoch handler fans into 3 series,
  prettyStage('epoch_n_of_N')
- DLPredictPanel: drop-zone + top-K bars; mounts on success
- DLTrainNode slider clamps to user.limits.max_dl_*
- dl.ts api client + types; pipeline.ts adds 'dl' to PipelineType"

# Commit 3: post-Sprint-7 polish + bug fixes
git add frontend/src/components/common/Layout.tsx \
        frontend/src/components/pipeline/nodes/RAGConfigNode.tsx \
        frontend/src/pages/DataPage.tsx
git commit -m "fix(ui): admin sidebar hidden, button parity, RAG slider overflow

- Layout.tsx: super-admin sessions hide the entire Drawer (a one-item
  nav rail is more clutter than affordance — they navigate via the
  AdminPage tab strip)
- DataPage.tsx: 'Connect a database' button matches the medium size
  of 'Upload CSV / Excel' for visual parity
- RAGConfigNode.tsx: end mark dots translate inward so they sit fully
  inside the node's rounded border; container pl=1.25 / pr=2"

# Commit 4: infra + CI + docs
git add docker-compose.yml \
        .github/workflows/ci.yml \
        docs/E2E_TEST_GUIDE.md \
        docs/HANDOFF_FOR_NEXT_SESSION.md \
        scripts/dl_smoke.sh \
        scripts/seed_demo_image_dataset.py \
        report.tex
git commit -m "chore: compose+CI for dl-training-service, e2e guide rewrite, thesis

- docker-compose.yml: dl-training-service + dl-training-worker entries
  with GPU reservation uncommented (Ollama deliberately CPU)
- CI: dl-training-service in lint+test matrices; CPU torch wheels in CI
- docs/E2E_TEST_GUIDE.md: full Sprint 1–8 rewrite
- docs/HANDOFF_FOR_NEXT_SESSION.md: this file
- report.tex: humanized rewrite, 14 chapters, 27 figure placeholders
- scripts/dl_smoke.sh + seed_demo_image_dataset.py"

git push origin main
```

---

## 11. Open questions / outstanding decisions for the user

1. **Title-page metadata on `report.tex`.** Line 50 still has `[Student Name]` and `[Supervisor Name]`. Fill these in before submission.
2. **Validation results section in `report.tex`** (lines ~1413–1426). The numbers there ($R^2 = 0.9785$ on the salary dataset) carry over from the earlier draft. Confirm they're still your best representative result, or replace with a fresher run.
3. **Should the Companion / RAG chat live on GPU or CPU?** Currently CPU (~1 token/s). Moving to GPU would fight DL training for VRAM. Decision deferred — see §5.1.
4. **Ollama is currently sharing nothing with DL.** Once the toolkit is installed and `available: true`, you may want to also uncomment the `deploy.resources` block under `ollama:` for fast chat — but you'd need to drop `DEFAULT_MAX_VRAM_MB` to ~3072 so the static estimator accounts for the 2 GB Ollama is holding.

---

## 12. Final checklist before resuming hands-on work

- [ ] Read this file in full (already in progress).
- [ ] `docker compose ps` — confirm everything still `Up / healthy`.
- [ ] Health-curl every port (§9 step 2).
- [ ] If `/dl/gpu` reports `available: false`, finish §5.1 (toolkit install + container recreate).
- [ ] `git status --short` and consider running the commit plan in §10 to check in the Sprint-8 work.
- [ ] When in doubt, the source of truth is the code in this repo, not your memory of the conversation.

If any of the above conflicts with what's actually on disk, **trust what's on disk** — this file was written at a point in time and the repo may have moved since.
