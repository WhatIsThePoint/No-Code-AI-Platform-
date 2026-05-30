# `finalReport.tex` Audit vs Peer Reports

Studied — Lina Yassine (#44), report22 GSN, report41 Arabsoft, report45 ZETEAM
variant. Goal: identify what every successful 2024/2025 ISET-Rades DSI
PFE report includes that `finalReport.tex` currently does not.

---

## Inventory

| Metric | mine (placeholders) | #44 Lina | #45 ZETEAM | #22 GSN | #41 Arabsoft |
|---|---|---|---|---|---|
| Compiled pages | 50 | 159 | 141 | 143 | 163 |
| Sprints | 6 | 4 | 4 | 5 | 4 |
| Chapters | 10 | 8 | 8 | 9 | 7 |
| **Figures** | 51 | 114 | ~50 | 63 | 68 |
| **Tables** | **0** | ~10 | ~10 | **17** | **42** |
| List of Tables | no | no | no | **yes** | **yes** |
| Use Case Description tables | **no** | sparse | sparse | **per sprint** | **per sprint** |
| Sprint Backlog as a table | bullet list | table | table | **table** | **table** |
| Tech comparison tables | **no** | partial | partial | **yes** | **yes** |
| Data dictionary per sprint | no | no | no | partial | **yes** |
| Business rules (règles de gestion) | no | no | no | no | **yes** |
| CRISP-DM applied for ML | no | no | no | no | **yes** |
| Concepts fondamentaux per sprint | no | no | no | **yes** | **yes** |
| Per-sprint Tests subsection | consolidated Ch.10 | consolidated | consolidated | **per sprint** | **per sprint** |
| État de l'art (separate ch.) | merged in Ch.2 | absent | absent | **separate Ch.4** | merged |
| Mockups in methodology | placeholder | yes Ch.3 | yes Ch.3 | yes §3.3 | yes §2.4 |

---

## Verdict — what `finalReport.tex` needs

Ten concrete additions, ordered by impact.

### 1. **List of Tables + at least 15 tables** *(biggest single gap)*

Peer reports average 17–42 tables. Mine has **zero**. Jury reads
tables as a proxy for analytic rigour. Required tables:

- Functional requirements table (Ch.1)
- Non-functional requirements table (Ch.1)
- Technology stack table — frontend / backend / data / ML / LLM / DL / ops (Ch.1 or Ch.3)
- Comparison of project management methodologies (Ch.3)
- Sprint Backlog tables — one per sprint, columns *User Story / Tasks /
  Priority / Estimation* (Ch.4–9, 6 tables)
- Use Case textual description tables — one per major use case per sprint
  (≥ 2 per sprint, 12+ tables)
- Algorithm comparison table for tabular ML (Ch.5) — XGBoost / RF / LightGBM /
  CatBoost / Logistic — train time / accuracy / interpretability
- CNN architecture comparison table for DL (Ch.7) — LeNet / ResNet-9 /
  MobileNet-V3 — params / VRAM / accuracy / use case
- Deployment summary table (Ch.10) — service / image / port / role / depends-on
- Test coverage table (Ch.10) — service / line coverage / notable cases

### 2. **Use Case "Description textuelle" tables**

Both report22 and report41 ship one per use case with this shape:

```
| Field | Value |
|---|---|
| Use Case | ... |
| Actor | ... |
| Pre-conditions | ... |
| Trigger | ... |
| Nominal scenario | numbered steps |
| Alternative scenarios | numbered with branch point |
| Post-conditions | ... |
```

Jury expects this. Currently absent.

### 3. **Per-sprint Tests subsection**

Reports 22 and 41 put unit + integration + API tests *inside each sprint
chapter* (not just in Ch.10). Add a §X.6 "Tests" subsection to each sprint
chapter with the specific cases that sprint exercised. Keep Ch.10 as the
overall test strategy.

### 4. **CRISP-DM layer for the tabular ML sprint (Ch.5)**

Report 41 explicitly applied CRISP-DM
(*Compréhension métier → Compréhension données → Préparation → Modélisation
→ Évaluation → Déploiement*) for its ML sprint. This is the jury-friendly
framing for ML work in a Tunisian DSI PFE. Add a CRISP-DM subsection at the
top of Sprint 2 (Tabular ML) mapping each phase to the actual work done.

### 5. **"Concepts fondamentaux" subsections**

Sprint chapters that introduce new tooling need a concepts subsection
*before* the design section. Specifically:

- **Sprint 3 (RAG)**: Concepts RAG — embeddings, vector store, top-k
  retrieval, prompt augmentation, streaming.
- **Sprint 4 (DL)**: Concepts CNN — convolution, pooling, transfer
  learning, batch normalisation, optimizers.
- **Sprint 5 (Collab)**: Concepts WebSocket / SocketIO — rooms, namespaces,
  fan-out, real-time presence.

Two to four sentences each, grounded in this project's implementation.

### 6. **État de l'art chapter (optional but recommended)**

Report 22 has a separate Ch.4 État de l'art covering both the business
domain (recouvrement contentieux) and the technical platforms (chatbot
frameworks). My Ch.2 partially does this but mixes it with the preliminary
study. **Compromise**: add a §2.5 "État de l'art technique" subsection
summarising the academic background of RAG (Lewis 2020), CNN
(LeNet/ResNet/MobileNet papers), and SHAP (Lundberg-Lee 2017) — all
already in my bibliography.

### 7. **Mockups subsection with real figure slots**

Report 45 has §1.5 Interface Mockups → 1.5.1 Auth / 1.5.2 Home / 1.5.3
Admin. Mine has §1.5 with three figure placeholders but no per-mockup
text. Add 2–3 sentences per mockup describing what the mockup commits to
and what it intentionally leaves open.

### 8. **Sprint Backlog formal table**

Replace each sprint's `\begin{itemize}` backlog with a `\begin{tabular}`
table — columns: *ID / User Story / Tasks / Priority / Estimation
(days)*. Six tables total.

### 9. **DevOps subsection in Ch.10**

Report 41 has an explicit DevOps section (Jenkins / Docker / CI flow
diagram). My Ch.10 already has CI/CD content but it's prose. Add an
explicit subsection §10.3 "DevOps and CI/CD" with the parallel jobs
listed as a table and a figure placeholder for the CI flow diagram.

### 10. **Don't copy** *(things peer reports do that hurt them)*

- The 3-page dédicace / remerciement padding (report 22 + 41) — not part
  of the technical content, jury skips it.
- Report 45's intro paragraph filler ("In the current digital era, robust
  issue tracking…") — exactly the AI-cliché tone my rules ban.
- Report 41's blanket "À mes parents… à mon binôme…" structural template
  with no project content.
- Bullet-point intros that just say "this chapter will talk about X" —
  every report does this; jury skim-reads past them.

---

## Action

Surgical edits to follow (no full rewrite):

1. Add `\usepackage{longtable}` + `\listoftables` to preamble.
2. Add the 15 tables listed in §1, distributed across chapters.
3. Add the Use Case description tables in §2 (target: 12+ table
   environments).
4. Add per-sprint `\section{Tests}` subsections in Ch.4–9.
5. Add CRISP-DM subsection at top of Ch.5.
6. Add Concepts fondamentaux subsections in Ch.6, Ch.7, Ch.8.
7. Add §2.5 État de l'art technique.
8. Flesh out §1.5 Mockups with text.
9. Convert sprint backlog itemize → tabular.
10. Add DevOps §10.3 subsection.

Estimated additions: ~25 tables, ~6 new subsections, no chapter
restructuring. Net page count after real figures land: 110–130p.
