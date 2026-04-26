import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./landing.css";

// ────────────────────────────────────────────────────────────
// Full landing page — nav, hero, §00 Integrations, §01 Features,
// §02 Architecture (dark), §03 Flow, §04 Demo (static mock),
// §05 Testimonials, §06 Pricing, §07 FAQ, dark footer.
// All visuals scoped via the .landing class in landing.css.
// ────────────────────────────────────────────────────────────

const INTEGRATIONS = [
  {
    title: "LLM Runtimes",
    items: [
      { mark: "OL", name: "Ollama", meta: "llama3.2:3b" },
      { mark: "ST", name: "sentence-transformers", meta: "MiniLM-L6" },
    ],
  },
  {
    title: "Vector & Retrieval",
    items: [
      { mark: "PG", name: "pgvector", meta: "native" },
      { mark: "PS", name: "Postgres", meta: "16-alpine" },
    ],
  },
  {
    title: "ML Frameworks",
    items: [
      { mark: "SK", name: "scikit-learn", meta: "1.5" },
      { mark: "XG", name: "XGBoost", meta: "2.1" },
      { mark: "LG", name: "LightGBM", meta: "4.5" },
      { mark: "CB", name: "CatBoost", meta: "1.2" },
    ],
  },
  {
    title: "Explainability & Ops",
    items: [
      { mark: "SH", name: "SHAP", meta: "tree" },
      { mark: "PL", name: "Plotly", meta: "charts" },
      { mark: "CY", name: "Celery", meta: "workers" },
      { mark: "RD", name: "Redis", meta: "broker" },
      { mark: "IO", name: "SocketIO", meta: "telemetry" },
    ],
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We replaced three SaaS dashboards and a notebook server with one Docker stack on a workstation under our desk. The security review took an afternoon — nothing leaves the box.",
    name: "P. Raghavan",
    role: "Senior Data Scientist",
    avatar: "PR",
    meta: [
      { k: "Stack", v: "Postgres + pgvector" },
      { k: "Models", v: "12 in production" },
    ],
  },
  {
    quote:
      "The visual pipeline canvas is the first no-code tool my team didn't outgrow in a week. Live SocketIO telemetry made the Azure-ML refugees feel at home immediately.",
    name: "M. Okafor",
    role: "Lead ML Engineer",
    avatar: "MO",
    meta: [
      { k: "Team", v: "4 engineers" },
      { k: "Use", v: "Churn · LTV · fraud" },
    ],
  },
  {
    quote:
      "Local Ollama RAG was the unlock. Our analysts ask questions of internal PDFs without a single token leaving the network. Compliance signed off in a single meeting.",
    name: "L. Petrov",
    role: "Head of Analytics",
    avatar: "LP",
    meta: [
      { k: "LLM", v: "llama3.2:3b" },
      { k: "Docs", v: "2,400 indexed" },
    ],
  },
];

const PRICING_TIERS = [
  {
    name: "Free",
    price: "$0",
    per: "forever",
    desc: "Personal workspace, full AI stack, capped on quantity. Perfect for students, side projects, and proofs of concept.",
    cta: "Start free",
    ctaTo: "/register",
    featured: false,
  },
  {
    name: "Solo",
    price: "$29",
    per: "/ month",
    desc: "Unlimited personal pipelines, one collaborator workspace, Docker export. The default for working data scientists.",
    cta: "Start 14-day trial",
    ctaTo: "/register",
    featured: true,
  },
  {
    name: "Collaborator",
    price: "$99",
    per: "/ seat / month",
    desc: "Unlimited collaborator workspaces, project-member roles, year-long audit log. For data teams sharing models across projects.",
    cta: "Talk to us",
    ctaTo: "/register",
    featured: false,
  },
];

type PricingRow =
  | { sec: string }
  | { l: string; hint?: string; vals: [string, string, string]; check?: boolean };

const PRICING_ROWS: PricingRow[] = [
  { sec: "Workspaces" },
  { l: "Personal workspace", vals: ["✓", "✓", "✓"], check: true },
  { l: "Collaborator workspaces", vals: ["—", "1", "Unlimited"] },
  { l: "Project member roles", hint: "Viewer · Editor · PM", vals: ["—", "—", "✓"] },
  { l: "Audit log retention", vals: ["—", "30 days", "1 year"] },

  { sec: "Data" },
  { l: "Datasets per workspace", vals: ["5", "Unlimited", "Unlimited"] },
  { l: "Profiling (outliers, skew, imbalance)", vals: ["✓", "✓", "✓"], check: true },
  { l: "SQL connector ingestion", vals: ["✓", "✓", "✓"], check: true },
  { l: "RAG document upload", vals: ["✓", "✓", "✓"], check: true },

  { sec: "Models & training" },
  { l: "Pipelines per workspace", vals: ["3", "Unlimited", "Unlimited"] },
  { l: "Training runs / month", vals: ["10", "Unlimited", "Unlimited"] },
  { l: "XGBoost · LightGBM · CatBoost", vals: ["✓", "✓", "✓"], check: true },
  { l: "scikit-learn · statsmodels", vals: ["✓", "✓", "✓"], check: true },
  { l: "Live training telemetry", hint: "SocketIO", vals: ["✓", "✓", "✓"], check: true },
  { l: "Side-by-side model comparison", vals: ["—", "✓", "✓"] },

  { sec: "Local AI" },
  { l: "Ollama llama3.2:3b copilot", vals: ["✓", "✓", "✓"], check: true },
  { l: "Context-aware Companion", vals: ["✓", "✓", "✓"], check: true },
  { l: "RAG with pgvector", vals: ["✓", "✓", "✓"], check: true },

  { sec: "Explainability & export" },
  { l: "SHAP global + per-prediction", vals: ["✓", "✓", "✓"], check: true },
  { l: "Confusion matrix · ROC", vals: ["✓", "✓", "✓"], check: true },
  { l: "Joblib export + FastAPI script", vals: ["✓", "✓", "✓"], check: true },
  { l: "Docker image export", vals: ["—", "✓", "✓"] },
  { l: "Auto-generated model card", vals: ["✓", "✓", "✓"], check: true },
];

