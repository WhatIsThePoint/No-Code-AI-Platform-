# End-to-End Demo Walkthrough (Sprints 1–8)

> A click-by-click happy path covering every capability of the No-Code AI Platform — tabular ML, RAG, deep-learning image classification, multi-tenant collaboration, and the super-admin console. Use this as the demo script, the manual smoke test, and the "is the build green?" checklist.

**Estimated runtime:** 25–35 minutes (one ML training run + one DL training run + one RAG indexing + admin walkthrough).

**Hardware profile assumed:** GTX 1660 Super (6 GB VRAM) on a 16 GB-RAM laptop. Everything works without a GPU; deep-learning training will fall back to CPU with a banner warning.

---

## 0. Pre-flight (one-time)

```bash
# from the repo root
make up                                              # start every container
make migrate                                         # apply Alembic — must run after pulling Sprint-8 changes
make seed                                            # seed demo users + ACME company
docker compose exec ollama ollama pull llama3.2:3b   # download the local LLM (~2 GB)
```

Optional, but recommended for the DL section: enable GPU passthrough.

```bash
# host-side prereqs (Ubuntu): sudo apt install nvidia-container-toolkit
# then uncomment the deploy.resources.reservations.devices block in
# docker-compose.yml under dl-training-service AND dl-training-worker
docker compose up -d dl-training-service dl-training-worker
```

Health check every service:

```bash
for p in 8000 8001 8002 8003 8004 8005; do
  printf 'localhost:%s  %s\n' "$p" \
    "$(curl -fsS -o /dev/null -w '%{http_code}' http://localhost:$p/health || echo down)"
done
docker compose ps   # every service should report Up / healthy
```

Open **http://localhost:5173** in Chrome/Firefox.

---

## 1. Authentication

| Step | Action | Expected |
|---|---|---|
| 1.1 | Land on `/` | Hero shows the "100% Local AI" pitch; six feature cards (ML, RAG, DL, Profiling, Companion, Portability). |
| 1.2 | Click **Sign In** → enter `alice@acme-ml.com` / `Demo1234!` | JWT stored in `sessionStorage`; redirect to `/dashboard`. |
| 1.3 | Refresh the page | Still logged in (sessionStorage persistence — Sprint 7 fix). |
| 1.4 | Open DevTools → Network → look for the `users/me` response | Response includes `limits: { max_chunks, max_vram_mb, max_dl_epochs, max_dl_batch_size }`. |

Smoke check: floating Companion FAB is hidden on the landing page, visible after login.

---

## 2. Workspace and Layout

| Step | Action | Expected |
|---|---|---|
| 2.1 | Top-left workspace switcher | Shows **Personal** + **ACME ML** workspaces. |
| 2.2 | Switch between them | Sidebar list scopes to that workspace's datasets/pipelines. |
| 2.3 | Stay in **Personal** for the rest of the demo | Avoids polluting the company sandbox. |

---

## 3. Data Ingestion (CSV)

| Step | Action | Expected |
|---|---|---|
| 3.1 | Sidebar → **Datasets** | Page renders. Two primary buttons ("Upload CSV / Excel" and "Connect a database") are the **same medium size** — Sprint 8 polish fix. |
| 3.2 | Click **Upload CSV / Excel**, pick `infra/sample-data/titanic.csv` | Modal asks for an optional description; click Upload. |
| 3.3 | Wait ~10 s | Status flips `extracting`/`profiling` → `ready`; row + column count populate. |
| 3.4 | Click the dataset row | Detail page opens with overview, schema table, **Profiling** tab. |

---

## 4. Profiling

| Step | Action | Expected |
|---|---|---|
| 4.1 | Switch to **Profiling** tab | Loads in <3 s. |
| 4.2 | Skewness alert | Appears for any column with skew > 1.0, suggests a log transform. |
| 4.3 | Set target = `Survived` → **Re-profile** | Imbalance alert appears (binary target, <20 % minority). |
| 4.4 | Per-column section | Numeric columns render box+violin plots, outlier badges. |
| 4.5 | Correlation heatmap | Plotly heatmap with hover tooltips. |

---

## 5. AI Companion

