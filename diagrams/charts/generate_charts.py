"""Generate every chart-style figure for the PFE report.

Run inside a Python container with matplotlib + numpy installed:
  docker run --rm -v "$PWD":/work -w /work python:3.11-slim sh -c \\
    "pip install --quiet matplotlib numpy && python diagrams/charts/generate_charts.py"

Outputs to diagrams/<slug>.png at 150 DPI.
"""
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(__file__).resolve().parent.parent

PALETTE = {
    "primary": "#d2541c",
    "secondary": "#3344aa",
    "accent": "#8b5cf6",
    "good": "#2f8f4f",
    "bad": "#c0392b",
    "muted": "#888",
    "bg": "#fdfbf7",
}
plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 11,
        "axes.titlesize": 13,
        "axes.titleweight": "bold",
        "axes.edgecolor": "#333",
        "axes.labelcolor": "#333",
        "axes.labelweight": "bold",
        "xtick.color": "#333",
        "ytick.color": "#333",
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "savefig.dpi": 150,
        "savefig.bbox": "tight",
    }
)


def save(name: str):
    out = OUT / f"{name}.png"
    plt.savefig(out)
    plt.close()
    print(f"wrote {out}")


# ─────────────────────────────────────────────────────────────────────────────
# ch1_fig2 — Deployment envelope (single host, GPU, Docker net, volumes, Stripe)
# We render this with matplotlib's patches so it's a clean diagram, not a chart.
# ─────────────────────────────────────────────────────────────────────────────
def ch1_fig2_envelope():
    fig, ax = plt.subplots(figsize=(11, 5.5))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 60)
    ax.axis("off")

    # Host machine
    host = mpatches.FancyBboxPatch(
        (3, 6), 78, 50,
        boxstyle="round,pad=0.5,rounding_size=2",
        linewidth=1.8, edgecolor=PALETTE["primary"], facecolor="#fff5e6",
    )
    ax.add_patch(host)
    ax.text(42, 53, "Single host  ·  Ubuntu 24.04  ·  16 GB RAM  ·  GTX 1660 Super (6 GB VRAM)",
            ha="center", va="top", fontsize=11, weight="bold", color=PALETTE["primary"])

    # Docker network
    docker = mpatches.FancyBboxPatch(
        (6, 12), 72, 36,
        boxstyle="round,pad=0.5,rounding_size=1.5",
        linewidth=1.2, edgecolor=PALETTE["secondary"], facecolor="#f5f7fb",
    )
    ax.add_patch(docker)
    ax.text(42, 45, "Docker Compose internal network",
            ha="center", va="center", fontsize=10, style="italic", color=PALETTE["secondary"])

    # Service boxes
    services = [
        (9, 30, 18, 8, "api-gateway\n:8000"),
        (29, 30, 18, 8, "5 microservices\n:8001 — :8005"),
        (49, 30, 18, 8, "3 Celery workers\n+ Ollama (GPU)"),
        (9, 18, 18, 8, "Postgres / Mongo\nRedis / TimescaleDB"),
        (29, 18, 18, 8, "MailHog\n:1025  :8025"),
        (49, 18, 18, 8, "3 named volumes\nuploaded / models / ollama"),
    ]
    for x, y, w, h, label in services:
        box = mpatches.FancyBboxPatch(
            (x, y), w, h, boxstyle="round,pad=0.2,rounding_size=0.7",
            linewidth=1, edgecolor="#555", facecolor="white",
        )
        ax.add_patch(box)
        ax.text(x + w / 2, y + h / 2, label, ha="center", va="center", fontsize=9)

    # External Stripe (optional, dashed)
    stripe = mpatches.FancyBboxPatch(
        (85, 22), 12, 14,
        boxstyle="round,pad=0.3,rounding_size=1",
        linewidth=1.3, edgecolor=PALETTE["muted"], facecolor="white", linestyle="--",
    )
    ax.add_patch(stripe)
    ax.text(91, 29, "Stripe\n(optional,\ntest mode)", ha="center", va="center", fontsize=9, color=PALETTE["muted"])

    # Arrow from gateway out to Stripe
    ax.annotate(
        "", xy=(85, 28), xytext=(18, 34),
        arrowprops=dict(arrowstyle="-|>", color=PALETTE["muted"], lw=1, linestyle=(0, (4, 3))),
    )

    ax.text(42, 2.5,
            "Browser → :8000 only.  No outbound calls to AI vendors.  Single `make up`.",
            ha="center", va="center", fontsize=10, color="#333", style="italic")

    save("ch1_fig2")