const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "Is NoCode AI really 100% local?",
    a: "Yes. Every container — frontend, four Flask services, Celery worker, Postgres + pgvector, MongoDB, Redis, and Ollama — runs on your hardware via docker compose. The only outbound traffic is the optional Hugging Face model download on first run; you can satisfy that from a local mirror and then unplug the network entirely. Verified with tcpdump in our own CI.",
  },
  {
    q: "What hardware do I need?",
    a: "For tabular ML (XGBoost / LightGBM / CatBoost / scikit-learn) any modern x86_64 machine with 16 GB RAM is fine — no GPU required. For the local LLM and RAG features the recommended baseline is what we develop on: an NVIDIA GTX 1660 Super with 6 GB VRAM running llama3.2:3b through Ollama. Larger GPUs let you run bigger models without changing any code.",
  },
  {
    q: "How does RAG work without OpenAI?",
    a: "Document chunks are embedded with sentence-transformers (all-MiniLM-L6-v2) into a pgvector column inside our Postgres container. At query time we do a cosine-similarity search in pgvector, assemble the retrieved chunks into a prompt, and send it to Ollama running llama3.2:3b on your GPU. No API keys, no external calls — embeddings, vectors, prompts, and answers all stay in your machine.",
  },
  {
    q: "Can I export models to FastAPI or Docker?",
    a: "Yes. Every trained tabular model can be downloaded as a joblib bundle paired with an auto-generated FastAPI inference script (main.py) and a Markdown model card. Solo and Collaborator tiers add a Docker image export — same runtime as your laptop, deployable to any container host.",
  },
  {
    q: "Do I need to know Python?",
    a: "No. The whole platform is driven from a visual canvas: drag DatasetNode, Preprocess, Encode, Split, Train, and Evaluate nodes; wire them up; hit Run. RAG pipelines use the same canvas with Document, VectorStore, and RAGConfig nodes. The exported model card and FastAPI script are Python under the hood, so engineers reviewing your work see real, readable code in PR diffs.",
  },
  {
    q: "Is there a free tier?",
    a: "Yes — Free is permanent. It includes the personal workspace, full AI stack (Ollama + pgvector + RAG + Companion), SHAP explainability, and joblib + FastAPI export, capped at 5 datasets, 3 pipelines, and 10 training runs per month. Paid tiers only unlock collaboration features and Docker export — the ML core is identical.",
  },
  {
    q: "How is data isolated between workspaces?",
    a: "Two-tier ACL. Personal workspaces are scoped to a single user; nothing is shared across users. Collaborator workspaces are scoped via a project_members table with three roles — Viewer, Editor, and Project Manager — enforced server-side on every request. Datasets and pipelines never cross workspace boundaries; Postgres schemas keep the separation watertight.",
  },
];

const FEATURES = [
  {
    num: "01",
    tag: "RAG",
    title: "100% Local GenAI & RAG",
    desc:
      "Chat with your documents via Ollama + pgvector. Embeddings, prompts, and answers stay on your machine — no OpenAI key, no cloud calls, no exfiltration.",
    viz: "rag" as const,
  },
  {
    num: "02",
    tag: "Training",
    title: "Real-Time Training Telemetry (Azure ML Style)",
    desc:
      "Watch your model train live. Stage labels, streaming loss/accuracy, and a confusion matrix that updates every epoch — over a Redis-backed SocketIO socket.",
    viz: "loss" as const,
  },
  {
    num: "03",
    tag: "Data",
    title: "Advanced Data Profiling & Outlier Detection",
    desc:
      "Z-score outlier detection, target imbalance alerts (with SMOTE suggestions), skewness analysis, and box & violin plots — generated the moment you upload.",
    viz: "profile" as const,
  },
  {
    num: "04",
    tag: "Copilot",
    title: "Context-Aware AI Companion",
    desc:
      "A floating copilot that knows what screen you're on. Ask 'which model fits this dataset?' or 'how do I balance my classes?' — answered locally by Llama 3.2.",
    viz: "chat" as const,
  },
  {
    num: "05",
    tag: "Explain",
    title: "Explainable AI (SHAP)",
    desc:
      "Every tree model ships with SHAP global importance, per-prediction force plots, and residual analysis — so stakeholders trust what the model says.",
    viz: "shap" as const,
  },
  {
    num: "06",
    tag: "Deploy",
    title: "Model Portability (Export & Run Anywhere)",
    desc:
      "Export trained models as joblib bundles with auto-generated FastAPI inference scripts. Deploy to localhost, Kubernetes, or an air-gapped edge device — identical runtime.",
    viz: "deploy" as const,
  },
];

// ────────────────────────────────────────────────────────────
// Hero pipeline canvas — animated SVG. No deps, no React state
// beyond a tick counter for the dashed flow lines.
// ────────────────────────────────────────────────────────────

const HERO_NODES = [
  { id: "src", x: 30, y: 70, w: 130, h: 50, label: "customers.csv", sub: "41,204 rows · 18 cols", kind: "source" as const },
  { id: "prof", x: 200, y: 30, w: 130, h: 50, label: "Profile", sub: "outliers · skew", kind: "step" as const },
  { id: "split", x: 200, y: 110, w: 130, h: 50, label: "Split", sub: "80/20 stratified", kind: "step" as const },
  { id: "enc", x: 370, y: 30, w: 130, h: 50, label: "Encode", sub: "one-hot · scale", kind: "step" as const },
  { id: "smote", x: 370, y: 110, w: 130, h: 50, label: "SMOTE", sub: "balance target", kind: "step" as const },
  { id: "model", x: 540, y: 70, w: 140, h: 50, label: "XGBoost", sub: "lr=0.05 · depth=6", kind: "model" as const },
  { id: "eval", x: 720, y: 70, w: 130, h: 50, label: "Evaluate", sub: "SHAP · conf.matrix", kind: "step" as const },
];

const HERO_EDGES: [string, string][] = [
  ["src", "prof"],
  ["src", "split"],
  ["prof", "enc"],
  ["split", "enc"],
  ["split", "smote"],
  ["enc", "model"],
  ["smote", "model"],
  ["model", "eval"],
];

