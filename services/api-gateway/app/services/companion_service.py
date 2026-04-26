"""
Sprint 7 Module 4 — Local AI Companion.

Builds a system prompt grounded in the platform's structure (so the model
talks about pipelines, datasets, profiling, etc. rather than generic ML
trivia) and proxies the user's question to the local Ollama daemon.

100% local mandate: every byte of conversation stays inside the docker
network — no third-party LLM calls.
"""

from __future__ import annotations

import logging
from typing import Any

import requests
from flask import current_app

log = logging.getLogger(__name__)

# Caps to keep generation under ~30s on a 6 GB GPU.
_MAX_QUESTION_CHARS = 1500
_MAX_CONTEXT_CHARS = 1500
_OLLAMA_TIMEOUT_S = 60

_BASE_SYSTEM_PROMPT = """You are the in-app assistant for a no-code AI platform.
Users build ML and RAG pipelines visually: they upload datasets, run
profiling, configure preprocessing, train models, and deploy.

Be concise (≤ 4 short paragraphs). When the user is on a specific screen
(dataset, pipeline editor, results), tailor your answer to that screen.
Prefer concrete, actionable steps in the platform's own vocabulary
("add a SMOTE node", "open the profiling tab", "click Train").

Never invent UI elements that the user hasn't mentioned and you don't
have evidence of. If you don't know, say so and suggest where they can
look in-app.
"""


def _truncate(text: str, limit: int) -> str:
    text = (text or "").strip()
    return text if len(text) <= limit else text[:limit] + "…"


def build_system_prompt(context: dict[str, Any] | None) -> str:
    """Compose the base prompt with whatever context the client supplied."""
    if not context:
        return _BASE_SYSTEM_PROMPT

    lines: list[str] = []
    view = context.get("active_view")
    if view:
        lines.append(f"Current screen: {view}.")
    pipeline = context.get("pipeline") or {}
    if pipeline:
        lines.append(
            "Pipeline: "
            f"{pipeline.get('name', '?')} (type {pipeline.get('type', 'ml')}, "
            f"status {pipeline.get('status', '?')})."
        )
        node_summary = pipeline.get("node_summary")
        if node_summary:
            lines.append(f"Canvas nodes: {node_summary}.")
        selected = pipeline.get("selected_nodes") or []
        if selected:
            lines.append(
                "Nodes currently selected by the user (they are most likely"
                f" asking about these): {', '.join(selected[:8])}."
            )
    dataset = context.get("dataset") or {}
    if dataset:
        lines.append(
            "Dataset: "
            f"{dataset.get('name', '?')} — {dataset.get('row_count', '?')} rows × "
            f"{dataset.get('column_count', '?')} columns."
        )
        target = dataset.get("target_column")
        if target:
            lines.append(f"Target column configured: `{target}`.")
        schema_preview = dataset.get("schema_preview")
        if schema_preview:
            lines.append(
                "Schema preview (name:dtype — reference columns by name when"
                f" giving advice):\n{_truncate(str(schema_preview), 600)}"
            )
    recent_errors = context.get("recent_errors") or []
    if recent_errors:
        bullets = "\n".join(f"- {e}" for e in recent_errors[:5])
        lines.append(
            "Recent errors the user just hit (troubleshoot these first if the"
            f" question is vague):\n{_truncate(bullets, 600)}"
        )
    notes = context.get("notes")
    if notes:
        lines.append(
            "Profiling signals from the active dataset (use these to ground"
            " concrete suggestions like SMOTE, class weights, log transforms,"
            " or column drops):\n"
            + _truncate(str(notes), _MAX_CONTEXT_CHARS)
        )

    if not lines:
        return _BASE_SYSTEM_PROMPT
    return _BASE_SYSTEM_PROMPT + "\n---\nContext:\n" + "\n".join(lines)


def ask_companion(
    question: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Round-trip a single user question through Ollama. Returns
    {"answer": str, "model": str, "elapsed_ms": int} or raises."""
    question = _truncate(question, _MAX_QUESTION_CHARS)
    if not question:
        raise ValueError("empty_question")

    url = current_app.config["OLLAMA_URL"].rstrip("/")
    model = current_app.config["OLLAMA_MODEL"]
    system = build_system_prompt(context)

    body = {
        "model": model,
        "system": system,
        "prompt": question,
        "stream": False,
        "options": {"temperature": 0.3, "num_ctx": 2048},
    }

    import time

    t0 = time.time()
    resp = requests.post(f"{url}/api/generate", json=body, timeout=_OLLAMA_TIMEOUT_S)
    resp.raise_for_status()
    payload = resp.json()
    elapsed_ms = int((time.time() - t0) * 1000)
    answer = (payload.get("response") or "").strip()
    return {"answer": answer, "model": model, "elapsed_ms": elapsed_ms}
