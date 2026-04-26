"""Sprint 6 — project ACL & member-management endpoints.

Two consumers:
  - api-gateway middleware  → POST /acl/projects/check (server-to-server)
  - frontend (Manage Access) → /projects/<id>/members CRUD (JWT)

Pipelines themselves still live in Mongo; this service only owns the
project_members ACL rows + the access-decision logic.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from ..models.company import Membership
from ..models.user import User
from ..services import acl_service

projects_bp = Blueprint("projects", __name__)


# ─────────────────────────────────────────────────────────────────────────────
# Server-to-server ACL check (called by api-gateway middleware)
# ─────────────────────────────────────────────────────────────────────────────


@projects_bp.post("/acl/projects/check")
def acl_check():
    """Decide whether `user_id` may perform `permission` on a project.

    The gateway already knows the project's owner_type / owner_id / company_id
    (it fetches the Mongo doc from ml-training-service) and forwards them here
    as JSON. This endpoint is intentionally JWT-free because it's intended for
    in-cluster service-to-service traffic; we'll lock it down with a network
    policy / shared secret in a later sprint.
    """
    body = request.get_json(silent=True) or {}
    required_fields = ("user_id", "project_id", "owner_type", "project_owner_id")
    missing = [f for f in required_fields if not body.get(f)]
    if missing:
        return jsonify({"error": "missing_fields", "fields": missing}), 400

    decision = acl_service.check_access(
        user_id=body["user_id"],
        project_id=body["project_id"],
        owner_type=body["owner_type"],
        project_owner_id=body["project_owner_id"],
        company_id=body.get("company_id"),
        required=body.get("permission", "read"),
    )
    return (
        jsonify(
            {
                "allowed": decision.allowed,
                "role": decision.role,
                "reason": decision.reason,
            }
        ),
        200,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Member-management CRUD (called by frontend Manage Access tab)
# ─────────────────────────────────────────────────────────────────────────────


def _require_admin_for_project(project_id: str) -> tuple[bool, dict | None, int]:
    """Caller must be Project Manager (admin) on this project, OR super_admin,
    OR Company Owner. Returns (ok, error_payload, status)."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return False, {"error": "unauthorized"}, 401
    if user.role == "super_admin":
        return True, None, 200

    # Caller's company membership (the only company the project could belong to).
    company_id = (request.args.get("company_id") or
                  (request.get_json(silent=True) or {}).get("company_id"))
    if not company_id:
        return False, {"error": "company_id_required"}, 400

    decision = acl_service.check_access(
        user_id=str(user_id),
        project_id=project_id,
        owner_type="company",
        project_owner_id=str(user_id),  # not relevant for the manage_members rule
        company_id=company_id,
        required="manage_members",
    )
    if not decision.allowed:
        return False, {"error": "forbidden", "reason": decision.reason}, 403
    return True, None, 200


@projects_bp.get("/projects/<project_id>/members")
@jwt_required()
def list_project_members(project_id: str):
    # Any authenticated user with read access can list. Gateway already checked
    # read on /pipelines/<id>; here we duplicate the company-membership check
    # cheaply since we have a JWT.
    members = acl_service.list_members(project_id)
    return jsonify({"members": members}), 200


@projects_bp.post("/projects/<project_id>/members")
@jwt_required()
def add_project_member(project_id: str):
    ok, err, status = _require_admin_for_project(project_id)
    if not ok:
        return jsonify(err), status

    body = request.get_json(silent=True) or {}
    target_user_id = body.get("user_id")
    role = body.get("role", "viewer")
    company_id = body.get("company_id")
    if not target_user_id or not company_id:
        return jsonify({"error": "user_id_and_company_id_required"}), 400

    # Target user must be a company member.
    has_membership = (
        Membership.query.filter_by(
            user_id=target_user_id, company_id=company_id, status="active"
        ).first()
        is not None
    )
    if not has_membership:
        return jsonify({"error": "target_user_not_in_company"}), 400

    try:
        pm = acl_service.add_or_update_member(
            project_id=project_id,
            company_id=company_id,
            user_id=target_user_id,
            role=role,
            granted_by=get_jwt_identity(),
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    return (
        jsonify(
            {
                "user_id": str(pm.user_id),
                "role": pm.role,
                "project_id": pm.project_id,
            }
        ),
        201,
    )


@projects_bp.delete("/projects/<project_id>/members/<user_id>")
@jwt_required()
def remove_project_member(project_id: str, user_id: str):
    ok, err, status = _require_admin_for_project(project_id)
    if not ok:
        return jsonify(err), status
    removed = acl_service.remove_member(project_id=project_id, user_id=user_id)
    if not removed:
        return jsonify({"error": "not_found"}), 404
    return jsonify({"deleted": True}), 200


# Allow the gateway to enrich tokens with a hint (purely advisory).
@projects_bp.get("/me/role")
@jwt_required()
def my_role():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    claims = get_jwt()
    return (
        jsonify(
            {
                "user_id": str(user_id),
                "role": user.role if user else None,
                "tier": claims.get("tier"),
            }
        ),
        200,
    )
