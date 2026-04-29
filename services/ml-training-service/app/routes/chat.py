"""
RAG chat endpoint (Sprint 5 Module 2 + Sprint 7 threads).

POST /pipelines/<pipeline_id>/chat
Body: {"message": "...", "thread_id"?: "..."}
Returns: {"answer": "...", "sources_used": [...], "thread_id": "..."}

Threads (Sprint 7):
  GET    /pipelines/<id>/chat/threads
  POST   /pipelines/<id>/chat/threads
  GET    /pipelines/<id>/chat/threads/<thread_id>
  DELETE /pipelines/<id>/chat/threads/<thread_id>

Legacy turns persisted before threads existed surface under the synthetic
thread id `default` so history is never lost when the schema evolves.
"""

from __future__ import annotations

import json
import uuid
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
LEGACY_THREAD_ID = "default"


def _resolve_thread_id(pipeline_id: str, payload: dict) -> str:
    """Return the thread_id to write the next turn against.

    If the client supplies a thread_id we trust it (it's just a string key
    scoped to the pipeline_id, no global uniqueness needed). Otherwise we
    mint a fresh UUID — every chat turn without an explicit thread starts
    its own conversation.
    """
    raw = (payload.get("thread_id") or "").strip()
    if raw:
        # Light sanity check: keep it short, printable, and free of slashes
        # so it can't escape the URL path on subsequent reads.
        if len(raw) > 64 or "/" in raw or any(c.isspace() for c in raw):
            return uuid.uuid4().hex
        return raw
    # No explicit thread → start a brand new one.
    _ = pipeline_id  # reserved for future per-pipeline default lookup
    return uuid.uuid4().hex


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

    payload = request.get_json(silent=True) or {}
    thread_id = _resolve_thread_id(pipeline_id, payload)

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
                "thread_id": thread_id,
                "message": message,
                "answer": result["answer"],
                "source_count": len(result["sources_used"]),
                "created_at": datetime.now(timezone.utc),
            }
        )
    except Exception:
        pass

    result["thread_id"] = thread_id
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

    payload = request.get_json(silent=True) or {}
    thread_id = _resolve_thread_id(pipeline_id, payload)

    selected_model, selected_top_k = _resolve_rag_config(pipeline_id)

    def generate():
        final_answer = ""
        sources_count = 0
        # Send the thread_id up-front so the client can pin its sidebar entry
        # before the first token even arrives.
        yield json.dumps({"type": "thread", "thread_id": thread_id}) + "\n"
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
                        "thread_id": thread_id,
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
    """Backward-compatible flat history (all threads merged).

    Optional `?thread_id=` query narrows to a single thread. Pre-thread turns
    surface under the synthetic id `default`.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    query: dict = {"pipeline_id": pipeline_id}
    requested_thread = (request.args.get("thread_id") or "").strip()
    if requested_thread:
        if requested_thread == LEGACY_THREAD_ID:
            query["$or"] = [
                {"thread_id": {"$exists": False}},
                {"thread_id": None},
                {"thread_id": LEGACY_THREAD_ID},
            ]
        else:
            query["thread_id"] = requested_thread

    cursor = (
        mongo.db["rag_chat_turns"]
        .find(query)
        .sort("created_at", 1)
        .limit(500)
    )
    turns = []
    for t in cursor:
        turns.append(
            {
                "turn_id": str(t["_id"]) if t.get("_id") else None,
                "message": t.get("message"),
                "answer": t.get("answer"),
                "source_count": t.get("source_count", 0),
                "thread_id": t.get("thread_id") or LEGACY_THREAD_ID,
                "feedback": t.get("feedback"),
                "created_at": t["created_at"].isoformat()
                if t.get("created_at")
                else None,
            }
        )
    return jsonify({"items": turns}), 200


def _summarize_first_message(text: str | None, limit: int = 60) -> str:
    if not text:
        return "Untitled thread"
    text = text.strip().replace("\n", " ")
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


@chat_bp.get("/pipelines/<pipeline_id>/chat/threads")
def list_chat_threads(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    aggregation = [
        {"$match": {"pipeline_id": pipeline_id}},
        {
            "$group": {
                "_id": {"$ifNull": ["$thread_id", LEGACY_THREAD_ID]},
                "first_message": {"$first": "$message"},
                "first_created_at": {"$min": "$created_at"},
                "last_created_at": {"$max": "$created_at"},
                "turn_count": {"$sum": 1},
            }
        },
        {"$sort": {"last_created_at": -1}},
        {"$limit": 100},
    ]

    threads = []
    try:
        for row in mongo.db["rag_chat_turns"].aggregate(aggregation):
            threads.append(
                {
                    "thread_id": row["_id"],
                    "title": _summarize_first_message(row.get("first_message")),
                    "turn_count": row.get("turn_count", 0),
                    "created_at": row["first_created_at"].isoformat()
                    if row.get("first_created_at")
                    else None,
                    "last_message_at": row["last_created_at"].isoformat()
                    if row.get("last_created_at")
                    else None,
                }
            )
    except Exception:
        # Aggregation failures should never bring the panel down — fall back
        # to an empty thread list and let the client render its empty state.
        threads = []
    return jsonify({"items": threads}), 200


@chat_bp.post("/pipelines/<pipeline_id>/chat/threads")
def create_chat_thread(pipeline_id: str):
    """Mint a fresh thread_id for the client.

    No row is written until the user sends the first message — this just
    reserves an id the UI can pin to the sidebar immediately.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401
    _ = pipeline_id
    thread_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()
    return (
        jsonify(
            {
                "thread_id": thread_id,
                "title": "New conversation",
                "turn_count": 0,
                "created_at": now,
                "last_message_at": now,
            }
        ),
        201,
    )


