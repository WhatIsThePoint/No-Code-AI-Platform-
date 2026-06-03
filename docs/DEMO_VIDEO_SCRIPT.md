# Demo Video Script — No-Code AI Platform (PFE)

A chaptered walkthrough script for a single-take ~22 minute product demo of the
No-Code AI Platform. Every click path, narration line, and technical hook is
tied to a real feature in the codebase so the recording does not drift from
what the platform actually does.

---

## Setup before you hit record

- **Two accounts ready**: `you@demo.com` (will sign up live), and a pre-existing
  company owner `alice@acme.com` who will invite you mid-video.
- **Two browser profiles** (or one Chrome + one Firefox) side-by-side for the
  collab section.
- **One terminal tile** kept visible — handy when you cut to docker logs /
  Ollama.
- **A small image zip** (e.g. an Intel Image Classification subset — see the
  dataset recommendation at the bottom of this doc) ready on the desktop for
  the DL section.
- **Postgres demo DB** running with a small table (e.g. `northwind.customers`)
  — the SQL connector needs a live host.
- **Mailhog** open in a background tab (`http://localhost:8025`) so email
  verification + invites are visible.

---

## Chapter 1 — Cold open & landing page (0:00 – 0:40)

**Screen:** `http://localhost:5173/` (landing page)

**Actions:** scroll slowly: hero → "100% local AI" pitch → pricing → footer.

**Narration:**

> "This is a no-code AI SaaS platform I built as my PFE. The pitch is simple —
> you drag-and-drop a pipeline, the platform trains the model, and unlike every
> other no-code tool, **the inference, the embeddings, and the LLM all run
> locally** on the host's own hardware through Ollama and pgvector. No OpenAI
> key. No data leaving the box. Three pipeline modes: classic ML, deep learning
> for image classification, and a RAG chatbot mode. Let me walk you through all
> three."

---

## Chapter 2 — Sign up + email verification (0:40 – 1:40)

**Click path:** `Sign up` → fill `you@demo.com`, password, full name → submit.

**Narration on the form:**

> "Auth-service issues a verification token, drops a row in `users` with
> `email_verified = false`, and sends a magic link through Flask-Mail. In dev
> that goes to MailHog."

**Cut to Mailhog tab.** Click the email → click the verification link.

**Back on the platform:** redirected to `/login` with a "Email verified" toast
→ log in.

**Talking point:**

> "Until that link is clicked, the JWT minted at login carries a flag that the
> gateway uses to gate write-side endpoints. Login itself is allowed so users
> can resend the email from inside the app."

---

## Chapter 3 — First-time dashboard, the free-tier wall (1:40 – 2:40)

**Screen:** Dashboard with the first-time pipeline tour bubbles firing.

**Actions:**

1. Let the **PipelineTour** Joyride steps play through (the 5-step roadmap).
2. Navigate to **Data**.
3. Click **Upload** → drop a file > 10 MB.

**Narration during upload error:**

> "Free tier caps you at 3 datasets and 10 MB per file. The data-ingestion
> service returns a 402 Payment Required with a `limit: max_file_size_mb`
> field — the frontend turns that into the upgrade prompt you see here. SQL
> and Postgres connectors are also gated off on free; they're greyed out in
> the picker."

Hover the SQL connector tile → tooltip says "Upgrade to unlock".

---

## Chapter 4 — Stripe upgrade flow (2:40 – 4:00)

**Click path:** Dashboard banner → **Upgrade plan** → Billing page → **Solo**
card → **Subscribe**.

**Screen:** Stripe Checkout in test mode.

**Use card** `4242 4242 4242 4242`, any future date, any CVC, any ZIP.

**Narration during checkout:**

> "Stripe webhook hits the auth-service `/billing/webhook` endpoint, which
> updates the `subscriptions` table and bumps the user's `tier` to `solo`. The
> next JWT refresh picks up the new tier; that's why I do a silent re-auth on
> return."

**Back on the platform**: tier badge in the navbar now reads **SOLO**, dataset
limit shows **20**, file cap **100 MB**, SQL connector tile lights up.

---

## Chapter 5 — Loading data: demo, PC upload, SQL & Postgres (4:00 – 7:00)