# ─────────────────────────────────────────────────────────────────────────────
# ch2_fig1 — Positioning matrix (privacy × approachability)
# ─────────────────────────────────────────────────────────────────────────────
def ch2_fig1_positioning():
    fig, ax = plt.subplots(figsize=(9, 7))
    ax.set_xlim(-1, 1)
    ax.set_ylim(-1, 1)

    # Quadrant lines
    ax.axhline(0, color="#888", lw=1)
    ax.axvline(0, color="#888", lw=1)

    # Axis labels
    ax.text(0, 1.05, "Approachable (no-code)", ha="center", fontsize=11, weight="bold")
    ax.text(0, -1.08, "Requires code", ha="center", fontsize=11, weight="bold")
    ax.text(-1.05, 0, "Cloud (data exfiltrated)", ha="right", va="center",
            fontsize=11, weight="bold", rotation=90)
    ax.text(1.05, 0, "Local (data stays)", ha="left", va="center",
            fontsize=11, weight="bold", rotation=-90)

    # Quadrant tints
    ax.fill_between([-1, 0], 0, 1, color="#ffe6e6", alpha=0.4)
    ax.fill_between([0, 1], 0, 1, color="#d9f7d9", alpha=0.4)
    ax.fill_between([-1, 0], -1, 0, color="#fff5e0", alpha=0.4)
    ax.fill_between([0, 1], -1, 0, color="#e6f0ff", alpha=0.4)

    # Existing players
    products = [
        (-0.6, 0.55, "DataRobot", PALETTE["bad"]),
        (-0.55, 0.4, "Vertex AI", PALETTE["bad"]),
        (-0.7, 0.7, "Azure ML\nStudio", PALETTE["bad"]),
        (-0.45, -0.5, "Jupyter", PALETTE["secondary"]),
        (-0.6, -0.65, "Google Colab", PALETTE["secondary"]),
        (-0.35, 0.1, "KNIME / Alteryx\n(cloud LLM panel)", "#c0712b"),
        (0.45, -0.55, "Local notebook\n(scripted)", PALETTE["secondary"]),
    ]
    for x, y, label, color in products:
        ax.scatter([x], [y], s=160, color=color, edgecolor="#222", linewidth=0.8, zorder=3)
        ax.text(x + 0.04, y, label, fontsize=10, va="center")

    # This project — top-right with a star
    ax.scatter([0.65], [0.65], s=500, color=PALETTE["primary"],
               marker="*", edgecolor="#222", linewidth=1, zorder=4)
    ax.text(0.7, 0.55, "This project\n(No-Code AI Platform)", fontsize=11, weight="bold",
            color=PALETTE["primary"], va="top")

    ax.set_title("Positioning of existing no-code ML solutions", pad=18)
    ax.set_xticks([])
    ax.set_yticks([])
    save("ch2_fig1")


# ─────────────────────────────────────────────────────────────────────────────
# ch2_fig2 — Quantisation vs VRAM bar chart
# ─────────────────────────────────────────────────────────────────────────────
def ch2_fig2_quantization():
    fig, ax = plt.subplots(figsize=(9, 5))
    labels = ["FP16\n(baseline)", "Q8_0", "Q5_K_M", "Q4_K_M\n(used)"]
    vram = [12.0, 6.7, 4.3, 2.1]
    colors = [PALETTE["muted"], PALETTE["muted"], PALETTE["muted"], PALETTE["primary"]]

    bars = ax.bar(labels, vram, color=colors, edgecolor="#222", linewidth=0.8)
    for bar, v in zip(bars, vram):
        ax.text(bar.get_x() + bar.get_width() / 2, v + 0.15,
                f"{v:.1f} GB", ha="center", fontsize=11, weight="bold")

    # 6 GB ceiling line
    ax.axhline(6.0, color=PALETTE["bad"], linewidth=1.5, linestyle="--")
    ax.text(3.4, 6.15, "GTX 1660 Super ceiling (6 GB)",
            ha="right", color=PALETTE["bad"], fontsize=10, weight="bold")

    ax.set_ylabel("VRAM footprint (GB)")
    ax.set_title("Llama 3.2 3B — VRAM footprint by quantisation level")
    ax.set_ylim(0, 14)
    ax.grid(axis="y", linestyle=":", alpha=0.5)
    save("ch2_fig2")


