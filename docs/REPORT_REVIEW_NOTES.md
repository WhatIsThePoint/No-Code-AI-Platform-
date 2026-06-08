# Final Report — Review Notes

Working notes from the jury-style review of `finalReport.tex`. Split into
**(1)** what's already fixed and pushed, **(2)** what's still open, **(3)**
the diagram / MongoDB findings, and **(4)** background analysis (sprint merge,
timeline).

---

## 1. Done — applied and pushed to `main`

### Consistency / factual fixes
- **"Five" → "six" microservices** everywhere. The text said *five* while always
  listing six (api-gateway, auth, data-ingestion, ml-training, metrics, dl-training).
- **Container count → 15** everywhere (was inconsistently "14"). Matches the
  deployment table: 6 app services + 3 Celery workers + 4 datastores + Ollama +
  MailHog. `ollama-pull` noted as a one-shot init job (not counted).
- **Removed dangling Gantt reference** in Ch.1 (the chart it pointed to didn't
  exist) — then later restored it properly (see below).

### Claims softened (no evidence behind them)
- **Abstract** "nothing ever leaves the machine" → "no data ever leaves the
  machine for an AI provider" (Stripe billing is an outbound call).
- Intro "phones home to a vendor API" → "to an AI vendor".
- **Dropped the "user testing / first-session retention" claim** — no user study
  exists. Reworded to a design rationale.
- **"99% of regressions caught by `tsc`"** → "the large majority of structural
  regressions".
- **Perf numbers qualified as observed**: profiling "~2.3s on the demo machine,
  averaged over a handful of runs"; "~30 tok/s … in our own runs".

### Content added
- **Per-sprint `Règles métier` (business rules)** sections, RG-01…RG-28, one table
  per sprint, grounded in real content (header in French to match the existing
  `Concepts fondamentaux` / `État de l'art technique` headings).
- **Acknowledgements** rewritten with named people (Dr. Riadh Ghlala – academic
  supervisor; Mohamed Rahal – professional supervisor; teachers; jury; family;
  friends). Em-dashes removed per request.
- **Dated sprint timeline** in Ch.3: a planned-vs-actual table + a real `pgfgantt`
  Gantt chart (20 Feb – 1 Jun 2026). Sprints 2 and 4 marked as the +1-week slips.
  Ch.1 Gantt reference restored and now accurate (`Figure~\ref{fig:ch3_gantt}`).

---

## 2. Open — recommended, not yet done

### High impact
- **Product screenshots.** 14 `% [SCREENSHOT NEEDED]` / `% [FIGURE NEEDED]`
  placeholders are still commented out → the PDF shows UML/diagrams but **not one
  image of the running product**. For a visual no-code platform this is the most
  visible gap. (User is uploading these.)
- **Real-dataset validation + a baseline.** Current validation is synthetic only
  (R²=0.9785 on a synthetic salary set; ~97% on a 30-image toy set). No public
  benchmark, no comparison vs. a plain scikit-learn baseline or the cloud tools
  positioned against in Ch.2. A jury will press on this.
- **MongoDB collections diagram** — see §3.

### Factual contradictions still in the text
- **RAG ingestion lives in two services.** Architecture (§3) + deployment table say
  `data-ingestion-service` owns "RAG ingestion", but the Sprint 3 code listing puts
  `process_rag_document` in `ml-training-service/app/tasks/rag_ingest.py`. Pick one
  and make all references agree.
- **"S3 connectors" overclaim.** §3 lists the ingestion service with "SQL **and S3**
  connectors", but S3 appears nowhere else as a feature (Sprint 1 backlog is
  Postgres/MySQL only; the only other S3 mention is *future work*). Drop "and S3"
  or document the connector.

### Bibliography
- **62 `\bibitem` entries, only 6 ever `\cite`d** (`xgboost`, `shap`, `rag`, `lenet`,
  `resnet`, `mobilenetv3`). The other ~56 (Kleppmann, Fowler, BERT, Attention Is All
  You Need, ISO, GDPR, OWASP, …) print but are never referenced → reads as padding.
  Fix: either cite them in-text where relevant, trim to the ~20 actually used, or
  relabel the uncited block as "Bibliographie indicative / further reading".