### 5a — Demo dataset menu (45s)

**Click path:** Data page → **Load demo dataset** menu.

> "Four demo sets baked in. The classic three are pre-cleaned — Iris, Titanic,
> Customer Churn — and I added a fourth specifically to showcase preprocessing:
> **Employee Attrition — Dirty Demo**. Missing cells in five columns,
> inconsistent casing on the department field, mixed yes/no encodings, and a
> couple of salary outliers."

Pick the dirty demo → watch the profiling task progress bar.

**Cut to dataset detail page:** open the profiling report.

> "The profiling worker pandas-profiles the file in the background and stores
> the report in Mongo. Notice the missing-value heatmap and the dtype
> inferences — this is what the preprocessing node will hang off of when we get
> to the pipeline."

### 5b — Upload from PC (45s)

Drop a real CSV from the desktop (e.g. a Kaggle housing prices CSV). Show the
progress.

> "Same flow — file lands on the gateway, is streamed to MinIO, Celery picks up
> the profiling job. The dataset card flips from `queued` → `running` →
> `success`."

### 5c — SQL / Postgres connector (1.5 min)

**Click path:** Data → **+ Connector** → **PostgreSQL**.

Fill: host, port, db, user, password → test connection → pick the `customers`
table → import.

> "The connector lives in `data-ingestion-service/app/routes/connector.py`. It
> opens a SQLAlchemy engine against the host you give it, samples the table,
> runs the same profiling pipeline, and stores the result as a normal dataset.
> The credentials are encrypted at rest with a Fernet key from the env."

Show the imported dataset on the data page.

---

## Chapter 6 — ML pipeline end-to-end (7:00 – 10:30)

**Click path:** Pipelines → **New pipeline** → choose **Traditional ML** → land
on the editor.

**Actions:**

1. Drop **Dataset** node → bind to the dirty employee attrition demo.
2. Drop **Train** node → algorithm: **XGBoost**, target: `attrition`, task:
   classification.
3. Drop **Evaluate** node.
4. Wire `Dataset → Train → Evaluate`.
5. Hit **Run**.

**Narration while training:**

> "What just happened: the canvas serialises the graph as JSON and POSTs it to
> ml-training-service. The service validates the topology, queues a Celery task
> on Redis, and a worker picks it up. The Train node pulses while the job is
> running and the Evaluate node lights up the moment results are persisted.
> XGBoost on 90 rows trains in about three seconds."

When **Evaluate** lights up:

> "Confusion matrix, per-class precision/recall/F1, ROC-AUC. The model itself
> was persisted to MinIO; the metadata row went to Postgres."

**Click Export Model** → modal opens → download the `.pkl` and the metadata
card.

> "Versioning is in `model_versions` — every run is a new immutable version,
> and the registry page lets you compare runs side by side."

---

## Chapter 7 — Loading the image zip for DL (10:30 – 11:30)

**Click path:** Data → **+ Image Dataset** → drag-drop your image zip.

> "The image-dataset endpoint extracts the zip, treats each top-level folder as
> a class label, validates that every file is a real image with Pillow, and
> writes one row per image into `image_dataset_items`. The progress bar you
> see is the extract-and-validate worker."

When it finishes, open the dataset detail:

> "Six classes detected, balanced ~2,300 per class, average resolution shown
> here. Thumbnails for a sanity check."

(Replace the count above with whatever your chosen dataset shows.)

---

## Chapter 8 — Deep learning pipeline (11:30 – 14:30)

**Click path:** Pipelines → **New pipeline** → **Deep Learning** mode.

**The DL onboarding tour fires** (the one we just added). Let the 5 bubbles
play through.

**Build the pipeline:**

1. **Image Dataset** node → bind to the image dataset you uploaded.
2. **CNN Arch** node → pick **TinyCNN** (or ResNet-18), input `64×64`.
3. **DL Train** node → epochs **5**, batch size **32**, optimiser Adam, lr
   `1e-3`.
4. Wire and **Run**.

**Narration during training:**