| Step | Action | Expected |
|---|---|---|
| 5.1 | Click the **🤖 Companion** FAB | Right drawer opens with suggestion chips. |
| 5.2 | Suggestion *"How do I balance my classes?"* | Local Llama 3.2 answers in 3–8 s; chip shows `~XXXX ms · llama3.2:3b`. |
| 5.3 | Type *"What does this screen do?"* | Answer references the active page + dataset name. |
| 5.4 | Network tab → `POST /api/companion/ask` returns 200 | **Zero outbound calls to api.openai.com / anthropic.com / cohere.com** — local-only confirmed. |

If you see `503 ollama_unavailable`: `docker compose exec ollama ollama list` and re-pull if missing.

---

## 6. Build a Tabular ML Pipeline

| Step | Action | Expected |
|---|---|---|
| 6.1 | Sidebar → **Pipelines** → **+ New Pipeline** | Type **ML (tabular)**, name `Titanic v1`. |
| 6.2 | Canvas opens with the **Traditional ML** mode pill highlighted | Three mode pills visible: ML, GenAI, Deep Learning. The other two are disabled because no nodes exist yet — they enable as soon as the canvas is empty / locked once a node lands. |
| 6.3 | Click **Templates** → **ML starter** | Auto-layouts a Dataset → Train → Evaluate graph. |
| 6.4 | Click the Train node → side panel | Algorithm = XGBoost, Task = Classification, Target = Survived. Tweak `n_estimators=200`, `max_depth=5`. |
| 6.5 | Click **Save** then **Run** | Status flips `running`. **Live training chart** appears below the canvas. |

---

## 7. Live Training and Results

| Step | Action | Expected |
|---|---|---|
| 7.1 | Watch the chart | Stage chip cycles through `loading_data` → `preparing_features` → `fitting_model` → `training_done` → `saving_model`. Progress bar fills. |
| 7.2 | DevTools → WS frames on `/training` | `training_progress`, `training_metric`, `training_complete` frames fire. |
| 7.3 | Stage flips to **complete**; toast shows duration | Pipeline status = `done`. |
| 7.4 | Open **Results** | Confusion matrix heatmap, SHAP feature importance, per-row prediction explanations. |
| 7.5 | Re-run with LightGBM, then **Models → Compare** | Side-by-side metrics + SHAP overlap. Promote one to default. |
| 7.6 | Model detail → **Export** | Downloads a zip with `model.joblib`, `inference.py`, `requirements.txt`, `README.md`. |

---

## 8. Undo / Redo and Delete on the Canvas

| Step | Action | Expected |
|---|---|---|
| 8.1 | Drag a node, drop somewhere new | Single snapshot pushed (drag-coalescing). |
| 8.2 | `Cmd/Ctrl+Z` | Node returns to original position. |
| 8.3 | `Cmd/Ctrl+Shift+Z` | Node returns to dropped position. |
| 8.4 | Click a node, hit `Delete` (or `Backspace`) | Node + incident edges removed. |
| 8.5 | Click **Templates** → **ML starter** twice in a row | Tab switches are blocked because nodes of one family already on canvas — tooltip explains "Clear the canvas to switch pipeline mode". |

---

## 9. RAG (Generative AI mode)

| Step | Action | Expected |
|---|---|---|
| 9.1 | New pipeline → **GenAI** mode → **RAG starter** template | Document → Vector Store → RAG Config nodes wired. |
| 9.2 | On the Document node, drop a PDF (`infra/sample-data/handbook.pdf`) | Ingestion job runs: chunking → MiniLM embedding → pgvector insert. Chunk count badge updates. |
| 9.3 | Open the canvas's chat surface | Stream-token chat opens once embeddings are persisted. |
| 9.4 | Ask a question grounded in the doc | Llama 3.2 streams a response with `n sources used` chip listing chunk numbers + scores. |
| 9.5 | Test the **RAG Config** node slider | Top-K slider stays inside the rounded node border (Sprint-8 fix). End marks no longer overflow. |

Verify local-only: `data-ingestion-service` logs show `embedding via sentence-transformers/all-MiniLM-L6-v2` and `INSERT INTO rag_documents` — no outbound HTTP.

---

## 10. Deep Learning (Sprint 8 — image classification)

> **Skip this section if `dl-training-service` is not running.** `curl http://localhost:8005/health` returns 200 when ready.

### 10a. Prepare the demo dataset