### Smaller / viva-prep
- **IVFFlat citation is mislabelled** — points to Jégou et al. *Product Quantization*;
  IVFFlat ≠ PQ. Cite the real pgvector/IVF source or relabel.
- **Where does H2O run?** No H2O container in compose → in-process JVM inside the
  ml-training image. Worth one sentence; "H2O" usually implies a cluster.
- **"Orange Challenge"** appears once (Annex A) with no context — introduce or drop.
- **WCAG AA / "aria-label on every element"** asserted with no audit artefact.
- **Security thesis is asserted, not tested.** No threat model / abuse-case table.
  There *is* a forged-`X-User-Id` test (Sprint 1) — surface it as evidence.

---

## 3. Diagram & MongoDB findings

### Class diagrams (6 of them) — mostly complete
- ✅ Attributes are **typed** throughout (`UUID`, `str`, `int`, `bool`, `datetime`,
  `dict`, `bytes`, `float`, `Vector(384)`, defaults).
- ✅ Enums (`PipelineRole`, `NotificationKind`), stereotypes (`<<service>>`,
  `<<registry>>`, `<<value>>`, `<<transient>>`, `<<frontend>>`), multiplicities, notes.
- ✅ Methods with params + return types on the important classes
  (`ModelFactory.build(...)`, `VRAMGuard.estimate(...)`, `ChatOrchestrator.build_prompt(...)`).
- ⚠️ **Gap 1:** methods are selective — pure data entities show attributes only.
- ⚠️ **Gap 2:** the 14 ML leaf subclasses (`LogisticReg` … `ARIMAModel`) are empty
  boxes (inherit the abstract interface).

### MongoDB — the real gap
The dedicated ER diagram (`ch3_fig_db_schema`) is **Postgres-only** and complete
(every table, column, type, PK/FK/UQ). **There is no MongoDB equivalent.**

| Mongo collection | How documented | Field types shown? |
|---|---|---|
| `datasets` | `Dataset` class box (ch4) | ✅ |
| `task_results` | `TaskResult` class box (ch4) | ✅ |
| `pipelines` | `Pipeline` class box (ch8) | ⚠️ coarse (`nodes: list[dict]`) |
| `model_versions` | only an inline `INSERT model_versions {metrics, shap_summary, file_path}` arrow in the Sprint 2 sequence diagram | ❌ |
| `dl_versions` | only an inline `INSERT dl_versions {…}` arrow (ch7); `DLTrainResult` class is close but framed as a result object | ❌ |

**Recommended fix:** add one `ch3_fig_db_schema_mongo.puml` mirroring the Postgres
ER style, covering `datasets`, `pipelines`, `task_results`, `model_versions`,
`dl_versions` with their canonical document shapes + field types. Place it right
after the Postgres schema figure in Ch.3. Derive fields from the class diagrams +
the `INSERT {...}` payloads already in the sequence diagrams.

### MongoDB data modelling — embedded / linked / hybrid (supervisor request)
Academic supervisor asked for the document-modelling patterns to be addressed.
Three patterns: **embedded** (nested subdocuments, read together), **linked /
referenced** (store an ID, like a foreign key), **hybrid** (mix of both). The
platform is consistently **hybrid**:

| Collection | Embedded | Linked / referenced | Pattern |
|---|---|---|---|
| `datasets` | `profiling_summary` | `user_id` → Postgres `users` | Hybrid |
| `pipelines` | `nodes[]`, `edges[]` | `dataset_id`, `user_id` | Hybrid |
| `task_results` | `result` blob | `dataset_id` / `pipeline_id` | Hybrid |
| `model_versions` | `metrics`, `shap_summary` | `pipeline_id`; `file_path` → shared volume | Hybrid |
| `dl_versions` | `final_metrics`, `epoch_history[]`, `class_names[]` | `pipeline_id`; `state_dict_path` → volume | Hybrid |

