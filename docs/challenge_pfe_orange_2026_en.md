# Challenge PFE — 2026 Edition (Orange Future Talents)

Written submission — 6 slides maximum. Deadline: May 29, 2026.

Content ready to paste into the Orange PowerPoint template.
`[to fill]` markers correspond to personal or administrative
information that needs confirmation.

---

## SLIDE 1 — General Information

| Field | Value |
|---|---|
| Full name | HAMMI Youssef _(to confirm)_ |
| Department (Orange) | [to fill — host Orange division] |
| Sub-department | [to fill — host Orange department] |
| Degree and specialisation | National Bachelor's Degree in Information Technologies — Development of Information Systems (DSI) |
| Professional supervisor | [to fill] |
| University | [to fill — academic institution] |
| Internship period | [start date] – [end date] |

---

## SLIDE 2 — Project Overview

**Title:**
Privacy-First No-Code AI Platform — Tabular ML, Local Generative AI, and Deep Learning

**Summary:**

- **Problem.** No-code ML platforms (DataRobot, Vertex AI, Azure ML
  Studio) require shipping data into the vendor's cloud. For
  regulated sectors (healthcare, banking, government), that
  exfiltration is legally prohibited (GDPR, HIPAA, local banking
  rules). Existing tools leave these users without a workable
  option.

- **Approach.** A self-hosted web platform that installs on a single
  consumer machine (16 GB RAM, 6 GB VRAM GPU). Three workloads share
  the same visual canvas: tabular ML (14 algorithms), Generative AI
  through a fully local RAG pipeline (Ollama + pgvector), and Deep
  Learning on a CNN architecture catalogue sized for the VRAM
  constraint. No data ever leaves the user's machine.

- **Objectives.** (1) Full data sovereignty — zero outbound calls to
  any AI vendor. (2) Accessibility for non-technical users via a
  drag-and-drop canvas. (3) Real-world operation on consumer
  hardware, demonstrated on an NVIDIA GTX 1660 Super.

---

## SLIDE 3 — Project Roadmap

Six sprints of two to three weeks each, every sprint closing with a
runnable demo and a versioned git tag.

| # | Sprint | Main deliverable |
|---|---|---|
| 1 | Authentication & Ingestion | JWT, zero-trust gateway, CSV upload + Fernet-encrypted SQL connectors |
| 2 | Tabular ML | React Flow canvas, 14 algorithms, SHAP, joblib + FastAPI export |
| 3 | Local Generative AI | End-to-end RAG: sentence-transformers + pgvector + Ollama (Llama 3.2 3B) |
| 4 | Deep Learning | PyTorch service, 3 CNNs, static VRAM guard, inline inference |
| 5 | Collaboration | Per-pipeline ACL (5 roles), real-time presence, threaded chat, Google Meet |
| 6 | Operability | Dashboard, Stripe billing, EN/FR i18n, admin console, impersonation |

**Adjustments vs initial plan:** two sprints slipped by roughly a
week. Sprint 2 — a Plotly autoscale bug on the mixed Y axes
(progress vs metric values). Sprint 4 — empirical recalibration of
the static VRAM guard after a ~15% gap between the theoretical
estimate and the measured consumption on MobileNet-V3 at 224 px.

---

## SLIDE 4 — Actions Taken

**Deployed architecture:**
- 5 Python Flask microservices (gateway, auth, ingestion,
  ml-training, dl-training) plus a TimescaleDB-backed metrics
  service.
- React 18 + TypeScript + MUI + React Flow + i18next frontend.
- 14 Docker containers orchestrated by a single
  `docker-compose.yml`, started with one `make up` command.
- GitHub Actions CI: 4 parallel jobs (backend and frontend lint +
  tests), ~14 min for a full-stack change.

**Load-bearing technical decisions:**
- **Gateway-only header injection.** The gateway strips every
  client-supplied `X-User-*` header and re-injects them from the
  decoded JWT. Downstream services trust `X-User-Id` without
  inspection — a single zero-trust boundary.
- **Shared Docker volume** for every binary artefact (datasets,
  trained models, image zips). Removes any streaming-upload
  protocol; the same pattern generalises across all three
  pipelines.
