"""
Pipeline chat over SocketIO. Includes lightweight @mention extraction so the
broadcast payload carries the resolved `mentioned_user_ids` array.

@mentions are detected by scanning `@token` substrings in the message text
and resolving them against active members of the sender's company. A token
matches a user if it equals (case-insensitive) the email local-part, the
full email, or the full_name with spaces collapsed.

Flow:
  connect         -> verify JWT (from auth handshake payload), load user's
                    active company membership. Company tier only.
  join_pipeline   -> require that the pipeline's company matches the user's
                    (HTTP call to ml-training-service). Joins the room.
  leave_pipeline  -> leave the room.
  send_message    -> persist to pipeline_messages, emit('message', ...)

All writes go through the shared SQLAlchemy session created in
``app.extensions.init_db`` -- the gateway shares the auth-service DB.
"""

import os
import re
import uuid
from datetime import datetime, timezone

import requests
from flask import current_app, request
from flask_jwt_extended import decode_token
from flask_socketio import disconnect, emit, join_room, leave_room
from sqlalchemy import text

from ..extensions import get_session
from . import socketio

# Per-SID state lives in memory on the single threaded worker.
# Maps sid → {"user_id", "company_id", "email", "full_name"}
_sessions: dict[str, dict] = {}


def _auth_from_handshake() -> dict | None:
    """Pull the bearer token from SocketIO handshake auth payload or query."""
    auth_payload = getattr(request, "event", {}) or {}
    token = None
    # flask-socketio exposes auth via request.args fallback
    try:
        token = (request.args.get("token") or "").strip() or None
    except Exception:
        pass
    if not token:
        try:
            token = (auth_payload or {}).get("auth", {}).get("token")
        except Exception:
            token = None
    if not token:
        return None
    try:
        claims = decode_token(token)
    except Exception:
        return None
    return claims


def _load_active_membership(user_id: str) -> dict | None:
    """Return {company_id, role} for the user's active membership, or None."""
    sess = get_session()
    try:
        row = sess.execute(
            text(
                "SELECT company_id::text AS company_id, role "
                "FROM memberships "
                "WHERE user_id = :uid AND status = 'active' "
                "LIMIT 1"
            ),
            {"uid": user_id},
        ).mappings().first()
        return dict(row) if row else None
    finally:
        sess.close()


def _load_user_profile(user_id: str) -> dict | None:
    sess = get_session()
    try:
        row = sess.execute(
            text("SELECT email, full_name, tier FROM users WHERE id = :uid"),
            {"uid": user_id},
        ).mappings().first()
        return dict(row) if row else None
    finally:
        sess.close()


def _pipeline_company_matches(pipeline_id: str, user_id: str, company_id: str) -> bool:
    """Ask ml-training-service whether the pipeline is visible to this user.

    We re-use the existing authz rule in ml-training-service's GET /pipelines/<id>
    (user owns it OR pipeline.company_id is set and matches membership).
    """
    ml_url = os.environ.get("ML_SERVICE_URL", "http://ml-training-service:8003")
    try:
        resp = requests.get(
            f"{ml_url}/pipelines/{pipeline_id}",
            headers={
                "X-User-Id": user_id,
                "X-Company-Id": company_id,
            },
            timeout=5,
        )
    except requests.RequestException:
        return False
    if resp.status_code != 200:
        return False
    doc = resp.json()
    doc_company = doc.get("company_id")
    doc_owner = doc.get("user_id")
    return doc_owner == user_id or (doc_company and doc_company == company_id)


# ─────────────────────────────────────────────────────────────────────────────
# Mention extraction
# ─────────────────────────────────────────────────────────────────────────────

_MENTION_RE = re.compile(r"@([\w.+\-]+(?:@[\w.\-]+)?)", re.UNICODE)