**Defensible rule:** embed the schemaless, evolves-with-the-parent, read-together
data (profiles, node graphs, metric histories); reference identities (→ Postgres
users/ACL) and large binaries (models, uploads → named volumes, never BLOBs in Mongo).

**To do:**
1. Add a short subsection *"MongoDB data modelling — embedded, referenced, hybrid"*
   (Ch.3 Technologies, or the Sprint 1 "Why MongoDB" subsection) with the table + rule.
2. Annotate the new Mongo collections diagram so each relationship is marked
   embedded vs. referenced — answers the supervisor visually.

---

## 3b. How much is "data" actually talked about?

**As a process/pipeline — well covered** (`dataset` ×94, `ingest` ×29):
- Ingestion (Sprint 1): CSV/Excel, SQL connectors, shared volume.
- Profiling (dedicated subsection + alert table) — strong.
- Preprocessing (Sprint 2 table + Sprint 4 augmentation).
- CRISP-DM lifecycle mapping (Sprint 2).
- Data sovereignty/privacy — the whole thesis premise.

**As a modeled architecture — thin** (this is where the supervisor is pointing):
1. No MongoDB data-modelling discussion (embedded/linked/hybrid) — see §3.
2. No consolidated "data layer" view — data is scattered (ingestion S1,
   preprocessing S2, storage split between the Postgres ER diagram and a few Mongo
   `INSERT` blobs). No single sources → storage → modelling → flow section.
3. **No data dictionary** (confirmed). Demo datasets (salary 250k, dirty
   employee-attrition) have no column-level description table. = checklist item #7.
4. Data governance/lifecycle (retention, deletion, GDPR erasure) appears as
   motivation, not as implemented features.

**Verdict:** strong on data *pipeline*, weak on data *modelling/governance*. Close
it with the Mongo embedded/linked/hybrid section + a data dictionary.

## 4. Timeline (confirmed consistent)
- Project window: **~20 Feb → ~1 Jun 2026** (~14 weeks dev + report wrap).
- Six sprints at ~2.5 weeks each fits cleanly. The two +1-week slips (Sprints 2, 4)
  push the planned ~14 May finish to an actual ~28 May, then report to 1 Jun.
- Schedule used in the Gantt:

| Sprint | Theme | Actual | Wks |
|---|---|---|---|
| 1 | Auth, gateway, ingestion | 20 Feb – 5 Mar | 2 |
| 2 | Canvas + tabular ML *(+1)* | 6 Mar – 26 Mar | 3 |
| 3 | RAG | 27 Mar – 9 Apr | 2 |
| 4 | Deep learning *(+1)* | 10 Apr – 30 Apr | 3 |
| 5 | Collaboration | 1 May – 14 May | 2 |
| 6 | Operability & polish | 15 May – 28 May | 2 |
| — | Report & defense prep | 29 May – 1 Jun | 1 |

---

## 5. Remediation plan — what actually changes in the report

Action key: **ADD** = new content · **CREATE** = new diagram/asset · **EDIT** =
reword existing text · **REMOVE** = delete a claim/line. Most of the work is
*additive*; only three items are deletions, and almost nothing gets rewritten
wholesale.

### A. Data & MongoDB (the supervisor's focus — biggest block of new work)
| # | Item | Action | Where / how |
|---|---|---|---|
| A1 | MongoDB collections diagram | **CREATE** | New `diagrams/src/ch3_fig_db_schema_mongo.puml` mirroring the Postgres ER style; render PNG; **ADD** the figure right after the Postgres schema figure in Ch.3. Fields derived from class diagrams + the `INSERT {...}` payloads in the sequence diagrams. |
| A2 | Embedded / linked / hybrid modelling | **ADD** | New subsection *"MongoDB data modelling"* in Ch.3 Technologies (or expand Sprint 1 "Why MongoDB"): the 3 patterns, the per-collection hybrid table, and the embed-vs-reference rule. **EDIT** the A1 diagram to mark each relationship embedded vs. referenced. |
| A3 | Data dictionary | **ADD** | New table(s) — either a short Annex *"Demo dataset dictionaries"* or inline in Sprint 1 — listing each column of the salary + employee-attrition sets with type + description. Closes old checklist item #7. |
| A4 | Consolidated data-layer view *(optional)* | **ADD** | One short overview (Ch.3) tying sources → storage (PG vs Mongo split) → modelling → flow. Mostly stitches together text that already exists; low risk. |