@chat_bp.get("/pipelines/<pipeline_id>/chat/threads/<thread_id>")
def get_chat_thread(pipeline_id: str, thread_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    if thread_id == LEGACY_THREAD_ID:
        match = {
            "pipeline_id": pipeline_id,
            "$or": [
                {"thread_id": {"$exists": False}},
                {"thread_id": None},
                {"thread_id": LEGACY_THREAD_ID},
            ],
        }
    else:
        match = {"pipeline_id": pipeline_id, "thread_id": thread_id}

    cursor = mongo.db["rag_chat_turns"].find(match).sort("created_at", 1).limit(500)
    turns = []
    for t in cursor:
        turns.append(
            {
                "turn_id": str(t["_id"]) if t.get("_id") else None,
                "message": t.get("message"),
                "answer": t.get("answer"),
                "source_count": t.get("source_count", 0),
                "thread_id": t.get("thread_id") or LEGACY_THREAD_ID,
                "feedback": t.get("feedback"),
                "created_at": t["created_at"].isoformat()
                if t.get("created_at")
                else None,
            }
        )
    return jsonify({"thread_id": thread_id, "items": turns}), 200


@chat_bp.get("/admin/users/<target_user_id>/ml-data")
def admin_user_ml_data(target_user_id: str):
    """GDPR export: pipelines, model versions, and chat turns for one user.

    Single endpoint so the gateway aggregator only needs one round-trip per
    backend service. Trusts `X-User-Role: super_admin` from the gateway,
    same pattern as the data-ingestion admin dump.
    """
    if request.headers.get("X-User-Role") != "super_admin":
        return jsonify({"error": "forbidden"}), 403

    pipelines = []
    for doc in mongo.db["pipelines"].find({"user_id": target_user_id}):
        doc.pop("_id", None)
        for field in ("created_at", "updated_at", "last_edited_at"):
            if field in doc and hasattr(doc[field], "isoformat"):
                doc[field] = doc[field].isoformat()
        pipelines.append(doc)

    model_versions = []
    for doc in mongo.db["model_versions"].find({"user_id": target_user_id}):
        doc.pop("_id", None)
        if "created_at" in doc and hasattr(doc["created_at"], "isoformat"):
            doc["created_at"] = doc["created_at"].isoformat()
        # Don't ship the on-disk artifact path off-host
        doc.pop("artifact_path", None)
        model_versions.append(doc)

    chat_turns = []
    for doc in mongo.db["rag_chat_turns"].find({"user_id": target_user_id}):
        chat_turns.append(
            {
                "pipeline_id": doc.get("pipeline_id"),
                "thread_id": doc.get("thread_id"),
                "message": doc.get("message"),
                "answer": doc.get("answer"),
                "source_count": doc.get("source_count", 0),
                "feedback": doc.get("feedback"),
                "created_at": doc["created_at"].isoformat()
                if hasattr(doc.get("created_at"), "isoformat")
                else None,
            }
        )

    return (
        jsonify(
            {
                "pipelines": pipelines,
                "model_versions": model_versions,
                "chat_turns": chat_turns,
                "counts": {
                    "pipelines": len(pipelines),
                    "model_versions": len(model_versions),
                    "chat_turns": len(chat_turns),
                },
            }
        ),
        200,
    )


@chat_bp.post("/pipelines/<pipeline_id>/chat/turns/<turn_id>/feedback")
def chat_turn_feedback(pipeline_id: str, turn_id: str):
    """Record thumbs-up/down on a single chat turn.

    The aggregation dashboard isn't built yet — this endpoint exists so the
    feedback ritual can ship now and we don't lose the signal. `value` is
    -1 / 0 / +1; any other body is rejected.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    body = request.get_json(silent=True) or {}
    value = body.get("value")
    if value not in (-1, 0, 1):
        return jsonify({"error": "invalid_value", "expected": [-1, 0, 1]}), 400

    from bson.errors import InvalidId
    from bson.objectid import ObjectId

    try:
        oid = ObjectId(turn_id)
    except (InvalidId, TypeError):
        return jsonify({"error": "invalid_turn_id"}), 400

    result = mongo.db["rag_chat_turns"].update_one(
        {"_id": oid, "pipeline_id": pipeline_id},
        {
            "$set": {
                "feedback": int(value),
                "feedback_by": user_id,
                "feedback_at": datetime.now(timezone.utc),
            }
        },
    )
    if result.matched_count == 0:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"turn_id": turn_id, "feedback": int(value)}), 200


@chat_bp.delete("/pipelines/<pipeline_id>/chat/threads/<thread_id>")
def delete_chat_thread(pipeline_id: str, thread_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    if thread_id == LEGACY_THREAD_ID:
        result = mongo.db["rag_chat_turns"].delete_many(
            {
                "pipeline_id": pipeline_id,
                "$or": [
                    {"thread_id": {"$exists": False}},
                    {"thread_id": None},
                    {"thread_id": LEGACY_THREAD_ID},
                ],
            }
        )
    else:
        result = mongo.db["rag_chat_turns"].delete_many(
            {"pipeline_id": pipeline_id, "thread_id": thread_id}
        )
    return jsonify({"deleted": result.deleted_count}), 200