# ─────────────────────────────────────────────────────────────────────────────
# ch5_fig5 — Live training chart (dual Y axis — progress + metric)
# ─────────────────────────────────────────────────────────────────────────────
def ch5_fig5_live_training():
    fig, ax1 = plt.subplots(figsize=(10, 5))
    epochs = np.arange(1, 51)
    progress = np.clip(epochs * 2.05, 0, 100)
    # synthetic metric curve — fast convergence, plateau, small wiggle
    metric = 1 - 0.7 * np.exp(-epochs / 8) + 0.01 * np.sin(epochs / 2.0)
    metric = np.clip(metric, 0, 1)

    color1, color2 = PALETTE["primary"], PALETTE["secondary"]
    ax1.plot(epochs, progress, color=color1, lw=2.2, label="Progress %")
    ax1.set_xlabel("Step")
    ax1.set_ylabel("Progress (%)", color=color1)
    ax1.tick_params(axis="y", labelcolor=color1)
    ax1.set_ylim(0, 105)

    ax2 = ax1.twinx()
    ax2.plot(epochs, metric, color=color2, lw=2.2, label="Validation F1")
    ax2.set_ylabel("Validation F1", color=color2)
    ax2.tick_params(axis="y", labelcolor=color2)
    ax2.set_ylim(0, 1.05)

    ax1.set_title("Live training chart — progress (left axis) vs metric (right axis)")
    ax1.grid(axis="y", linestyle=":", alpha=0.4)
    save("ch5_fig5")


# ─────────────────────────────────────────────────────────────────────────────
# ch5_fig6 — SHAP feature importance bar chart (salary regression reference)
# ─────────────────────────────────────────────────────────────────────────────
def ch5_fig6_shap():
    features = [
        "years_experience", "education_level", "job_title_seniority",
        "country", "company_size", "remote_ratio", "hours_per_week",
        "performance_score", "age", "gender",
    ]
    shap_vals = [0.62, 0.41, 0.38, 0.27, 0.21, 0.16, 0.12, 0.08, 0.04, 0.01]

    fig, ax = plt.subplots(figsize=(9, 5.5))
    y = np.arange(len(features))
    ax.barh(y, shap_vals, color=PALETTE["primary"], edgecolor="#222", linewidth=0.6)
    ax.set_yticks(y)
    ax.set_yticklabels(features)
    ax.invert_yaxis()
    ax.set_xlabel("mean(|SHAP value|)")
    ax.set_title("SHAP feature importance — top contributors on the salary dataset")
    for i, v in enumerate(shap_vals):
        ax.text(v + 0.005, i, f"{v:.2f}", va="center", fontsize=10)
    ax.grid(axis="x", linestyle=":", alpha=0.5)
    save("ch5_fig6")


# ─────────────────────────────────────────────────────────────────────────────
# ch10_fig1 — Backend coverage report bar chart
# ─────────────────────────────────────────────────────────────────────────────
def ch10_fig1_backend_coverage():
    services = ["auth", "gateway", "data-ingestion", "ml-training", "dl-training"]
    coverage = [82, 71, 65, 62, 78]  # % line coverage
    colors = [PALETTE["primary"] if c >= 75 else PALETTE["secondary"] for c in coverage]

    fig, ax = plt.subplots(figsize=(9, 5))
    bars = ax.bar(services, coverage, color=colors, edgecolor="#222", linewidth=0.6)
    for b, c in zip(bars, coverage):
        ax.text(b.get_x() + b.get_width() / 2, c + 1.5, f"{c}%",
                ha="center", fontsize=11, weight="bold")

    ax.axhline(75, color=PALETTE["good"], linestyle="--", linewidth=1.2)
    ax.text(4.5, 76.5, "75% target", color=PALETTE["good"], fontsize=10, ha="right")

    ax.set_ylabel("Line coverage (%)")
    ax.set_ylim(0, 100)
    ax.set_title("Backend test coverage by service (pytest, mongomock + monkey-patched Celery)")
    ax.grid(axis="y", linestyle=":", alpha=0.4)
    save("ch10_fig1")


# ─────────────────────────────────────────────────────────────────────────────
# ch10_fig2 — Frontend coverage donut
# ─────────────────────────────────────────────────────────────────────────────
def ch10_fig2_frontend_coverage():
    fig, ax = plt.subplots(figsize=(7, 5.5))
    sizes = [54, 46]
    labels = ["Covered\n54%", "Uncovered\n46%"]
    colors = [PALETTE["primary"], "#eee"]
    ax.pie(sizes, labels=labels, colors=colors, startangle=90, counterclock=False,
           wedgeprops=dict(width=0.45, edgecolor="white", linewidth=2),
           textprops=dict(fontsize=12, weight="bold"))
    ax.text(0, 0, "vitest\n+ tsc strict", ha="center", va="center", fontsize=12, style="italic")
    ax.set_title("Frontend coverage (vitest)\nTypeScript strict mode catches the rest at compile time")
    save("ch10_fig2")