### B. Evidence gaps
| # | Item | Action | Where / how |
|---|---|---|---|
| B1 | Product screenshots | **EDIT** (uncomment) + **ADD** images | Un-comment the 14 `% [SCREENSHOT NEEDED]` / `% [FIGURE NEEDED]` blocks and drop in the captures. No prose change. *(User is providing images.)* |
| B2 | Real-dataset validation + baseline | **ADD** | Extend the "Validation results" section (General Conclusion) with one public-dataset run + a scikit-learn baseline comparison. Needs an actual run, not just text. |
| B3 | Security threat model | **ADD** | Small STRIDE/abuse-case table in Sprint 1 or Ch.10; **surface** the existing forged-`X-User-Id` test as evidence (already in code, just cite it). |

### C. Factual contradictions / overclaims (cheap, do first)
| # | Item | Action | Where / how |
|---|---|---|---|
| C1 | RAG ingestion in two services | **EDIT** | Decide the owning service, then make §3 architecture, the deployment table, and the Sprint 3 code-listing caption agree. One-line edits in 2–3 spots. |
| C2 | "S3 connectors" overclaim | **REMOVE** | Delete "and S3" from the §3 ingestion line (or **ADD** a real description — but removal is the honest default since it's not implemented). |
| C3 | "Orange Challenge" with no context | **EDIT** or **REMOVE** | Either one sentence of context in Annex A, or drop the mention. |
| C4 | H2O runtime ambiguity | **ADD** | One sentence: H2O-3 runs as an in-process JVM inside the ml-training image (no separate container). |

### D. Bibliography
| # | Item | Action | Where / how |
|---|---|---|---|
| D1 | 62 entries, 6 cited | **EDIT** (preferred) / **REMOVE** / relabel | Best: **ADD** `\cite{}` calls in-text where each work is actually relevant (Ch.2, methodology, design). Alternative: **REMOVE** down to the ~20 genuinely used. Fallback: relabel the uncited block "Bibliographie indicative". |
| D2 | IVFFlat ↦ Product Quantization | **EDIT** | Replace/relabel the `ivfflat` citation with the correct pgvector/IVF source. |

### E. Accessibility
| # | Item | Action | Where / how |
|---|---|---|---|
| E1 | WCAG AA asserted, no artefact | **ADD** or **EDIT** | Either **ADD** a small audit result (axe/Lighthouse screenshot or score), or **EDIT** to soften "every interactive element" to "audited the primary flows". |

### Net effect on the report
- **New diagrams:** 1–2 (MongoDB collections; optionally a data-layer view).
- **New sections/subsections:** ~3 (Mongo data modelling, data dictionary/annex, threat-model table) + extended validation.
- **Edits:** small and localized (RAG-ingestion consistency, H2O sentence, citations, WCAG wording).
- **Removals:** 2–3 lines only ("and S3", possibly "Orange Challenge", trimmed bib entries).
- **No chapter restructuring** unless the 5-sprint merge (§4) is chosen — that's a
  separate, larger pass and is *not* part of this plan.

### Suggested order (fast → slow)
1. **C1–C4** (contradictions/overclaims) — minutes, pure credibility wins.
2. **A1–A2** (Mongo diagram + modelling subsection) — the supervisor's ask.
3. **A3** (data dictionary) + **B1** (screenshots, as images arrive).
4. **D1–D2** (bibliography) + **E1** (WCAG).
5. **B2** (real-dataset validation) + **B3** (threat model) — most effort, do last.
