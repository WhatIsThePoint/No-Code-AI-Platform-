# End-to-End Demo Walkthrough

> A click-by-click happy path covering every Sprint 1–7 capability of the No-Code AI Platform. Use this as your demo script, your manual smoke test, and your "is the build green?" checklist.

**Estimated runtime:** 20–25 minutes (including a real model training).

---

## 0. Pre-flight (one-time)

```bash
# from the repo root
make up                                              # start every container
make migrate                                         # apply Alembic migrations
make seed                                            # seed demo users + ACME company
docker compose exec ollama ollama pull llama3.2:3b   # download the local LLM (~2 GB)
```

Confirm everything is healthy:

```bash
docker compose ps          # every service should report "Up" / "healthy"
curl -s http://localhost:8000/health | jq .   # gateway OK
```

Open **<http://localhost:5173>** in Chrome/Firefox.

---

## 1. Onboarding & Authentication

| Step | Action | Expected result |
|---|---|---|
| 1.1 | Land on `/` (LandingPage) | Hero shows "100% Local AI · Your Data Never Leaves Your Machine" chip; six feature cards render (GenAI/RAG, Real-Time Telemetry, Profiling, Companion, SHAP, Portability). |
| 1.2 | Click **Sign In** in navbar | Routed to `/login`. |
| 1.3 | Enter `alice@acme-ml.com` / `Demo1234!` → **Sign In** | JWT stored in `localStorage`; redirect to `/dashboard`. |
| 1.4 | Navbar shows Alice's avatar; sidebar lists Workspaces / Datasets / Pipelines / Models / Companion | Layout renders; no console errors. |

**Smoke check:** the floating AI Companion FAB (purple robot) appears bottom-right. It should be **hidden** on the LandingPage and **visible** post-login.

---

## 2. Workspace Selection (Two-Tier ACL)

| Step | Action | Expected result |
|---|---|---|
| 2.1 | Open the workspace switcher (top-left) | Shows **Personal** workspace + **ACME ML** company workspace. |
| 2.2 | Select **ACME ML** | URL adds `?workspace=company:<id>`; sidebar shows shared datasets/pipelines. |
| 2.3 | Switch back to **Personal** | List filters down to Alice-owned items. |

> Reason: Sprint 4 introduced the company tier — verify that switching scopes the rest of the demo correctly. Stay in **Personal** for the rest of this guide so you don't pollute the demo company.

---

## 3. Data Ingestion

| Step | Action | Expected result |
|---|---|---|
| 3.1 | Sidebar → **Datasets** → **+ New Dataset** | Modal opens with CSV/Excel uploader. |
| 3.2 | Drag in `infra/sample-data/titanic.csv` (or any classification CSV) | Progress bar fills; dataset row appears with status `processing`. |
| 3.3 | Wait ~10s, refresh | Status flips to `ready`; row count + column count populate. |
| 3.4 | Click the dataset row | `DatasetDetailPage` opens with overview, schema table, and **Profiling** tab. |

**Companion context check:** open the AI companion FAB while on `DatasetDetailPage` and ask *"What does this screen do?"* — the answer should reference the dataset name (Sprint 7 Module 4 context injection working).

---

## 4. Power-BI-Grade Profiling (Sprint 7 Module 2)

| Step | Action | Expected result |
|---|---|---|
| 4.1 | On the dataset page, switch to **Profiling** tab | Report loads in < 3s. |
| 4.2 | Inspect the top of the report | If any column has skewness > 1.0 → **Skewness Alert** chip appears suggesting a log transform. |
| 4.3 | Set **Target column** = `Survived` (or your target) → **Re-profile** | An **Imbalance Alert** appears for binary targets with < 20% minority — recommends SMOTE. |
| 4.4 | Scroll to the per-column section | Numeric columns render **box & violin plots**. Outlier badges show counts where z-score > 3. |
| 4.5 | Open the **Correlation Heatmap** | Plotly heatmap renders with hover tooltips and a colour scale. |