const HeroPipelineCanvas = () => {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 90);
    return () => window.clearInterval(id);
  }, []);
  const byId = Object.fromEntries(HERO_NODES.map((n) => [n.id, n]));
  return (
    <svg viewBox="0 0 880 200" preserveAspectRatio="xMidYMid meet">
      {HERO_EDGES.map(([from, to], i) => {
        const a = byId[from];
        const b = byId[to];
        const x1 = a.x + a.w;
        const y1 = a.y + a.h / 2;
        const x2 = b.x;
        const y2 = b.y + b.h / 2;
        const cx = (x1 + x2) / 2;
        const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
        return (
          <g key={i}>
            <path d={d} fill="none" stroke="#c8c5b7" strokeWidth="1" />
            <path
              d={d}
              fill="none"
              stroke="#d2541c"
              strokeWidth="1.4"
              strokeDasharray="4 12"
              strokeDashoffset={-tick * 1.6}
              opacity="0.85"
            />
          </g>
        );
      })}
      {HERO_NODES.map((n) => {
        const isModel = n.kind === "model";
        const isSource = n.kind === "source";
        return (
          <g key={n.id}>
            <rect
              x={n.x}
              y={n.y}
              width={n.w}
              height={n.h}
              fill="#fafaf7"
              stroke={isModel ? "#d2541c" : "#d8d5c7"}
              strokeWidth={isModel ? 1.5 : 1}
              rx="2"
            />
            <text
              x={n.x + 10}
              y={n.y + 19}
              fontFamily="Inter, sans-serif"
              fontSize="11.5"
              fontWeight="600"
              fill="#0b0d0e"
            >
              {n.label}
            </text>
            <text
              x={n.x + 10}
              y={n.y + 35}
              fontFamily="JetBrains Mono, monospace"
              fontSize="9"
              fill="#6b6b63"
            >
              {n.sub}
            </text>
            {isSource && <circle cx={n.x + n.w - 10} cy={n.y + 11} r="3" fill="#2f6f3e" />}
            {isModel && (
              <circle cx={n.x + n.w - 10} cy={n.y + 11} r="3" fill="#d2541c" className="pulse-dot" />
            )}
          </g>
        );
      })}
      <text x="30" y="195" fontFamily="JetBrains Mono, monospace" fontSize="9" fill="#8a8a80">
        pipeline.yaml · 0 bytes uploaded · running on localhost
      </text>
    </svg>
  );
};

// ────────────────────────────────────────────────────────────
// Per-feature visualizations (small inline SVGs)
// ────────────────────────────────────────────────────────────

type VizKind = "rag" | "loss" | "profile" | "chat" | "shap" | "deploy";