> "Now we're on dl-training-service, which is a separate microservice with a
> PyTorch worker. The big thing to flag here is **VRAM gating**: the gateway
> forwards your tier's max-VRAM as an `X-Max-VRAM-MB` header; the worker's
> `vram_guard` reserves a 1 GB headroom and aborts before OOM. The DL Train
> node pulses while the run is in flight; final loss, top-1 accuracy and a
> sample-predictions strip land on it the moment the worker writes the model
> version."

When training finishes:

> "Top-1 / Top-5 accuracy, the per-class confusion grid, and a sample
> predictions strip with the model's confidence. Same export flow as ML —
> `.pt` plus a metadata card."

---

## Chapter 9 — Company invite handoff (14:30 – 15:30)

**Switch to the second browser** as `alice@acme.com` (company owner).

**Click path:** Collaborator → Company members → **Invite member** → enter
`you@demo.com`.

**Switch back to your tab.** Hard refresh:

> "Invites are pushed in real time over the SocketIO `notifications`
> namespace, but a refresh works too. The bell icon now shows the pending
> invite — accept it."

Accept → your tier flips visually to **Collaborator** badge, company workspace
appears in the sidebar.

**Important sub-beat (the bug we just fixed):**

> "If you try to open a company pipeline you weren't invited to, the editor now
> tells you that cleanly instead of throwing a generic 'failed to load'."

(Optional 10s: click a pipeline in someone-else's project → land on the new
"You are not a part of this pipeline" page → click back.)

---

## Chapter 10 — Live collaboration on a RAG pipeline (15:30 – 19:00)

**Both browsers visible side by side.**