```bash
python3 scripts/seed_demo_image_dataset.py /tmp/demo_images.zip
# 30 PNGs across circle / square / triangle classes
```

### 10b. Upload + train

| Step | Action | Expected |
|---|---|---|
| 10.1 | Datasets page → **Upload CSV / Excel** is for tabular only; switch to image upload via the API or a future UI affordance | Behind the scenes: `POST /datasets/image-upload` extracts the zip into `<class>/<file>` layout. |
| 10.2 | New pipeline → **Deep Learning** mode | Three node buttons: Image Dataset, CNN Arch, DL Train. |
| 10.3 | Click **Templates** → **DL starter** | Wires Image Dataset → CNN Arch (Tiny ResNet) → DL Train (5 epochs, batch 32). |
| 10.4 | On the Image Dataset node, pick the demo dataset | Class chips populate, thumbnail strip lazy-loads (3 images per class). |
| 10.5 | Click **Run** | Live chart opens with three series: train_loss, val_loss, val_acc. |
| 10.6 | After ~30 s on GPU (or ~3 min on CPU) | Training succeeds. **Try it** panel renders inline under the canvas. |
| 10.7 | Drop any image into the Try-It panel | Top-5 predictions render as ranked bars; argmax highlighted. |

### 10c. VRAM-guard refusal

| Step | Action | Expected |
|---|---|---|
| 10.8 | On the DL Train node, drag the slider as far as your tier allows; pick MobileNet @ 224 px and click Run | If the static estimate exceeds the budget, the run is refused with a 400 + a structured `estimate.total_mb` payload — the snackbar shows the reason. |
| 10.9 | DevTools → response body to `POST /dl/train` | `{"error": "vram_budget_exceeded", "estimate": { ... }, "budget_mb": ... }`. |

### 10d. Tier-aware ceilings

| Step | Action | Expected |
|---|---|---|
| 10.10 | Log out as `alice`, register / log in as a free-tier user | DL Train node sliders cap at 5 epochs, batch 32. |
| 10.11 | Try to hand-craft a request via DevTools that exceeds the tier | Server returns `epochs_over_tier_limit` (400). Defence in depth: the slider clamps client-side, the route rejects server-side, and the static cap (`HARD_MAX_EPOCHS`) is the ultimate ceiling. |

---

## 11. Multi-tenant Collaboration

| Step | Action | Expected |
|---|---|---|
| 11.1 | Switch to **ACME ML** workspace | Sidebar scopes to company datasets/pipelines. |
| 11.2 | Open a company pipeline in two browsers (Alice + Bob) | Both windows show the other's coloured cursor. |
| 11.3 | Type in pipeline chat | Other window receives the message; `@`-mention triggers a notification bell ping. |
| 11.4 | Save a node edit | Other window's canvas live-updates. |
| 11.5 | **Manage Access** → invite a third user as Analyst | Analyst can view metrics but cannot run training (button disabled with tooltip). |

---

## 12. Admin Console (super-admin only)

> Log out, log back in as the super-admin (see seed.sql for credentials, or use `make seed` defaults).