- **Celery per service**, dedicated queues. A 20-epoch DL training
  cannot block an authentication request.
- **Four-layer VRAM guard** (UI slider, route check, static
  estimator, hard cap). A wrong batch-size press cannot OOM the
  GPU during a live demo.
- **Aggressive LLM quantisation.** Q4\_K\_M shrinks Llama 3.2 3B
  to ~2 GB VRAM, leaving 4 GB free for other GPU-bound workloads on
  the same card.

---

## SLIDE 5 — Challenges and Solutions

**Challenge 1 — Data sovereignty vs modern AI capabilities**
*Problem:* deliver a competitive generative-AI chat without
depending on cloud APIs. *Solution:* a fully local stack — Llama
3.2 3B (Q4\_K\_M, 2 GB VRAM) served by Ollama, MiniLM embeddings
(22 MB, runs on CPU), pgvector store co-located inside Postgres.
Zero outbound connections to any AI vendor.

**Challenge 2 — 6 GB VRAM hardware constraint**
*Problem:* PyTorch can easily OOM the GPU during a live demo.
*Solution:* a static memory estimator computed before every
training request, with formula
`weights + 3×weights (Adam states) + activations + 1 GB headroom`.
Structured refusal at the route layer with a diagnostic payload
when the estimate exceeds the budget. Defence in depth across four
layers.

**Challenge 3 — Sprawling scope for a single developer**
*Problem:* three AI workloads (ML, RAG, DL) plus collaboration,
billing, accessibility, and admin — the scope risked collapsing
under its own weight. *Solution:* Scrum-lite with a mandatory
runnable demo + git tag at every sprint boundary, written
retrospective, and a version-controlled Markdown backlog. Six closed
sprints, never more than two major concerns running in parallel.

**Challenge 4 — Empirical calibration vs theoretical predictions**
*Problem:* the VRAM-guard constants derived from Turing documentation
underestimated real consumption by roughly 15% on MobileNet at
224 px. *Solution:* constants tuned against measured GPU runs, with
unit tests asserting the envelope's *shape* rather than its absolute
MB values — so future recalibration does not break the suite, and
drift is caught at runtime rather than in CI.

---

## SLIDE 6 — Results

**Deliverables:**
- 5 Python microservices (~6,500 LOC) + React/TypeScript frontend
  (~13,000 LOC).
- 14 tabular ML algorithms, 3 CNN architectures, a complete RAG
  pipeline.
- 14 Docker containers, single-command deployment, green CI on
  `main`.
- 9 Alembic migrations, idempotent and replayable.

**Measured validations (on a GTX 1660 Super):**

| Workload | Configuration | Result | Duration |
|---|---|---|---|
| Tabular ML | Random Forest, salary dataset 250 K rows | **R² = 0.9785** | 4 min 12 s |
| Deep Learning | tiny\_resnet, 3 synthetic classes, 5 epochs | **Val. accuracy 100%** | ~30 s |
| RAG | Llama 3.2 3B Q4\_K\_M streaming | **~30 tokens/s**, 0 outbound calls | interactive latency |

**Demonstrated impact:** a consumer workstation (16 GB RAM, 6 GB
VRAM) is enough to host an AutoML platform, a generative-AI
workspace, and a deep-learning training loop simultaneously —
without any data ever leaving the machine. For the regulated sectors
targeted, this is not a marginal improvement. It is the difference
between having usable ML and having none.

**Supervisor feedback:** [to fill]

---

## Notes for the Orange layout

- The Orange template enforces visual consistency (logo, footer,
  brand colours). Paste the content above into the corresponding
  text zones without adding extra slides.
- For the oral pitch (stage 2), prepare a ~3-minute screen demo:
  upload CSV → canvas → train → SHAP → switch to RAG mode →
  streaming Q&A → switch to DL → inline inference. The full
  walkthrough is documented in `docs/DEMO_DAY_E2E.md`.
- Useful screenshots to include if space allows: canvas in ML mode,
  RAG streaming panel, DL prediction panel, admin operations
  dashboard.
