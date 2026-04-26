"""
RAG chat endpoint (Sprint 5 Module 2).

POST /pipelines/<pipeline_id>/chat
Body: {"message": "..."}
Returns: {"answer": "...", "sources_used": [{rank, text, source_name, score, ...}]}
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

import requests
from flask import Blueprint, Response, jsonify, request, stream_with_context

from ..extensions import mongo
from ..services.rag_chat import (
    TOP_K as DEFAULT_TOP_K,
    chat as rag_chat,
    chat_stream as rag_chat_stream,
)

# Hard ceiling enforced server-side regardless of what the client sends.
# Past 10 chunks the small local models silently truncate or degrade — see
# rag_chat.NUM_CTX comment.
MAX_TOP_K = 10

chat_bp = Blueprint("chat", __name__)

MAX_MESSAGE_LEN = 4000


def _resolve_rag_config(pipeline_id: str) -> tuple[str | None, int]:
    """Read the RAGConfig node's llm_engine + top_k for this pipeline."""
    selected_model: str | None = None
    selected_top_k: int = DEFAULT_TOP_K
    try:
        pipeline_doc = mongo.db["pipelines"].find_one({"pipeline_id": pipeline_id})
        for node in (pipeline_doc or {}).get("nodes", []) or []:
            if node.get("type") == "rag_config":
                node_data = node.get("data") or {}
                engine = node_data.get("llm_engine")
                if isinstance(engine, str) and engine:
                    selected_model = engine
                raw_k = node_data.get("top_k")
                if isinstance(raw_k, (int, float)) and raw_k > 0:
                    selected_top_k = max(1, min(int(raw_k), MAX_TOP_K))
                break
    except Exception:
        selected_model = None
    return selected_model, selected_top_k


def _validate_chat_request() -> tuple[str | None, str | None, tuple[Response, int] | None]:
    """Returns (user_id, message, error_response). On success error_response is None."""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return None, None, (jsonify({"error": "missing_user_id"}), 401)

    payload = request.get_json(silent=True) or {}
    message = (payload.get("message") or "").strip()
    if not message:
        return None, None, (jsonify({"error": "empty_message"}), 400)
    if len(message) > MAX_MESSAGE_LEN:
        return (
            None,
            None,
            (
                jsonify({"error": "message_too_long", "max_chars": MAX_MESSAGE_LEN}),
                400,
            ),
        )
    return user_id, message, None


@chat_bp.post("/pipelines/<pipeline_id>/chat")
def pipeline_chat(pipeline_id: str):
    user_id, message, err = _validate_chat_request()
    if err is not None:
        return err

    selected_model, selected_top_k = _resolve_rag_config(pipeline_id)

    try:
        result = rag_chat(
            pipeline_id=pipeline_id,
            query=message,
            top_k=selected_top_k,
            model=selected_model,
        )
    except requests.exceptions.ConnectionError:
        return (
            jsonify(
                {
                    "error": "ollama_unavailable",
                    "detail": "Local LLM service is not reachable.",
                }
            ),
            503,
        )
    except requests.exceptions.Timeout:
        return jsonify({"error": "ollama_timeout"}), 504
    except requests.exceptions.HTTPError as exc:
        return (
            jsonify(
                {
                    "error": "ollama_error",
                    "detail": str(exc)[:300],
                }
            ),
            502,
        )
    except RuntimeError as exc:
        # e.g. PGVECTOR_DSN missing, embedding model failed to load
        return jsonify({"error": "rag_misconfigured", "detail": str(exc)[:300]}), 500

    # Persist the turn for transcript / audit (best-effort, never fail the request).
    try:
        mongo.db["rag_chat_turns"].insert_one(
            {
                "pipeline_id": pipeline_id,
                "user_id": user_id,
                "message": message,
                "answer": result["answer"],
                "source_count": len(result["sources_used"]),
                "created_at": datetime.now(timezone.utc),
            }
        )
    except Exception:
        pass

    return jsonify(result), 200


@chat_bp.post("/pipelines/<pipeline_id>/chat/stream")
def pipeline_chat_stream(pipeline_id: str):
    """
    NDJSON-streamed RAG turn. Same auth + validation as /chat, but the answer
    is delivered token-by-token while the user watches the bubble fill in.

    Wire format (one JSON object per line):
        {"type": "sources", "sources_used": [...]}
        {"type": "token",   "text": "..."}     (repeated)
        {"type": "done",    "answer": "..."}   (final, persisted to Mongo)
        {"type": "error",   "error": "...", "detail": "..."}  (any failure)
    """
    user_id, message, err = _validate_chat_request()
    if err is not None:
        return err

    selected_model, selected_top_k = _resolve_rag_config(pipeline_id)

    def generate():
        final_answer = ""
        sources_count = 0
        try:
            for event in rag_chat_stream(
                pipeline_id=pipeline_id,
                query=message,
                top_k=selected_top_k,
                model=selected_model,
            ):
                if event.get("type") == "sources":
                    sources_count = len(event.get("sources_used") or [])
                elif event.get("type") == "done":
                    final_answer = event.get("answer", "")
                yield json.dumps(event) + "\n"
        except RuntimeError as exc:
            yield json.dumps(
                {"type": "error", "error": "rag_misconfigured", "detail": str(exc)[:300]}
            ) + "\n"
            return
        except Exception as exc:  # last-resort safety net so the socket isn't left hanging
            yield json.dumps(
                {"type": "error", "error": "stream_failed", "detail": str(exc)[:300]}
            ) + "\n"
            return

        # Persist the completed turn for transcript/audit (best-effort).
        if final_answer:
            try:
                mongo.db["rag_chat_turns"].insert_one(
                    {
                        "pipeline_id": pipeline_id,
                        "user_id": user_id,
                        "message": message,
                        "answer": final_answer,
                        "source_count": sources_count,
                        "created_at": datetime.now(timezone.utc),
                    }
                )
            except Exception:
                pass

    return Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            # Disable nginx/proxy buffering so tokens reach the browser immediately.
            "X-Accel-Buffering": "no",
        },
    )


@chat_bp.get("/pipelines/<pipeline_id>/chat/history")
def chat_history(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    cursor = (
        mongo.db["rag_chat_turns"]
        .find({"pipeline_id": pipeline_id})
        .sort("created_at", 1)
        .limit(200)
    )
    turns = []
    for t in cursor:
        turns.append(
            {
                "message": t.get("message"),
                "answer": t.get("answer"),
                "source_count": t.get("source_count", 0),
                "created_at": t["created_at"].isoformat()
                if t.get("created_at")
                else None,
            }
        )
    return jsonify({"items": turns}), 200