const FeatViz = ({ kind }: { kind: VizKind }) => {
  if (kind === "loss") {
    const pts: [number, number][] = [];
    for (let i = 0; i < 50; i++) {
      const x = i / 49;
      const y = 0.85 * Math.exp(-x * 2.5) + 0.08 + Math.sin(i) * 0.03;
      pts.push([10 + x * 230, 8 + y * 60]);
    }
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    return (
      <svg viewBox="0 0 260 90" width="100%" height="90">
        {[0, 25, 50, 75].map((y) => (
          <line key={y} x1="10" x2="240" y1={10 + y * 0.7} y2={10 + y * 0.7} stroke="#e8e6dd" strokeWidth="0.5" />
        ))}
        <path d={d} fill="none" stroke="#d2541c" strokeWidth="1.4" />
        <path d={d + " L 240 72 L 10 72 Z"} fill="#d2541c" opacity="0.08" />
        <circle cx="240" cy={pts[49][1]} r="2.5" fill="#d2541c" />
        <text x="10" y="85" fontFamily="JetBrains Mono" fontSize="8" fill="#8a8a80">
          epoch 50 · loss 0.084 · val 0.091
        </text>
        <text x="244" y={pts[49][1] - 4} fontFamily="JetBrains Mono" fontSize="8" fill="#d2541c" textAnchor="end">
          ●LIVE
        </text>
      </svg>
    );
  }
  if (kind === "profile") {
    const cols = [
      { n: "age", type: "int", drift: 0.02, dist: [3, 6, 9, 14, 18, 16, 12, 8, 5, 3] },
      { n: "plan", type: "cat", drift: 0.18, dist: [20, 35, 18, 15, 12] },
      { n: "arpu", type: "flt", drift: 0.04, dist: [2, 5, 12, 18, 16, 14, 10, 7, 4, 2] },
      { n: "tenure", type: "int", drift: 0.11, dist: [25, 18, 14, 10, 8, 7, 6, 5, 4, 3] },
    ];
    return (
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, width: "100%" }}>
        {cols.map((c, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 22px 1fr 44px",
              gap: 6,
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <span style={{ color: "#2a2e31" }}>{c.n}</span>
            <span style={{ color: "#8a8a80" }}>{c.type}</span>
            <svg viewBox={`0 0 ${c.dist.length * 8} 14`} width="100%" height="14" preserveAspectRatio="none">
              {c.dist.map((v, j) => (
                <rect
                  key={j}
                  x={j * 8}
                  y={14 - v * 0.35}
                  width="6"
                  height={v * 0.35}
                  fill={c.drift > 0.1 ? "#d2541c" : "#2f6f3e"}
                  opacity="0.8"
                />
              ))}
            </svg>
            <span style={{ color: c.drift > 0.1 ? "#b94612" : "#2f6f3e", textAlign: "right" }}>
              z{(c.drift * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "shap") {
    const rows = [
      { n: "tenure", v: 0.42 },
      { n: "tickets", v: 0.28 },
      { n: "downgrades", v: 0.19 },
      { n: "nps", v: -0.14 },
      { n: "usage_idx", v: -0.09 },
    ];
    return (
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 9, width: "100%" }}>
        {rows.map((r, i) => (
          <div
            key={i}
            style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr 38px",
              gap: 6,
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <span style={{ color: "#2a2e31" }}>{r.n}</span>
            <div style={{ height: 10, background: "#ebeae3", position: "relative", borderRadius: 1 }}>
              <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "#d8d5c7" }} />
              <div
                style={{
                  position: "absolute",
                  top: 1,
                  bottom: 1,
                  [r.v > 0 ? "left" : "right"]: "50%",
                  width: `${(Math.abs(r.v) / 0.5) * 50}%`,
                  background: r.v > 0 ? "#d2541c" : "#2b5ea8",
                }}
              />
            </div>
            <span style={{ color: r.v > 0 ? "#b94612" : "#2b5ea8", textAlign: "right" }}>
              {r.v > 0 ? "+" : ""}
              {r.v.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (kind === "rag" || kind === "chat") {
    const isRag = kind === "rag";
    return (
      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 10, display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
        <div style={{ background: "#fafaf7", border: "1px solid #d8d5c7", padding: "5px 8px", borderRadius: 2, color: "#2a2e31" }}>
          <span style={{ color: "#8a8a80" }}>you ·</span>{" "}
          {isRag ? "Summarize Q4 churn drivers from the report." : "Why is row #8214 high-risk?"}
        </div>
        <div style={{ background: "#0b0d0e", color: "#d9d9d1", padding: "5px 8px", borderRadius: 2 }}>
          <span style={{ color: "#d2541c" }}>nocode ·</span>{" "}
          {isRag
            ? "Top drivers: contract type, monthly charges, support tickets (cited from q4_report.pdf p.12)."
            : "Short tenure (0.3σ below mean) + 4 support tickets in 30d. Cohort churns at 87%."}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", color: "#6b6b63", fontSize: 9 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2f6f3e" }} />
          llama3.2:3b · 0 tokens sent to cloud
        </div>
      </div>
    );
  }
  if (kind === "deploy") {
    return (
      <div
        style={{
          fontFamily: "JetBrains Mono, monospace",
          fontSize: 10,
          color: "#2a2e31",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          width: "100%",
        }}
      >
        <div>
          <span style={{ color: "#d2541c" }}>$</span> nocode export churn_v4 --format=joblib
        </div>
        <div style={{ color: "#6b6b63" }}>  → churn_v4.joblib · 12 MB · + main.py</div>
        <div>
          <span style={{ color: "#d2541c" }}>$</span> uvicorn main:app --host 0.0.0.0
        </div>
        <div style={{ color: "#2f6f3e" }}>  ✓ listening on :8000 · p50 4ms</div>
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          {["joblib", "fastapi", "docker", "edge"].map((t) => (
            <span
              key={t}
              style={{
                padding: "2px 6px",
                border: "1px solid #d8d5c7",
                borderRadius: 2,
                background: "#fafaf7",
                fontSize: 9,
                color: "#6b6b63",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="nav">
        <div className="wrap nav-inner">
          <div className="nav-left">
            <a href="#" className="nav-logo" onClick={(e) => e.preventDefault()}>
              <span className="nav-logo-mark">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="1" y="1" width="3" height="3" fill="#fafaf7" />
                  <rect x="6" y="1" width="3" height="3" fill="#d2541c" />
                  <rect x="1" y="6" width="3" height="3" fill="#d2541c" />
                  <rect x="6" y="6" width="3" height="3" fill="#fafaf7" />
                </svg>
              </span>
              NoCode AI
            </a>
            <div className="nav-links">
              <a href="#features">Platform</a>
              <a href="#flow">How it works</a>
              <a href="#pricing">Pricing</a>
              <a href="#faq">Docs</a>
            </div>
          </div>
          <div className="nav-right">
            <button className="btn btn-ghost" onClick={() => navigate("/login")}>
              Sign in
            </button>
            <button className="btn btn-primary" onClick={() => navigate("/register")}>
              Start free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="hero">
        <div className="wrap">
          <div className="hero-inner">
            <div className="hero-left">
              <div className="hero-eyebrow">100% Local AI · Your Data Never Leaves Your Machine</div>
              <h1>
                Build ML models <em>without writing code.</em>
              </h1>
              <p className="hero-sub">
                From CSV to a deployable model — with live training telemetry, document-grounded RAG, and a
                context-aware AI copilot. All running locally, on your hardware, with zero cloud dependencies.
              </p>
              <div className="hero-ctas">
                <button className="btn btn-primary" onClick={() => navigate("/register")}>
                  Start free
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5 H8 M5 2 L8 5 L5 8" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  </svg>
                </button>
                <button className="btn btn-ghost" onClick={() => navigate("/login")}>
                  Sign in
                </button>
              </div>
              <div className="hero-meta">
                <div>
                  <div className="hero-meta-k">Avg. time-to-model</div>
                  <div className="hero-meta-v">~5 min</div>
                  <div className="hero-meta-foot">first run, sample CSV</div>
                </div>
                <div>
                  <div className="hero-meta-k">Local LLM</div>
                  <div className="hero-meta-v">llama3.2</div>
                  <div className="hero-meta-foot">via Ollama, on your GPU</div>
                </div>
                <div>
                  <div className="hero-meta-k">Bytes sent to cloud</div>
                  <div className="hero-meta-v">0</div>
                  <div className="hero-meta-foot">verified by design</div>
                </div>
              </div>
            </div>
            <div className="hero-right">
              <div className="hero-canvas">
                <HeroPipelineCanvas />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── §00 Integrations ────────────────────────────── */}
      <section className="integrations">
        <div className="wrap">
          <div className="integ-head">
            <div className="eyebrow">§00 · Integrations</div>
            <div className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>
              all open-source · all running locally
            </div>
          </div>
          <div className="integ-intro">
            Every dependency runs in your Docker stack. No hidden API calls, no proxy servers, no telemetry —
            we ship the runtimes, you own the process.
          </div>
          <div className="integrations-grid">
            {INTEGRATIONS.map((g) => (
              <div key={g.title} className="integ-col">
                <h4>
                  {g.title} <span className="cnt">{g.items.length}</span>
                </h4>
                <div className="integ-list">
                  {g.items.map((i) => (
                    <div key={i.name} className="integ-item">
                      <div className="integ-logo">{i.mark}</div>
                      <span>{i.name}</span>
                      <span className="integ-meta">{i.meta}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── §01 Features ────────────────────────────────── */}
      <section className="features" id="features">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-num">§01</div>
            <h2>Six things every no-code ML platform should do — and most don't.</h2>
            <div className="sec-lede">
              We built NoCode AI for the data scientists who outgrew drag-and-drop SaaS but never wanted to
              maintain a notebook again. Every feature below is a thing we got wrong at previous jobs.
            </div>
          </div>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div key={f.num} className="feat">
                <div className="feat-hd">
                  <span className="feat-num">{f.num}</span>
                  <span className="feat-tag">{f.tag}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <div className="feat-viz">
                  <FeatViz kind={f.viz} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── §02 Architecture (full-bleed dark) ──────────── */}
      <section className="arch">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-num">§02</div>
            <h2>One Docker stack. Your machine. Nothing leaves.</h2>
            <div className="sec-lede">
              NoCode AI runs as a small set of containers on your hardware. No background daemons, no
              cloud sync, no telemetry. The only outbound request is the optional Hugging Face model
              pull on first run — which you can satisfy from a local mirror.
            </div>
          </div>
          <div className="arch-diagram">
            <ArchDiagram />
          </div>
          <div className="arch-stats">
            <div className="arch-stat">
              <div className="arch-stat-k">Outbound requests</div>
              <div className="arch-stat-v">0</div>
              <div className="arch-stat-foot">runtime · steady state</div>
            </div>
            <div className="arch-stat">
              <div className="arch-stat-k">Containers</div>
              <div className="arch-stat-v">8</div>
              <div className="arch-stat-foot">docker compose up</div>
            </div>
            <div className="arch-stat">
              <div className="arch-stat-k">Local LLM</div>
              <div className="arch-stat-v">llama3.2:3b</div>
              <div className="arch-stat-foot">on GTX 1660 Super 6GB</div>
            </div>
            <div className="arch-stat">
              <div className="arch-stat-k">Data egress</div>
              <div className="arch-stat-v">N/A</div>
              <div className="arch-stat-foot">data never transits</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── §03 Flow ────────────────────────────────────── */}
      <section className="flow" id="flow">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-num">§03</div>
            <h2>From raw CSV to a deployable model, in four steps.</h2>
            <div className="sec-lede">
              The whole loop runs on your machine. No login screens, no upload queues, no SaaS dashboards.
              Most first models are trained in under five minutes.
            </div>
          </div>
          <div className="flow-grid">
            <div className="flow-step">
              <div className="flow-step-hd">
                <span className="flow-num">01</span>
                <span className="flow-arrow">→</span>
              </div>
              <h3>Connect</h3>
              <p>
                Drop a CSV or wire a SQL connector. Profiling runs the moment your file lands —
                outliers, skew, target imbalance, leakage hints, all on disk.
              </p>
              <div className="flow-preview">
                <div><span className="accent">$</span> POST /api/datasets/upload</div>
                <div>  customers.csv (41,204 × 18)</div>
                <div className="ok">  ✓ profiled in 320 ms</div>
                <div className="ok">  ✓ outliers: 3 cols (z &gt; 3)</div>
                <div className="ok">  ✓ target imbalance: 18%</div>
              </div>
            </div>
            <div className="flow-step">
              <div className="flow-step-hd">
                <span className="flow-num">02</span>
                <span className="flow-arrow">→</span>
              </div>
              <h3>Shape</h3>
              <p>
                Drag nodes on the canvas — Dataset, Preprocess, Encode, Split, Train, Evaluate.
                For RAG: Document → VectorStore → RAGConfig. Same canvas, different graph.
              </p>
              <div className="flow-preview">
                <div>▸ DatasetNode · customers.csv</div>
                <div>▸ Preprocess · drop nulls</div>
                <div>▸ Encode · one-hot plan</div>
                <div>▸ Split · 80/20 stratified</div>
                <div className="accent">→ 32 features ready</div>
              </div>
            </div>
            <div className="flow-step">
              <div className="flow-step-hd">
                <span className="flow-num">03</span>
                <span className="flow-arrow">→</span>
              </div>
              <h3>Train</h3>
              <p>
                Pick an algorithm, hit Run. Loss, accuracy, and confusion matrix stream live over a
                Redis-backed SocketIO socket — Azure-ML-style telemetry, in your browser.
              </p>
              <div className="flow-preview">
                <div><span className="accent">▶</span> POST /api/pipelines/run</div>
                <div>  algo: XGBoost · 50 epochs</div>
                <div>  epoch 12/50 · acc 0.872</div>
                <div>  epoch 36/50 · acc 0.913</div>
                <div className="ok">  ✓ best AUC 0.941</div>
              </div>
            </div>
            <div className="flow-step">
              <div className="flow-step-hd">
                <span className="flow-num">04</span>
                <span className="flow-arrow">●</span>
              </div>
              <h3>Ship</h3>
              <p>
                Export as a joblib bundle with an auto-generated FastAPI inference script. Deploy
                anywhere — laptop, Docker, edge device — same runtime, identical predictions.
              </p>
              <div className="flow-preview">
                <div><span className="accent">$</span> GET /api/.../export/tabular</div>
                <div>  → churn_v4.joblib (12 MB)</div>
                <div>  → main.py (FastAPI)</div>
                <div>  → MODEL_CARD.md</div>
                <div className="ok">  ✓ run anywhere</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── §04 Demo (static mock — zero product imports) ── */}
      <section className="demo" id="demo">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-num">§04</div>
            <h2>A working model, explained — without leaving the app.</h2>
            <div className="sec-lede">
              This is the actual NoCode AI interface on a sample churn dataset. Predictions, SHAP
              feature contributions, and live telemetry — everything you'd normally need a notebook for.
            </div>
          </div>
          <div className="demo-frame">
            <div className="demo-top">
              <div className="demo-dots">
                <span style={{ background: "#e8615a" }} />
                <span style={{ background: "#e8b850" }} />
                <span style={{ background: "#6fae5a" }} />
              </div>
              <span>
                nocode · churn_v4 · <b style={{ color: "var(--ink)" }}>Personal workspace</b>
              </span>
              <div className="demo-tabs">
                <span className="demo-tab">overview</span>
                <span className="demo-tab active">explain</span>
                <span className="demo-tab">drift</span>
                <span className="demo-tab">deploy</span>
              </div>
            </div>
            <div className="demo-body">
              <aside className="demo-side">
                <h5>Models · 5</h5>
                {[
                  { n: "churn_v4", v: "AUC 0.941", active: true },
                  { n: "churn_v3", v: "AUC 0.917" },
                  { n: "ltv_regression", v: "MAE 42.1" },
                  { n: "fraud_bin", v: "F1 0.88" },
                  { n: "segment_kmeans", v: "k=8" },
                ].map((m) => (
                  <div key={m.n} className={"demo-model" + (m.active ? " active" : "")}>
                    <div className="demo-model-n">{m.n}</div>
                    <div className="demo-model-v">{m.v}</div>
                  </div>
                ))}
                <hr className="demo-rule" />
                <h5>Filters</h5>
                <div className="demo-filter-row">
                  <div>□ high-risk (p &gt; 0.7)</div>
                  <div>□ long-tenure (&gt; 24m)</div>
                  <div>☑ collaborator workspace</div>
                  <div>□ flagged by companion</div>
                </div>
              </aside>

              <main className="demo-main">
                <div className="demo-main-hd">
                  <div>
                    <div className="demo-main-eyebrow">Prediction · row 8214</div>
                    <div className="demo-main-title">
                      Will churn · <span className="v">0.87</span>
                    </div>
                  </div>
                  <div className="demo-pager">
                    <button>← prev</button>
                    <button>next →</button>
                  </div>
                </div>

                <div className="demo-shap-card">
                  <h6>Feature contributions (SHAP)</h6>
                  {[
                    { n: "tenure_months=3", v: 0.34, desc: "short tenure" },
                    { n: "support_tickets_30d=4", v: 0.22, desc: "above p95 cohort" },
                    { n: "plan=basic", v: 0.11, desc: "basic plan ↑ risk" },
                    { n: "nps_score=6", v: 0.08, desc: "detractor band" },
                    { n: "feature_usage_idx=0.21", v: -0.06, desc: "mild protective" },
                    { n: "billing_failures=0", v: -0.04, desc: "none in 30d" },
                  ].map((f, i) => {
                    const positive = f.v > 0;
                    const widthPct = (Math.abs(f.v) / 0.4) * 50;
                    const color = positive ? "#d2541c" : "#2b5ea8";
                    return (
                      <div key={i} className="demo-shap-row">
                        <span className="demo-shap-feat">{f.n}</span>
                        <div className="demo-shap-bar">
                          <div className="mid" />
                          <div
                            className="fill"
                            style={{
                              [positive ? "left" : "right"]: "50%",
                              width: `${widthPct}%`,
                              background: color,
                            }}
                          />
                        </div>
                        <span
                          className="demo-shap-val"
                          style={{ color: positive ? "var(--accent-ink)" : "var(--info)" }}
                        >
                          {positive ? "+" : ""}
                          {f.v.toFixed(2)}
                        </span>
                        <span className="demo-shap-desc">{f.desc}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="demo-callout">
                  <span className="accent">companion ›</span> Row 8214 matches the{" "}
                  <b>"short-tenure-high-support"</b> cohort (n=412). 87% of this cohort churned within
                  60 days in historical data. Suggested action: proactive CSM outreach + free plan trial.
                </div>
              </main>

              <aside className="demo-right">
                <h5>Run telemetry</h5>
                {[
                  { k: "AUC", v: "0.941", d: "+0.024", up: true },
                  { k: "Precision", v: "0.89", d: "+0.03", up: true },
                  { k: "Recall", v: "0.87", d: "−0.01", up: false },
                  { k: "F1", v: "0.88", d: "+0.02", up: true },
                ].map((m) => (
                  <div key={m.k} className="demo-metric">
                    <div>
                      <div className="demo-metric-k">{m.k}</div>
                      <div className="demo-metric-v">{m.v}</div>
                    </div>
                    <div className={m.up ? "demo-metric-d up" : "demo-metric-d down"}>{m.d}</div>
                  </div>
                ))}
                <div className="demo-sweep-label">Last 50 epochs</div>
                <div className="demo-sweep" />
                <div className="demo-status">
                  <span className="dot" />
                  running locally · 0 egress
                </div>
              </aside>
            </div>
          </div>
        </div>
      </section>

      {/* ── §05 Testimonials ────────────────────────────── */}
      <section className="testi">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-num">§05</div>
            <h2>Teams that traded dashboards for a Docker stack.</h2>
            <div className="sec-lede">
              NoCode AI is used by data teams who can't (or won't) ship customer data to a third-party
              ML platform — hospitals, banks, research labs, and security-conscious startups.
            </div>
          </div>
          <div className="testi-grid">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="testi-card">
                <p className="testi-quote">{t.quote}</p>
                <div className="testi-author">
                  <div className="testi-avatar">{t.avatar}</div>
                  <div className="testi-who">
                    <div className="name">{t.name}</div>
                    <div className="role">{t.role}</div>
                  </div>
                </div>
                <div className="testi-meta">
                  {t.meta.map((m) => (
                    <div key={m.k}>
                      <span>{m.k}:</span> <b>{m.v}</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── §06 Pricing ─────────────────────────────────── */}
      <section className="pricing" id="pricing">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-num">§06</div>
            <h2>Priced per workspace, not per prediction.</h2>
            <div className="sec-lede">
              No inference fees, no GPU-hour surprises, no egress charges — because there is no egress.
              The full ML and AI stack is in every tier; paid tiers add collaboration and Docker export.
            </div>
          </div>
          <div className="pricing-table">
            <div className="pt-head">
              <div className="pt-th intro">
                <h4>Every tier ships the full stack.</h4>
                <p>You only pay for collaboration and deploy features — the ML stays free.</p>
              </div>
              {PRICING_TIERS.map((t) => (
                <div key={t.name} className={"pt-th" + (t.featured ? " featured" : "")}>
                  {t.featured && <span className="pt-badge">Most popular</span>}
                  <span className="pt-name">{t.name}</span>
                  <div>
                    <span className="pt-price">
                      {t.price}
                      <small>{t.per}</small>
                    </span>
                  </div>
                  <p className="pt-desc">{t.desc}</p>
                  <button
                    className={t.featured ? "btn btn-accent" : "btn btn-ghost"}
                    onClick={() => navigate(t.ctaTo)}
                  >
                    {t.cta}
                  </button>
                </div>
              ))}
            </div>
            {PRICING_ROWS.map((r, i) => {
              if ("sec" in r) {
                return (
                  <div key={i} className="pt-section-row">
                    <div className="cell">{r.sec}</div>
                    <div className="cell" />
                    <div className="cell" />
                    <div className="cell" />
                  </div>
                );
              }
              return (
                <div key={i} className="pt-row">
                  <div className="cell label">
                    <span>{r.l}</span>
                    {r.hint && <span className="hint">· {r.hint}</span>}
                  </div>
                  {r.vals.map((v, j) => (
                    <div
                      key={j}
                      className={
                        "cell val" + (v === "✓" ? " check" : v === "—" ? " dash" : "")
                      }
                    >
                      {v}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── §07 FAQ ─────────────────────────────────────── */}
      <FAQSection />

      {/* ── Footer (dark) ───────────────────────────────── */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <h4>
                <span className="foot-mark">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <rect x="1" y="1" width="3" height="3" fill="#fafaf7" />
                    <rect x="6" y="1" width="3" height="3" fill="#d2541c" />
                    <rect x="1" y="6" width="3" height="3" fill="#d2541c" />
                    <rect x="6" y="6" width="3" height="3" fill="#fafaf7" />
                  </svg>
                </span>
                NoCode AI Platform
              </h4>
              <p>
                Local-first ML and GenAI, without the notebooks. Built as a PFE end-of-studies project —
                100% open architecture, 0% cloud dependency.
              </p>
              <div className="foot-cta-row">
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-accent"
                >
                  View on GitHub
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 5 H8 M5 2 L8 5 L5 8"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      fill="none"
                    />
                  </svg>
                </a>
                <span className="foot-os">Linux · macOS · Windows (via Docker)</span>
              </div>
            </div>
            <div className="foot-col">
              <h5>Product</h5>
              <ul>
                <li><a href="#features">Platform</a></li>
                <li><a href="#flow">How it works</a></li>
                <li><a href="#demo">Live demo</a></li>
                <li><a href="#pricing">Pricing</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>
            <div className="foot-col">
              <h5>Resources</h5>
              <ul>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Documentation</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Examples</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Model cards</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Architecture</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Changelog</a></li>
              </ul>
            </div>
            <div className="foot-col">
              <h5>Company</h5>
              <ul>
                <li><a href="#" onClick={(e) => e.preventDefault()}>About</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Security</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Contact</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>PFE thesis</a></li>
              </ul>
            </div>
            <div className="foot-col">
              <h5>Legal</h5>
              <ul>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Privacy</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Terms</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Licenses</a></li>
                <li><a href="#" onClick={(e) => e.preventDefault()}>Trust</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bot">
            <div className="l">
              <span>© {new Date().getFullYear()} NoCode AI Platform</span>
              <span className="foot-status">
                <span className="dot" />
                All services running
              </span>
              <span>v0.5 · sprint 5</span>
            </div>
            <div className="l">
              <a href="#" onClick={(e) => e.preventDefault()}>GitHub</a>
              <a href="#" onClick={(e) => e.preventDefault()}>Docs</a>
              <a href="#" onClick={(e) => e.preventDefault()}>RSS</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// §07 FAQ — accordion with single-open behavior. Pulled out as
// its own component so the page-level useNavigate stays clean.
// ────────────────────────────────────────────────────────────

const FAQSection = () => {
  const [open, setOpen] = useState<number>(0);
  return (
    <section className="faq" id="faq">
      <div className="wrap">
        <div className="sec-head">
          <div className="sec-num">§07</div>
          <h2>Questions you'd ask a sales engineer.</h2>
          <div className="sec-lede">
            If yours isn't here, the answer is probably in the architecture diagram above —
            or open a GitHub issue and we'll add it.
          </div>
        </div>
        <div className="faq-list">
          {FAQ_ITEMS.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={i} className="faq-item">
                <button
                  type="button"
                  className="faq-q"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  aria-expanded={isOpen}
                >
                  <span className="faq-q-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="faq-q-t">{it.q}</span>
                  <span className="faq-q-i">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && (
                  <div className="faq-a">
                    <div className="faq-a-c">{it.a}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// ────────────────────────────────────────────────────────────
// §02 Architecture diagram — single static SVG that maps our
// real Docker compose stack (8 containers) inside the
// "Your Machine" boundary, with "The Internet" panel dimmed
// outside it. No animation; one render, zero state.
// ────────────────────────────────────────────────────────────

const ArchDiagram = () => (
  <svg viewBox="0 0 1100 380" preserveAspectRatio="xMidYMid meet">
    {/* Machine boundary */}
    <rect
      x="20"
      y="20"
      width="800"
      height="340"
      rx="4"
      fill="none"
      stroke="#d2541c"
      strokeWidth="1"
      strokeDasharray="4 3"
    />
    <text x="36" y="40" fontFamily="JetBrains Mono" fontSize="10" fill="#d2541c" letterSpacing="1">
      YOUR MACHINE · localhost · docker compose up
    </text>

    {/* Frontend tile (top-left) */}
    <rect x="50" y="60" width="220" height="56" rx="3" fill="#1a1d1f" stroke="#2a2e31" />
    <text x="64" y="80" fontFamily="JetBrains Mono" fontSize="10" fill="#8a8a80">
      FRONTEND
    </text>
    <g>
      <circle cx="68" cy="96" r="2" fill="#2f6f3e" />
      <text x="78" y="99" fontFamily="JetBrains Mono" fontSize="10" fill="#d9d9d1">
        Vite + React 18 · :5173
      </text>
    </g>

    {/* Backend services tile */}
    <rect x="50" y="130" width="220" height="160" rx="3" fill="#2a2e31" stroke="#2a2e31" />
    <text x="64" y="150" fontFamily="JetBrains Mono" fontSize="10" fill="#d2541c">
      BACKEND · 4 flask + 1 celery
    </text>
    {[
      { y: 172, l: "API Gateway · :8000" },
      { y: 192, l: "Auth Service · :8001" },
      { y: 212, l: "Data Ingestion · :8002" },
      { y: 232, l: "ML Training · :8003" },
      { y: 256, l: "Celery Worker · async" },
    ].map((r) => (
      <g key={r.y}>
        <circle cx="68" cy={r.y} r="2" fill="#2f6f3e" />
        <text x="78" y={r.y + 3} fontFamily="JetBrains Mono" fontSize="10" fill="#d9d9d1">
          {r.l}
        </text>
      </g>
    ))}
    <text x="64" y="278" fontFamily="JetBrains Mono" fontSize="9" fill="#8a8a80">
      CORS-locked · JWT-gated
    </text>

    {/* Storage tile */}
    <rect x="320" y="60" width="220" height="160" rx="3" fill="#1a1d1f" stroke="#2a2e31" />
    <text x="334" y="80" fontFamily="JetBrains Mono" fontSize="10" fill="#8a8a80">
      STORAGE · on-disk volumes
    </text>
    {[
      { y: 102, l: "Postgres + pgvector · :5432" },
      { y: 122, l: "MongoDB · :27017" },
      { y: 142, l: "Redis · :6379 (broker + mq)" },
      { y: 168, l: "/var/lib/postgresql/data" },
      { y: 188, l: "/data/db · /data/uploads" },
    ].map((r, i) => (
      <g key={r.y}>
        <circle cx="338" cy={r.y} r="2" fill={i < 3 ? "#2f6f3e" : "#b8851a"} />
        <text x="348" y={r.y + 3} fontFamily="JetBrains Mono" fontSize="10" fill="#d9d9d1">
          {r.l}
        </text>
      </g>
    ))}

    {/* AI runtime tile */}
    <rect x="320" y="230" width="220" height="60" rx="3" fill="#1a1d1f" stroke="#d2541c" />
    <text x="334" y="250" fontFamily="JetBrains Mono" fontSize="10" fill="#d2541c">
      AI RUNTIME · subprocess
    </text>
    <g>
      <circle cx="338" cy="266" r="2" fill="#d2541c" />
      <text x="348" y="269" fontFamily="JetBrains Mono" fontSize="10" fill="#d9d9d1">
        Ollama · llama3.2:3b · :11434
      </text>
    </g>
    <text x="348" y="284" fontFamily="JetBrains Mono" fontSize="9" fill="#8a8a80">
      GTX 1660 Super · 6 GB VRAM
    </text>

    {/* Your Data tile */}
    <rect x="590" y="60" width="210" height="230" rx="3" fill="#1a1d1f" stroke="#2a2e31" />
    <text x="604" y="80" fontFamily="JetBrains Mono" fontSize="10" fill="#8a8a80">
      YOUR DATA · mounted
    </text>
    {[
      { y: 104, l: "Local CSV · parquet" },
      { y: 124, l: "Postgres (SQL connector)" },
      { y: 144, l: "MongoDB (collections)" },
      { y: 164, l: "Uploaded documents (RAG)" },
      { y: 184, l: "Vector embeddings (pgvector)" },
    ].map((r) => (
      <g key={r.y}>
        <circle cx="608" cy={r.y} r="2" fill="#b8851a" />
        <text x="618" y={r.y + 3} fontFamily="JetBrains Mono" fontSize="10" fill="#d9d9d1">
          {r.l}
        </text>
      </g>
    ))}
    <text x="604" y="270" fontFamily="JetBrains Mono" fontSize="9" fill="#8a8a80">
      streams in · never copied out
    </text>

    {/* Connections — local traffic */}
    <line x1="270" y1="88" x2="320" y2="140" stroke="#d2541c" strokeWidth="1" />
    <line x1="270" y1="210" x2="320" y2="140" stroke="#d2541c" strokeWidth="1" />
    <line x1="270" y1="256" x2="320" y2="260" stroke="#d2541c" strokeWidth="1" />
    <line x1="540" y1="170" x2="590" y2="170" stroke="#d2541c" strokeWidth="1" strokeDasharray="2 2" />

    {/* Cloud (outside boundary) */}
    <g opacity="0.55">
      <rect
        x="850"
        y="100"
        width="230"
        height="180"
        rx="3"
        fill="none"
        stroke="#3a3e41"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
      <text x="864" y="122" fontFamily="JetBrains Mono" fontSize="10" fill="#6b6b63">
        THE INTERNET
      </text>
      <text x="864" y="146" fontFamily="JetBrains Mono" fontSize="10" fill="#6b6b63">
        No connections established.
      </text>
      <line x1="864" y1="160" x2="1066" y2="160" stroke="#3a3e41" strokeWidth="0.5" />
      <text x="864" y="180" fontFamily="JetBrains Mono" fontSize="9" fill="#6b6b63">
        (opt-in: HF model pull on first run)
      </text>
      <text x="864" y="196" fontFamily="JetBrains Mono" fontSize="9" fill="#6b6b63">
        (opt-in: pip / npm install)
      </text>
      <text x="864" y="226" fontFamily="JetBrains Mono" fontSize="9" fill="#6b6b63">
        (no telemetry, ever)
      </text>
      <text x="864" y="246" fontFamily="JetBrains Mono" fontSize="9" fill="#6b6b63">
        (no usage analytics)
      </text>
    </g>

    {/* Legend */}
    <g transform="translate(40, 360)">
      <rect x="0" y="-10" width="10" height="10" fill="#d2541c" />
      <text x="16" y="-2" fontFamily="JetBrains Mono" fontSize="9" fill="#b9b9b1">
        local container traffic
      </text>
      <rect x="170" y="-10" width="10" height="10" fill="none" stroke="#d2541c" strokeDasharray="2 2" />
      <text x="186" y="-2" fontFamily="JetBrains Mono" fontSize="9" fill="#b9b9b1">
        read-only mounts
      </text>
      <rect x="320" y="-10" width="10" height="10" fill="none" stroke="#3a3e41" strokeDasharray="2 2" />
      <text x="336" y="-2" fontFamily="JetBrains Mono" fontSize="9" fill="#b9b9b1">
        no egress
      </text>
    </g>
  </svg>
);
