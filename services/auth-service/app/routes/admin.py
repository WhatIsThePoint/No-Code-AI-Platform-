"""
Super-admin routes — protected by role == "super_admin".
All mutations are audit-logged.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from marshmallow import ValidationError

from ..schemas.admin import (
    AnnouncementSchema,
    LogSearchSchema,
    UserPatchSchema,
    UserSearchSchema,
)
from ..schemas.billing import SubscriptionOverrideSchema
from ..services import admin_service, auth_service

admin_bp = Blueprint("admin", __name__, url_prefix="/admin")

_user_search = UserSearchSchema()
_user_patch = UserPatchSchema()
_ann_schema = AnnouncementSchema()
_log_search = LogSearchSchema()
_sub_override = SubscriptionOverrideSchema()


def _require_admin():
    """Raises 403 if caller is not super_admin. Returns user_id."""
    claims = get_jwt()
    if claims.get("role") != "super_admin":
        return None
    return get_jwt_identity()


def _ip():
    return request.headers.get("X-Forwarded-For", request.remote_addr)


# ── Users ─────────────────────────────────────────────────────────────────────


@admin_bp.get("/users")
@jwt_required()
def list_users():
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    try:
        params = _user_search.load(request.args)
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    users, total = admin_service.list_users(
        q=params["q"],
        page=params["page"],
        limit=params["limit"],
        role=params.get("role"),
        tier=params.get("tier"),
        is_active=params.get("is_active"),
    )
    items = [
        {
            "user_id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "tier": u.tier,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in users
    ]
    return (
        jsonify(
            {
                "items": items,
                "total": total,
                "page": params["page"],
                "limit": params["limit"],
            }
        ),
        200,
    )


@admin_bp.get("/users/<user_id>")
@jwt_required()
def get_user(user_id):
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    user = admin_service.get_user(user_id)
    if not user:
        return jsonify({"error": "not_found"}), 404
    sub = getattr(user, "subscription", None)
    return (
        jsonify(
            {
                "user_id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
                "tier": user.tier,
                "is_active": user.is_active,
                "totp_enabled": user.totp_enabled,
                "created_at": user.created_at.isoformat(),
                "subscription": (
                    {
                        "plan": sub.plan,
                        "status": sub.status,
                        "max_chunks": sub.max_chunks,
                        "max_vram_mb": sub.max_vram_mb,
                        "max_dl_epochs": sub.max_dl_epochs,
                        "max_dl_batch_size": sub.max_dl_batch_size,
                    }
                    if sub
                    else None
                ),
            }
        ),
        200,
    )


@admin_bp.patch("/users/<user_id>")
@jwt_required()
def update_user(user_id):
    actor_id = _require_admin()
    if not actor_id:
        return jsonify({"error": "forbidden"}), 403
    try:
        data = _user_patch.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400

    try:
        user = admin_service.update_user(
            user_id,
            is_active=data.get("is_active"),
            role=data.get("role"),
            tier=data.get("tier"),
        )
    except ValueError:
        return jsonify({"error": "not_found"}), 404

    admin_service.log_action(
        action="admin.update_user",
        actor_id=actor_id,
        target_type="user",
        target_id=user_id,
        detail=data,
        ip_address=_ip(),
    )
    return (
        jsonify(
            {
                "user_id": str(user.id),
                "is_active": user.is_active,
                "role": user.role,
                "tier": user.tier,
            }
        ),
        200,
    )


@admin_bp.get("/users/<user_id>/export")
@jwt_required()
def export_user(user_id):
    """GDPR-style data export — user profile + audit log + subscription.

    The gateway aggregator stitches this together with dumps from the other
    services (datasets in data-ingestion, pipelines/chat in ml-training) into
    a single zip the super-admin can hand to the user. Returns JSON here so
    the gateway can compose without re-zipping.
    """
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    user = admin_service.get_user(user_id)
    if not user:
        return jsonify({"error": "not_found"}), 404

    from ..models.subscription import AuditLog, Subscription

    sub = Subscription.query.filter_by(user_id=user.id).first()
    actor_logs = (
        AuditLog.query.filter(AuditLog.actor_id == user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(500)
        .all()
    )
    target_logs = (
        AuditLog.query.filter(AuditLog.target_id == str(user.id))
        .order_by(AuditLog.created_at.desc())
        .limit(500)
        .all()
    )

    return (
        jsonify(
            {
                "user": {
                    "user_id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "role": user.role,
                    "tier": user.tier,
                    "is_active": user.is_active,
                    "totp_enabled": user.totp_enabled,
                    "created_at": user.created_at.isoformat(),
                },
                "subscription": (
                    {
                        "plan": sub.plan,
                        "status": sub.status,
                        "trial_end": sub.trial_end.isoformat() if sub.trial_end else None,
                        "current_period_end": (
                            sub.current_period_end.isoformat()
                            if sub.current_period_end
                            else None
                        ),
                        "max_chunks": sub.max_chunks,
                        "max_vram_mb": sub.max_vram_mb,
                    }
                    if sub
                    else None
                ),
                "audit_logs_as_actor": [
                    {
                        "action": log.action,
                        "target_type": log.target_type,
                        "target_id": log.target_id,
                        "ip_address": log.ip_address,
                        "created_at": log.created_at.isoformat(),
                        "detail": log.detail,
                    }
                    for log in actor_logs
                ],
                "audit_logs_as_target": [
                    {
                        "action": log.action,
                        "actor_id": str(log.actor_id) if log.actor_id else None,
                        "ip_address": log.ip_address,
                        "created_at": log.created_at.isoformat(),
                        "detail": log.detail,
                    }
                    for log in target_logs
                ],
            }
        ),
        200,
    )


@admin_bp.post("/users/<user_id>/impersonate")
@jwt_required()
def impersonate_user(user_id):
    """Mint a 5-minute access token impersonating `user_id`.

    Super-admin only. No refresh-token row is created — this is a one-shot
    session. Both start and (best-effort) end are audit-logged. The minted
    token carries an `imp_actor` claim so downstream events can be correlated
    back to the actual operator.
    """
    actor_id = _require_admin()
    if not actor_id:
        return jsonify({"error": "forbidden"}), 403
    user = admin_service.get_user(user_id)
    if not user:
        return jsonify({"error": "not_found"}), 404
    if not user.is_active:
        return jsonify({"error": "user_inactive"}), 409
    if str(user.id) == str(actor_id):
        return jsonify({"error": "cannot_impersonate_self"}), 400

    token, ttl = auth_service.issue_impersonation_token(user, actor_id)

    admin_service.log_action(
        action="admin.impersonate_start",
        actor_id=actor_id,
        target_type="user",
        target_id=user_id,
        detail={"ttl_seconds": ttl, "target_email": user.email},
        ip_address=_ip(),
    )
    return (
        jsonify(
            {
                "access_token": token,
                "expires_in": ttl,
                "target": {
                    "user_id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "role": user.role,
                    "tier": user.tier,
                },
            }
        ),
        200,
    )


@admin_bp.post("/users/<user_id>/impersonate/end")
@jwt_required()
def impersonate_end(user_id):
    """Audit-log the end of an impersonation session.

    Best-effort: if the super-admin closes the tab without firing this, the
    token expires naturally and we lose the explicit end stamp — the start
    audit row + 5min TTL still bound the session.
    """
    actor_id = _require_admin()
    if not actor_id:
        return jsonify({"error": "forbidden"}), 403
    admin_service.log_action(
        action="admin.impersonate_end",
        actor_id=actor_id,
        target_type="user",
        target_id=user_id,
        ip_address=_ip(),
    )
    return jsonify({"ok": True}), 200


@admin_bp.delete("/users/<user_id>")
@jwt_required()
def delete_user(user_id):
    actor_id = _require_admin()
    if not actor_id:
        return jsonify({"error": "forbidden"}), 403
    try:
        admin_service.delete_user(user_id)
    except ValueError:
        return jsonify({"error": "not_found"}), 404
    admin_service.log_action(
        action="admin.delete_user",
        actor_id=actor_id,
        target_type="user",
        target_id=user_id,
        ip_address=_ip(),
    )
    return "", 204


# ── Companies ─────────────────────────────────────────────────────────────────


@admin_bp.get("/companies")
@jwt_required()
def list_companies():
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    q = request.args.get("q", "")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    companies, total = admin_service.list_companies(q=q, page=page, limit=limit)
    items = [
        {
            "company_id": str(c.id),
            "name": c.name,
            "slug": c.slug,
            "owner_id": str(c.owner_id),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in companies
    ]
    return jsonify({"items": items, "total": total}), 200


@admin_bp.delete("/companies/<company_id>")
@jwt_required()
def delete_company(company_id):
    actor_id = _require_admin()
    if not actor_id:
        return jsonify({"error": "forbidden"}), 403
    try:
        admin_service.delete_company(company_id)
    except ValueError:
        return jsonify({"error": "not_found"}), 404
    admin_service.log_action(
        action="admin.delete_company",
        actor_id=actor_id,
        target_type="company",
        target_id=company_id,
        ip_address=_ip(),
    )
    return "", 204


# ── Subscriptions ─────────────────────────────────────────────────────────────


@admin_bp.get("/subscriptions")
@jwt_required()
def list_subscriptions():
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    from ..models.subscription import Subscription

    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    total = Subscription.query.count()
    subs = (
        Subscription.query.order_by(Subscription.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    items = [
        {
            "user_id": str(s.user_id),
            "plan": s.plan,
            "status": s.status,
            "stripe_customer_id": s.stripe_customer_id,
            "current_period_end": (
                s.current_period_end.isoformat() if s.current_period_end else None
            ),
            "max_chunks": s.max_chunks,
            "max_vram_mb": s.max_vram_mb,
            "max_dl_epochs": s.max_dl_epochs,
            "max_dl_batch_size": s.max_dl_batch_size,
        }
        for s in subs
    ]
    return jsonify({"items": items, "total": total}), 200


@admin_bp.patch("/subscriptions/<user_id>")
@jwt_required()
def override_subscription(user_id):
    actor_id = _require_admin()
    if not actor_id:
        return jsonify({"error": "forbidden"}), 403
    try:
        data = _sub_override.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400
    # Marshmallow load_default=None makes both quota fields *always* present
    # in `data`. Forward them only when the request actually included them so
    # the service-level sentinel (`_UNSET`) can leave the existing value
    # untouched on plan-only edits.
    payload_keys = set((request.get_json(silent=True) or {}).keys())
    kwargs = {}
    if "max_chunks" in payload_keys:
        kwargs["max_chunks"] = data.get("max_chunks")
    if "max_vram_mb" in payload_keys:
        kwargs["max_vram_mb"] = data.get("max_vram_mb")
    if "max_dl_epochs" in payload_keys:
        kwargs["max_dl_epochs"] = data.get("max_dl_epochs")
    if "max_dl_batch_size" in payload_keys:
        kwargs["max_dl_batch_size"] = data.get("max_dl_batch_size")
    try:
        sub = admin_service.override_subscription(
            user_id,
            data["plan"],
            data.get("status", "active"),
            **kwargs,
        )
    except ValueError:
        return jsonify({"error": "not_found"}), 404
    admin_service.log_action(
        action="admin.override_subscription",
        actor_id=actor_id,
        target_type="subscription",
        target_id=user_id,
        detail=data,
        ip_address=_ip(),
    )
    return (
        jsonify(
            {
                "user_id": user_id,
                "plan": sub.plan,
                "status": sub.status,
                "max_chunks": sub.max_chunks,
                "max_vram_mb": sub.max_vram_mb,
                "max_dl_epochs": sub.max_dl_epochs,
                "max_dl_batch_size": sub.max_dl_batch_size,
            }
        ),
        200,
    )


# ── Audit Logs ────────────────────────────────────────────────────────────────


@admin_bp.get("/logs")
@jwt_required()
def list_logs():
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    try:
        params = _log_search.load(request.args)
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400
    logs, total = admin_service.list_logs(
        action=params.get("action"),
        actor_id=params.get("actor_id"),
        target_type=params.get("target_type"),
        page=params["page"],
        limit=params["limit"],
    )
    items = [
        {
            "id": str(log.id),
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": log.target_id,
            "detail": log.detail,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        }
        for log in logs
    ]
    return (
        jsonify(
            {
                "items": items,
                "total": total,
                "page": params["page"],
                "limit": params["limit"],
            }
        ),
        200,
    )


# ── Failed-login audit ───────────────────────────────────────────────────────


@admin_bp.get("/security/failed-logins")
@jwt_required()
def failed_logins():
    """Top offending IPs + recent failed-login attempts over the last N hours.

    Driven entirely off `audit_logs` — `auth.login_failed` rows are appended
    by the login route on every credential mismatch, so this endpoint is a
    pure read with no extra schema.
    """
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403

    from datetime import datetime, timedelta, timezone
    from sqlalchemy import func

    from ..models.subscription import AuditLog

    hours = max(1, min(int(request.args.get("hours", 24)), 24 * 30))
    since = datetime.now(timezone.utc) - timedelta(hours=hours)

    base = AuditLog.query.filter(
        AuditLog.action == "auth.login_failed", AuditLog.created_at >= since
    )

    total = base.count()

    top_ips = (
        base.with_entities(
            AuditLog.ip_address, func.count(AuditLog.id).label("attempts")
        )
        .group_by(AuditLog.ip_address)
        .order_by(func.count(AuditLog.id).desc())
        .limit(10)
        .all()
    )

    recent = (
        base.order_by(AuditLog.created_at.desc()).limit(50).all()
    )

    return (
        jsonify(
            {
                "window_hours": hours,
                "since": since.isoformat(),
                "total": total,
                "top_ips": [
                    {"ip_address": ip or "unknown", "attempts": int(attempts)}
                    for ip, attempts in top_ips
                ],
                "recent": [
                    {
                        "id": str(log.id),
                        "ip_address": log.ip_address,
                        "email": (log.detail or {}).get("email"),
                        "created_at": log.created_at.isoformat(),
                    }
                    for log in recent
                ],
            }
        ),
        200,
    )


# ── Platform Stats ────────────────────────────────────────────────────────────


@admin_bp.get("/stats")
@jwt_required()
def platform_stats():
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    stats = admin_service.get_platform_stats()
    return jsonify(stats), 200


# ── Announcements ─────────────────────────────────────────────────────────────


@admin_bp.get("/announcements")
@jwt_required()
def list_announcements():
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    anns = admin_service.list_announcements()
    return (
        jsonify(
            [
                {
                    "id": str(a.id),
                    "title": a.title,
                    "body": a.body,
                    "is_active": a.is_active,
                    "created_at": a.created_at.isoformat(),
                }
                for a in anns
            ]
        ),
        200,
    )


@admin_bp.post("/announcements")
@jwt_required()
def create_announcement():
    actor_id = _require_admin()
    if not actor_id:
        return jsonify({"error": "forbidden"}), 403
    try:
        data = _ann_schema.load(request.get_json() or {})
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400
    ann = admin_service.create_announcement(
        created_by=actor_id,
        title=data["title"],
        body=data["body"],
        is_active=data.get("is_active", True),
    )
    return jsonify({"id": str(ann.id), "title": ann.title}), 201


@admin_bp.patch("/announcements/<ann_id>")
@jwt_required()
def update_announcement(ann_id):
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    try:
        data = _ann_schema.load(request.get_json() or {}, partial=True)
    except ValidationError as e:
        return jsonify({"error": "validation_error", "detail": e.messages}), 400
    try:
        ann = admin_service.update_announcement(ann_id, **data)
    except ValueError:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"id": str(ann.id), "is_active": ann.is_active}), 200


@admin_bp.delete("/announcements/<ann_id>")
@jwt_required()
def delete_announcement(ann_id):
    if not _require_admin():
        return jsonify({"error": "forbidden"}), 403
    try:
        admin_service.delete_announcement(ann_id)
    except ValueError:
        return jsonify({"error": "not_found"}), 404
    return "", 204