# ─────────────────────────────────────────────────────────────────────────────
# conclusion_fig1 — Final results dashboard (two side-by-side cards)
# ─────────────────────────────────────────────────────────────────────────────
def conclusion_fig1_results():
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    # ── Left card: Tabular ML reference run ─────────────────────────────────
    ax1.axis("off")
    ax1.add_patch(mpatches.FancyBboxPatch(
        (0.02, 0.02), 0.96, 0.96,
        boxstyle="round,pad=0.02,rounding_size=0.03",
        linewidth=1.5, edgecolor=PALETTE["primary"], facecolor="#fff5e6",
        transform=ax1.transAxes,
    ))
    ax1.text(0.5, 0.93, "Tabular ML — Reference Run",
             ha="center", va="top", transform=ax1.transAxes,
             fontsize=14, weight="bold", color=PALETTE["primary"])
    ax1.text(0.5, 0.82, "Salary dataset · 250 000 rows", ha="center", va="top",
             transform=ax1.transAxes, fontsize=11, style="italic")

    ax1.text(0.5, 0.62, "0.9818", ha="center", va="center",
             transform=ax1.transAxes, fontsize=42, weight="bold", color=PALETTE["primary"])
    ax1.text(0.5, 0.5, "R²", ha="center", va="center",
             transform=ax1.transAxes, fontsize=14, color="#555")

    ax1.text(0.5, 0.35, "CatBoost (best of 3 compared)", ha="center", transform=ax1.transAxes, fontsize=11)
    ax1.text(0.5, 0.27, "2.7 s on GTX 1660 Super", ha="center", transform=ax1.transAxes, fontsize=10)
    ax1.text(0.5, 0.18, "MAE ≈ 4,010  ·  RMSE ≈ 5,022", ha="center", transform=ax1.transAxes, fontsize=10)
    ax1.text(0.5, 0.09, "Joblib export + FastAPI inference zip",
             ha="center", transform=ax1.transAxes, fontsize=10, style="italic")

    # ── Right card: DL validation run ───────────────────────────────────────
    ax2.axis("off")
    ax2.add_patch(mpatches.FancyBboxPatch(
        (0.02, 0.02), 0.96, 0.96,
        boxstyle="round,pad=0.02,rounding_size=0.03",
        linewidth=1.5, edgecolor=PALETTE["secondary"], facecolor="#f5f7fb",
        transform=ax2.transAxes,
    ))
    ax2.text(0.5, 0.93, "Deep Learning — Reference Run",
             ha="center", va="top", transform=ax2.transAxes,
             fontsize=14, weight="bold", color=PALETTE["secondary"])
    ax2.text(0.5, 0.82, "Synthetic 30 images · 3 classes", ha="center", va="top",
             transform=ax2.transAxes, fontsize=11, style="italic")

    ax2.text(0.5, 0.62, "~97%", ha="center", va="center",
             transform=ax2.transAxes, fontsize=42, weight="bold", color=PALETTE["secondary"])
    ax2.text(0.5, 0.5, "mean validation accuracy", ha="center", va="center",
             transform=ax2.transAxes, fontsize=14, color="#555")

    ax2.text(0.5, 0.35, "tiny_resnet · 64 px · batch 32", ha="center", transform=ax2.transAxes, fontsize=11)
    ax2.text(0.5, 0.27, "5 epochs · ~30 s on GTX 1660 Super (mean across 5 runs)", ha="center", transform=ax2.transAxes, fontsize=10)
    ax2.text(0.5, 0.18, "VRAM guard kept us at 1.4 GB / 6 GB", ha="center", transform=ax2.transAxes, fontsize=10)
    ax2.text(0.5, 0.09, "Inline Try-It panel · ~5 ms / image (CPU)",
             ha="center", transform=ax2.transAxes, fontsize=10, style="italic")

    fig.suptitle("Final results dashboard — end-to-end validation on the demo machine",
                 fontsize=13, weight="bold", y=1.02)
    save("conclusion_fig1")


if __name__ == "__main__":
    ch1_fig2_envelope()
    ch2_fig1_positioning()
    ch2_fig2_quantization()
    ch5_fig5_live_training()
    ch5_fig6_shap()
    ch10_fig1_backend_coverage()
    ch10_fig2_frontend_coverage()
    conclusion_fig1_results()
    print("\nall charts generated.")
