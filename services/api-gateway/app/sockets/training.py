"""
Sprint 7 Module 3 — live training events.

Lives on the `/training` SocketIO namespace so it doesn't collide with
the company-tier-only chat namespace (`/`). Personal-tier users must be
able to watch their own pipelines train.

Flow:
  connect          → verify JWT (token in handshake auth or query string).
                     Any authenticated user is allowed; ACL is enforced
                     per-pipeline at join time.
  join_pipeline    → confirm the user can read the pipeline by calling
                     ml-training-service GET /pipelines/<id>. On success
                     join room ``pipeline_<id>``.
  leave_pipeline   → leave the room.

The Celery worker emits ``training_progress``, ``training_metric``,
``training_complete`` and ``training_failed`` events into this namespace
via the shared Redis SocketIO message queue.
"""

from __future__ import annotations

import os

import requests
from flask import request
from flask_jwt_extended import decode_token
from flask_socketio import disconnect, emit, join_room, leave_room

from . import socketio

NAMESPACE = "/training"

# sid → {"user_id", "company_id"|None}
_sessions: dict[str, dict] = {}


def _decode(token: str | None) -> dict | None:
    if not token:
        return None
    try:
        return decode_token(token)
    except Exception:
        return None


def _can_read_pipeline(pipeline_id: str, user_id: str, company_id: str | None) -> bool:
    ml_url = os.environ.get("ML_SERVICE_URL", "http://ml-training-service:8003")
    headers = {"X-User-Id": user_id}
    if company_id:
        headers["X-Company-Id"] = company_id
    try:
        resp = requests.get(
            f"{ml_url}/pipelines/{pipeline_id}", headers=headers, timeout=5
        )
    except requests.RequestException:
        return False
    if resp.status_code != 200:
        return False
    doc = resp.json()
    if doc.get("user_id") == user_id:
        return True
    doc_company = doc.get("company_id")
    return bool(doc_company and company_id and doc_company == company_id)


@socketio.on("connect", namespace=NAMESPACE)
def on_connect(auth=None):
    token = None
    if isinstance(auth, dict):
        token = auth.get("token")
    if not token:
        token = request.args.get("token")
    claims = _decode(token)
    if not claims:
        return False  # reject

    _sessions[request.sid] = {
        "user_id": claims.get("sub"),
        "company_id": claims.get("active_company_id") or claims.get("company_id"),
    }
    emit("connected", {"namespace": NAMESPACE})


@socketio.on("disconnect", namespace=NAMESPACE)
def on_disconnect():
    _sessions.pop(request.sid, None)


@socketio.on("join_pipeline", namespace=NAMESPACE)
def on_join_pipeline(data):
    sess = _sessions.get(request.sid)
    if not sess:
        disconnect()
        return
    pipeline_id = (data or {}).get("pipeline_id")
    if not pipeline_id:
        emit("error", {"error": "pipeline_id_required"})
        return
    if not _can_read_pipeline(pipeline_id, sess["user_id"], sess.get("company_id")):
        emit("error", {"error": "pipeline_access_denied"})
        return
    join_room(f"pipeline_{pipeline_id}")
    emit("joined", {"pipeline_id": pipeline_id})


@socketio.on("leave_pipeline", namespace=NAMESPACE)
def on_leave_pipeline(data):
    pipeline_id = (data or {}).get("pipeline_id")
    if pipeline_id:
        leave_room(f"pipeline_{pipeline_id}")