**You (in Alice's company workspace):** New pipeline → **Generative AI** mode →
the **GenAITour** bubbles fire.

**Build together:**

1. You drop a **Document** node → upload a PDF (a product spec, a research
   paper — anything with prose).
2. Alice drops a **Vector Store** node → wire from Document.
3. You drop a **RAG Config** node → leave Llama 3.2 3B selected, **show the
   Top-K slider** (the one we just fixed) — slide it to 9, 10, watch the
   warning banner light up and the thumb stay inside the node.
4. Wire `Document → Vector Store → RAG Config`.

**While Alice is building, you upload a second PDF** — show the document
re-indexing.

**Narration during chunking:**

> "Two things happen on save. The Document worker chunks the PDF with
> sentence-transformers' tokenizer at a 512-token window, then embeds each
> chunk with the local `all-MiniLM-L6-v2` model — 384 dimensions, runs on CPU.
> The vectors land in Postgres via pgvector with an IVFFlat index for cosine
> similarity. The Vector Store node refreshes its chunk count live."

**Open the chat panel.**

- **Alice asks** a question about the PDF you uploaded.
- **You ask** a question about the PDF Alice uploaded.

**Narration:**

> "Every query: pgvector returns the top-K closest chunks — that's the K you
> saw on the slider — those go into a tightly-constrained prompt template that
> tells Llama to answer only from the provided context and cite chunk IDs. The
> model is served by Ollama on the host GPU. You'll notice the citations under
> each reply — click one and it scrolls to the exact passage in the source
> PDF."

**Both users typing in chat at the same time:**

> "Chat is also SocketIO — typing indicators, mentions with `@`, and the
> meeting button I'll show next are all on the same `pipelines/<id>` room."

**Click the new "Share Meeting" button** (the consolidated one):

> "One button now — either start a Google Meet through OAuth, or paste a
> Zoom/Teams/Jitsi/Whereby link. The other browser gets a snackbar with a Join
> button the instant the link is shared."

(Share a fake `https://zoom.us/j/123` link → Alice's snackbar pops.)

---

## Chapter 11 — Admin Control Room cutaway during training (19:00 – 21:30)

**Trigger a long-running task before you switch:** start a DL training run on a
bigger zip OR kick off a re-chunk on a hefty PDF — anything that'll show queue
activity for ~2 min.

**Switch to a super-admin account** in a third tab → `/admin`.

**Walk through panels left-to-right:**

1. **LiveHardwarePanel** —
   > "Polls the system service every two seconds. GPU VRAM free vs total, CPU
   > load, RAM. Right now you can see the DL worker is eating ~3.2 GB on the
   > GPU."

2. **QueueMonitorPanel** —
   > "Celery queues by service: `data-ingestion`, `ml-training`, `dl-training`.
   > Each row is a live task with progress percent. The chunking and the DL
   > run we just kicked off are both visible. This is the same data the worker
   > exposes to the per-pipeline live chart, just aggregated."

3. **HealthcheckPanel** —
   > "Probes every microservice's `/healthz` plus Postgres, Mongo, Redis,
   > Ollama. Green / amber / red."

4. **ModelRegistryPanel** —
   > "Every model version across every user. Filter by algorithm, by tier, by
   > date. Click into one and you get the run config, metrics, dataset
   > lineage."

5. **MigrationDriftPanel** —
   > "Compares the Alembic revision the auth-service knows about against what's
   > actually in the DB. Catches the exact class of bug we hit earlier today
   > when I shipped the `has_seen_dl_tour` migration without applying it."

6. **FailedLoginsPanel** —
   > "Last 50 failed logins by IP and email — basic abuse signal. The
   > auth-service writes these in a separate table that never touches the user
   > record."

---

## Chapter 12 — Wrap (21:30 – 22:00)

**Back on the canvas, both browsers visible**, training run completed, chat
thread with citations visible.

**Closing line:**

> "Everything you saw — the embeddings, the LLM, the training, the vector
> search, the file profiling — ran on this one box. No cloud AI APIs, no data
> egress. Three pipeline families, real-time collaboration, plan-tier metering,
> and an admin room that's actually wired to the same observability the
> workers expose. That's the platform."

---

## Recording tips

- **Run the dev server with hot reload off** for the recording
  (`vite preview` after `vite build`) so HMR flashes don't show up.
- **Pre-warm Ollama** (`ollama run llama3.2:3b "hi"` once) — otherwise the
  first RAG query takes ~20s while the model loads.
- **Keep the docker logs tile dimmed** until you cut to it — flickering logs
  in the corner are distracting.
- **Mute Stripe Checkout's autoplay sound** (the success chime) before
  recording, or do the upgrade chapter in a separate take.
- For the collab chapter, recording **both browsers in one 16:9 frame** is
  cleaner than picture-in-picture; use the same screen at 50/50 split.

---

## Appendix — Recommended DL demo dataset

For Chapter 7/8 you want a dataset that:

- trains to a recognisable accuracy in **≤ 5 epochs** (the free-tier ceiling
  enforced by `plan_limits.py`),
- fits the platform's per-file upload cap (100 MB on Solo, 500 MB on Company),
- runs comfortably on the **GTX 1660 Super, ~4.5 GB usable VRAM** the platform
  is tuned for,
- is **visually striking on camera** so viewers can tell the model is doing
  something real, not memorising digits.

Ranked picks from the Twine list:

1. **Intel Image Classification — primary recommendation.**
   6 classes (buildings, forest, glacier, mountain, sea, street), ~25k images,
   native 150×150. Six visually distinct classes that read instantly on a video
   thumbnail. Hits ~80 % accuracy with a TinyCNN at 64×64 in 3–5 epochs.
   Zipped size sits around 350 MB — take the standard train/test split, drop a
   handful of folders if you need to land under the Solo 100 MB cap.

2. **CIFAR-10 — safe fallback.**
   60k images, 10 classes, 32×32 RGB. Well-known benchmark — audiences
   recognise it. Trains fast but the tiny resolution looks pixelated when you
   show sample thumbnails on screen.

3. **Fashion-MNIST — emergency "must finish in 60 s" pick.**
   28×28 grayscale, 10 classes. Trains in well under a minute on the demo box
   but is the most "toy"-looking option visually.

**Avoid for this demo:**
MNIST (boring, solved), CIFAR-100 / Food-101 / FGVC Aircraft (too many classes
to converge in 5 epochs), ImageNet / Open Images / Places365 (won't fit upload
cap, won't finish in demo time), COCO (object detection, wrong task), CelebA
(privacy optics on camera).

**Suggested narration when introducing the dataset:**

> "I'm using a subset of Intel Image Classification — six classes of natural
> scenes. About 14,000 training images, balanced. I resize to 64×64 so a 5-epoch
> run finishes inside the live chart you'll watch in a second, but the model is
> small enough that even on the free-tier limits it would converge."
