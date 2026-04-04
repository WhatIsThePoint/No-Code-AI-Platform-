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
from ..services import admin_service

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
    try:
        sub = admin_service.override_subscription(
            user_id, data["plan"], data.get("status", "active")
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
    return jsonify({"user_id": user_id, "plan": sub.plan, "status": sub.status}), 200


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