def _extract_mentions(message: str, company_id: str) -> list[dict]:
    """Resolve @tokens in `message` to active company members.

    Returns a list of `{user_id, email, full_name}` rows. Empty list when
    there's no plausible match — never raises, never blocks send.
    """
    if not message or not company_id:
        return []
    tokens = {m.group(1).lower() for m in _MENTION_RE.finditer(message)}
    if not tokens:
        return []
    sess = get_session()
    try:
        rows = sess.execute(
            text(
                """
                SELECT u.id::text AS user_id, u.email, u.full_name
                FROM users u
                JOIN memberships m ON m.user_id = u.id
                WHERE m.company_id = :cid AND m.status = 'active'
                """
            ),
            {"cid": company_id},
        ).mappings().all()
    finally:
        sess.close()

    matches: list[dict] = []
    seen_ids: set[str] = set()
    for row in rows:
        email = (row.get("email") or "").lower()
        full_name = (row.get("full_name") or "").lower()
        local_part = email.split("@", 1)[0] if email else ""
        # Collapse whitespace in full_name to match "@alice.martin" / "@alicemartin"
        compact = re.sub(r"\s+", "", full_name)
        candidates = {email, local_part, compact, full_name}
        if any(tok in candidates for tok in tokens):
            uid = row["user_id"]
            if uid in seen_ids:
                continue
            seen_ids.add(uid)
            matches.append(
                {
                    "user_id": uid,
                    "email": row.get("email"),
                    "full_name": row.get("full_name"),
                }
            )
    return matches


# ─────────────────────────────────────────────────────────────────────────────
# Handlers
# ─────────────────────────────────────────────────────────────────────────────


@socketio.on("connect")
def on_connect(auth=None):
    token = None
    if isinstance(auth, dict):
        token = auth.get("token")
    if not token:
        token = request.args.get("token")
    if not token:
        return False  # reject

    try:
        claims = decode_token(token)
    except Exception:
        return False

    user_id = claims.get("sub")
    tier = claims.get("tier") or ""
    if tier not in ("company", "super_admin"):
        emit("error", {"error": "company_tier_required"})
        return False

    membership = _load_active_membership(user_id)
    if not membership:
        emit("error", {"error": "no_company_membership"})
        return False

    profile = _load_user_profile(user_id) or {}
    _sessions[request.sid] = {
        "user_id": user_id,
        "company_id": membership["company_id"],
        "role": membership["role"],
        "email": profile.get("email"),
        "full_name": profile.get("full_name"),
    }
    emit("connected", {"user_id": user_id, "company_id": membership["company_id"]})


@socketio.on("disconnect")
def on_disconnect():
    _sessions.pop(request.sid, None)


@socketio.on("join_pipeline")
def on_join_pipeline(data):
    sess = _sessions.get(request.sid)
    if not sess:
        disconnect()
        return
    pipeline_id = (data or {}).get("pipeline_id")
    if not pipeline_id:
        emit("error", {"error": "pipeline_id_required"})
        return
    if not _pipeline_company_matches(
        pipeline_id, sess["user_id"], sess["company_id"]
    ):
        emit("error", {"error": "pipeline_access_denied"})
        return
    join_room(f"pipeline_{pipeline_id}")
    emit(
        "joined",
        {
            "pipeline_id": pipeline_id,
            "user_id": sess["user_id"],
            "full_name": sess.get("full_name"),
        },
        to=f"pipeline_{pipeline_id}",
    )


@socketio.on("leave_pipeline")
def on_leave_pipeline(data):
    pipeline_id = (data or {}).get("pipeline_id")
    if pipeline_id:
        leave_room(f"pipeline_{pipeline_id}")


@socketio.on("send_message")
def on_send_message(data):
    sess = _sessions.get(request.sid)
    if not sess:
        disconnect()
        return
    pipeline_id = (data or {}).get("pipeline_id")
    message = ((data or {}).get("message") or "").strip()
    if not pipeline_id or not message:
        emit("error", {"error": "pipeline_id_and_message_required"})
        return
    if len(message) > 2000:
        emit("error", {"error": "message_too_long"})
        return

    # Persist
    msg_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc)
    db = get_session()
    try:
        db.execute(
            text(
                "INSERT INTO pipeline_messages "
                "(id, pipeline_id, user_id, company_id, message, created_at) "
                "VALUES (:id, :pid, :uid, :cid, :msg, :created)"
            ),
            {
                "id": msg_id,
                "pid": pipeline_id,
                "uid": sess["user_id"],
                "cid": sess["company_id"],
                "msg": message,
                "created": created_at,
            },
        )
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        current_app.logger.exception("send_message persist failed")
        emit("error", {"error": "persist_failed", "detail": str(e)})
        return
    finally:
        db.close()

    mentions = _extract_mentions(message, sess["company_id"])
    payload = {
        "id": msg_id,
        "pipeline_id": pipeline_id,
        "user_id": sess["user_id"],
        "full_name": sess.get("full_name") or sess.get("email"),
        "message": message,
        "created_at": created_at.isoformat(),
        "mentioned_user_ids": [m["user_id"] for m in mentions],
        "mentions": mentions,
    }
    emit("message", payload, to=f"pipeline_{pipeline_id}")