| Step | Action | Expected |
|---|---|---|
| 12.1 | After login | **No sidebar** — super-admin sessions only show the AdminPage's tab strip (one-item nav rail removed in Sprint 8 polish). |
| 12.2 | **Stats & Logs** tab | Audit log table paginated; failed-login panel shows the last 24 h. |
| 12.3 | **User Management** tab | Search, paginate, suspend, delete. Delete now requires retyping the user's email — no more native `confirm()`. |
| 12.4 | Click the **eye icon** on any user row | Impersonation starts: red banner across the top with the target's email + a live 5:00 countdown. |
| 12.5 | Browse around as the user | All routes work; `/admin` is blocked (the impersonated identity isn't super-admin). |
| 12.6 | Click **Exit** on the banner — or **Logout** in the navbar | Original super-admin token restored, redirected to `/admin`. Audit log shows `admin.impersonate_start` + `admin.impersonate_end`. |
| 12.7 | **Ops Console** tab | Live queue stats, hardware monitor (CPU/RAM/GPU sampled every 5 s), migration drift panel. |
| 12.8 | **Announcements** tab | Create an announcement; it appears as a banner on every tenant's dashboard until dismissed. |

---

## 13. i18n + Accessibility

| Step | Action | Expected |
|---|---|---|
| 13.1 | Top-right language toggle → **Français** | Every label translates; URL stays put. |
| 13.2 | Top-right contrast toggle | High-contrast theme applied (WCAG AA). |
| 13.3 | Screen reader walk-through | Every button has an `aria-label`; the impersonation banner's `role="alert"` announces. |

---

## 14. Logout

| Step | Action | Expected |
|---|---|---|
| 14.1 | Avatar → **Sign Out** (or the navbar Logout button) | sessionStorage cleared; redirect to `/`. Companion FAB hides. |
| 14.2 | `curl` with the old JWT | `401 token_revoked` — Redis blacklist working. |
| 14.3 | If the session was an impersonation, Logout instead **exits the impersonation** without signing the super-admin out | Avoids the demo footgun of "accidentally signed out the platform admin". |

---

## 15. Quick Sanity-Check Cheat Sheet

```bash
# Frontend type-check + lint
cd frontend && npx tsc -b && npx eslint . --ext ts,tsx --max-warnings 0

# Backend tests (each spins up its own deps via the compose services)
docker compose run --rm ml-training-service     pytest tests/ -v
docker compose run --rm auth-service            pytest tests/ -v
docker compose run --rm data-ingestion-service  pytest tests/ -v
docker compose run --rm api-gateway             pytest tests/ -v
docker compose run --rm dl-training-service     pytest tests/ -v   # Sprint 8

# Container health
docker compose ps

# Optional: live DL smoke
bash scripts/dl_smoke.sh http://localhost:8000 "$JWT" "$PIPELINE_ID" "$DATASET_ID"
```

All five `pytest` runs should be green. `docker compose ps` should show every service `Up`. The DL smoke script polls the task to terminal state with progress logs.

---

## 16. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `GET /api/users/me 500` after a fresh pull | DB schema is older than the code; new override columns missing. | `make migrate` — Sprint 8 added migration `9a7d5e3c2b50`. Then `docker compose restart auth-service`. |
| LiveTrainingChart never moves past `waiting` | SocketIO message queue not configured on the worker. | `docker compose exec ml-training-worker env \| grep SOCKETIO_MESSAGE_QUEUE` should print `redis://redis:6379/2`. |
| Companion returns `503 ollama_unavailable` | Ollama down or model not pulled. | `docker compose exec ollama ollama pull llama3.2:3b`. |
| `make seed` fails with `relation does not exist` | Ran before `make migrate`. | Run `make migrate` first. |
| `curl :8005/health` connection refused | `dl-training-service` not built or not started. | `docker compose build dl-training-service && docker compose up -d dl-training-service dl-training-worker`. |
| DL training succeeds on CPU but `nvidia-smi` is idle | GPU reservation block is commented out in `docker-compose.yml`. | Uncomment the `deploy.resources.reservations.devices` block on **both** `dl-training-service` and `dl-training-worker`, install `nvidia-container-toolkit`, restart. |
| `vram_budget_exceeded` on a small request | Tier ceiling clamps before the static estimator. | Either raise the per-user override in **Admin → User Management → Override**, or pick a smaller arch / batch / input size. |
| RAG slider's right-hand mark hangs past the node border | Browser is using a stale JS bundle. | Hard-refresh (Ctrl+Shift+R). Sprint-8 fix translates the end mark inward. |
| Admin impersonation banner is hidden behind the AppBar | Browser is using a stale JS bundle. | Hard-refresh. Sprint-7 fix raises the banner's z-index above the drawer. |

---

## Sprint coverage map

| Sprint | What this guide covers it under |
|---|---|
| **1** Auth + gateway | §1, §14 |
| **2** Ingestion + profiling | §3, §4 |
| **3** Visual pipeline editor + 14 algos | §6, §7 |
| **4** SHAP + export + dashboard | §7 (Results), §11 (collab) |
| **5** Local RAG + chat | §5, §9 |
| **6** Multi-tenant ACL + presence | §11 |
| **7** i18n + admin + impersonation + undo/redo | §8, §12, §13, §14 |
| **8** Deep learning (image classification) + tier-aware caps + UI polish (button alignment, slider overflow, admin sidebar removal) | §10, §3 (button parity), §9.5 (slider), §12.1 (no sidebar) |

If every section in this guide passes, the platform is demo-ready.