**What to demo:** zoom into the box plot for a column you know is skewed (e.g., `Fare` on Titanic) and point out the long upper tail + outlier markers.

---

## 5. AI Companion Q&A (Sprint 7 Module 4)

| Step | Action | Expected result |
|---|---|---|
| 5.1 | Click the floating **🤖 Companion** FAB | Right-side drawer opens; suggestion chips visible. |
| 5.2 | Click suggestion **"How do I balance my classes?"** | Local Llama 3.2 responds in 3–8s with SMOTE / class-weight guidance. Response time chip shows `~XXXX ms · llama3.2:3b`. |
| 5.3 | Type *"What does this screen do?"* | Answer references the current page (`DatasetDetailPage`) and the active dataset by name. |
| 5.4 | Open Network tab → confirm `POST /api/companion/ask` returns 200 with `{ answer, model, elapsed_ms }`; **no calls to api.openai.com or anthropic.com** | Local-only verified. |

> If you get `503 ollama_unavailable`: Ollama isn't up or the model isn't pulled. Run `docker compose ps ollama` and `docker compose exec ollama ollama list`.

---

## 6. Build a Pipeline

| Step | Action | Expected result |
|---|---|---|
| 6.1 | Sidebar → **Pipelines** → **+ New Pipeline** | Modal: enter name `Titanic Survival v1`, type **ML (tabular)**, dataset = the one you uploaded. |
| 6.2 | Pipeline editor opens with React Flow canvas | Nodes for Dataset, Preprocessing, Training, Evaluation. |
| 6.3 | Click the **Training** node | Right panel: choose **Algorithm = XGBoost**, **Task type = Classification**, **Target = Survived**. |
| 6.4 | Adjust hyperparams (e.g., `n_estimators=200`, `max_depth=5`) | Sliders / inputs update the JSON config preview. |
| 6.5 | Click **Save Pipeline** | Toast: *"Pipeline saved"*; URL becomes `/pipelines/<id>`. |

---

## 7. Real-Time Training Telemetry (Sprint 7 Module 3)

| Step | Action | Expected result |
|---|---|---|
| 7.1 | Click **Run Training** (top-right of pipeline editor) | Pipeline status flips to `running`. **LiveTrainingChart** appears below the canvas. |
| 7.2 | Watch the chart | Stage chip cycles through `loading_data` → `preparing_features` → `fitting_model` → `training_done` → `saving_model`. Progress bar fills 10 → 25 → 40 → 75 → 90 → 100%. |
| 7.3 | After fit completes | Headline metrics (`accuracy`, `f1`, `roc_auc`) plot as points on the secondary Y axis (autoranged). |
| 7.4 | Stage chip turns green **complete**; toast shows duration | Pipeline status = `done`. |

**Verify via browser DevTools → Network → WS:** the `/training` SocketIO namespace is open and you can see `training_progress`, `metric_point`, `training_complete` frames.

---

## 8. Results & Evaluation

| Step | Action | Expected result |
|---|---|---|
| 8.1 | After training completes, click **View Results** | `ResultsPage` opens for the new model version. |
| 8.2 | Top cards show metrics (accuracy, F1, ROC-AUC, train duration) | Numbers match what was streamed live. |
| 8.3 | Scroll to **Confusion Matrix** | Renders as a Plotly heatmap with per-cell labels, dark colour for misclassified counts (Sprint 7 M3 swap from old static table). |
| 8.4 | Scroll to **SHAP Global Importance** | Bar chart of top-N features. Hover shows mean(|SHAP value|). |
| 8.5 | (Optional) Click any test row → **Explain Prediction** | Force plot drawer opens with per-feature contribution bars. |

---

## 9. Model Comparison (Sprint 5)

| Step | Action | Expected result |
|---|---|---|
| 9.1 | Re-run the same pipeline with a different algorithm (LightGBM, Random Forest) | Two new model versions appear under the pipeline. |
| 9.2 | Sidebar → **Models** → select 2–3 versions → **Compare** | Side-by-side table of metrics + SHAP overlap chart. |
| 9.3 | Pick the best version → **Promote to Default** | Badge `default` flips to the chosen version. |

---

## 10. Model Portability — Export (Sprint 7 Module 1)

| Step | Action | Expected result |
|---|---|---|
| 10.1 | On any model-version detail page → **Export** button | Modal asks for export format (joblib bundle + FastAPI scaffold). |
| 10.2 | Click **Download** | A `model_<version_id>.zip` downloads (~1–10 MB). |
| 10.3 | Unzip → contents include `model.joblib`, `feature_columns.json`, `metadata.json`, `inference.py`, `requirements.txt`, `README.md` | Generated files present. |
| 10.4 | Test the inference script locally | `pip install -r requirements.txt && uvicorn inference:app --port 9000` then `curl -X POST localhost:9000/predict -d '{"features": {...}}'` returns a prediction. |

---

## 11. RAG / Document Chat (Sprint 6)

| Step | Action | Expected result |
|---|---|---|
| 11.1 | Sidebar → **Pipelines** → **+ New** → type **RAG** | Different editor: dataset slot accepts PDFs/Markdown/CSV. |
| 11.2 | Upload `infra/sample-data/handbook.pdf` | Ingestion job runs: chunking → embedding via `all-MiniLM-L6-v2` → write to pgvector. |
| 11.3 | Open the pipeline's **Chat** tab | Chat UI loads; a "RAG ready" badge appears once embeddings are persisted. |
| 11.4 | Ask a question grounded in the document | Llama 3.2 answers with citations to the chunks (page numbers + similarity scores). |

**Verify local-only:** in the `data-ingestion-service` logs, look for `embedding via sentence-transformers/all-MiniLM-L6-v2` and `INSERT INTO rag_documents` — no outbound HTTP to OpenAI/Cohere.

---

## 12. Real-Time Collaboration (Sprint 5)

| Step | Action | Expected result |
|---|---|---|
| 12.1 | Open the same pipeline in a second browser (logged in as a teammate, e.g., `bob@acme-ml.com`) | Both windows see each other's presence indicator. |
| 12.2 | Type a message in pipeline chat | Other window receives it instantly via `/` SocketIO namespace. |
| 12.3 | Save a node edit | Other window's canvas live-updates. |

> Skip this section if you only have one demo user. Personal-tier users won't see chat — that's by design (chat is company-tier only).

---

## 13. Logout & Session Cleanup

| Step | Action | Expected result |
|---|---|---|
| 13.1 | Top-right avatar → **Sign Out** | JWT cleared from localStorage; redirect to `/`. Companion FAB hides. |
| 13.2 | Try a `curl` with the old token | `401 token_revoked` (Redis blacklist working). |

---

## 14. Sanity-Check Cheat Sheet

After the demo, run these to confirm no regressions:

```bash
# Frontend type-check
cd frontend && npx tsc --noEmit -p tsconfig.app.json

# Backend tests
docker compose run --rm ml-training-service pytest tests/ -v
docker compose run --rm auth-service pytest tests/ -v
docker compose run --rm data-ingestion-service pytest tests/ -v
docker compose run --rm api-gateway pytest tests/ -v

# Container health
docker compose ps
```

All four `pytest` runs should be green. `docker compose ps` should show every service `Up` (and `healthy` for those with healthchecks).

---

## 15. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| LiveTrainingChart never moves past `waiting` | SocketIO message queue not configured on the worker | `docker compose exec ml-training-worker env | grep SOCKETIO_MESSAGE_QUEUE` should print `redis://redis:6379/2`. |
| Companion returns `503 ollama_unavailable` | Ollama down or model not pulled | `docker compose exec ollama ollama pull llama3.2:3b` |
| `make seed` fails with `relation does not exist` | Ran before `make migrate` | Run `make migrate` first, then `make seed`. |
| Profiling page shows "no data" | Dataset still ingesting | Wait until status = `ready`; check `data-ingestion-worker` logs. |
| Login returns 401 with correct password | Postgres not seeded | `make seed` again. |

---

*If every step in this guide passes, the platform is demo-ready.*
