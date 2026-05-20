"""
Pipeline CRUD: create, list, get, update, delete.
Pipelines are stored as JSON documents in MongoDB.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..extensions import mongo

pipelines_bp = Blueprint("pipelines", __name__, url_prefix="/pipelines")


def _col():
    return mongo.db["pipelines"]


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    for field in ("created_at", "updated_at", "last_edited_at"):
        if field in doc and hasattr(doc[field], "isoformat"):
            doc[field] = doc[field].isoformat()
    return doc


@pipelines_bp.post("")
def create_pipeline():
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    body = request.get_json(silent=True) or {}
    name = body.get("name", "Untitled Pipeline")
    pipeline_type = body.get("type", "ml")
    # Sprint 8 added the deep-learning workflow as a third pipeline family.
    # The dl-training-service handles its training endpoint; ml-training-
    # service still owns the pipeline document so it must accept the type.
    if pipeline_type not in ("ml", "rag", "dl"):
        return jsonify({"error": "invalid_type"}), 400

    owner_type = body.get("owner_type", "personal")
    if owner_type not in ("personal", "company"):
        return jsonify({"error": "invalid_owner_type"}), 400
    company_id = body.get("company_id")
    if owner_type == "company" and not company_id:
        return jsonify({"error": "company_id_required_for_company_project"}), 400
    if owner_type == "personal":
        company_id = None

    now = datetime.now(timezone.utc)

    doc = {
        "pipeline_id": str(uuid.uuid4()),
        "user_id": user_id,
        "owner_type": owner_type,
        "company_id": company_id,
        "name": name,
        "type": pipeline_type,
        "nodes": body.get("nodes", []),
        "edges": body.get("edges", []),
        "status": "draft",
        "last_run_task_id": None,
        "last_version_id": None,
        "created_at": now,
        "updated_at": now,
        # Sprint 7 Module 5 — collaboration "last edited by" stamp.
        "last_edited_by": user_id,
        "last_edited_at": now,
    }
    _col().insert_one(doc)
    return jsonify(_serialize(doc)), 201


@pipelines_bp.get("")
def list_pipelines():
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    page = int(request.args.get("page", 1))
    limit = min(int(request.args.get("limit", 20)), 100)
    skip = (page - 1) * limit

    # owner_type filter drives the Personal/Company tabs on the dashboard.
    owner_type = request.args.get("owner_type")
    company_id = request.args.get("company_id")

    if owner_type == "personal":
        # Personal projects the user created (no company scope).
        query: dict = {
            "user_id": user_id,
            "$or": [{"owner_type": "personal"}, {"owner_type": {"$exists": False}, "company_id": None}],
        }
    elif owner_type == "company":
        # Company projects visible to this user:
        #   - projects the user created inside the company, OR
        #   - projects where gateway ACL has already cleared the user (membership).
        # At this layer we scope by company_id; the gateway middleware enforces
        # per-project ACL via project_members before the request arrives.
        if not company_id:
            return jsonify({"error": "company_id_required"}), 400
        query = {"company_id": company_id, "owner_type": "company"}
    else:
        # Back-compat: no owner_type filter → user's personal + any company
        # project the gateway has authorised via company_id.
        query = {"user_id": user_id}
        if company_id:
            query = {
                "$or": [
                    {"user_id": user_id},
                    {"company_id": company_id},
                ]
            }

    total = _col().count_documents(query)
    docs = list(
        _col().find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    )
    for d in docs:
        _serialize(d)

    return jsonify({"items": docs, "total": total, "page": page, "limit": limit}), 200


def _can_access(doc: dict, user_id: str, company_id: str | None, user_role: str | None) -> bool:
    """Baseline access check performed *after* gateway ACL middleware.

    Rules:
      - super_admin → always yes
      - personal (owner_type='personal' or legacy no company_id) → only doc.user_id
      - company → company_id in request must match doc.company_id
        (gateway middleware will have already vetted project_members)
    """
    if user_role == "super_admin":
        return True
    owner_type = doc.get("owner_type") or ("company" if doc.get("company_id") else "personal")
    if owner_type == "personal":
        return doc.get("user_id") == user_id
    # company
    return bool(company_id) and doc.get("company_id") == company_id


def _can_mutate(doc: dict, user_id: str, company_id: str | None, user_role: str | None) -> bool:
    """Write-access check. Project Managers / editors are enforced at the gateway
    via project_members.role; this layer just mirrors _can_access for safety."""
    return _can_access(doc, user_id, company_id, user_role)


@pipelines_bp.get("/<pipeline_id>/_acl-meta")
def get_pipeline_acl_meta(pipeline_id: str):
    """Internal endpoint for the gateway's ACL middleware.

    Returns only the fields needed to call /acl/projects/check on the
    auth-service: owner, owner_type, company_id. Intentionally unauthenticated
    inside the cluster — it leaks no sensitive content.
    """
    doc = _col().find_one(
        {"pipeline_id": pipeline_id},
        {"_id": 0, "user_id": 1, "owner_type": 1, "company_id": 1},
    )
    if not doc:
        return jsonify({"error": "not_found"}), 404
    return (
        jsonify(
            {
                "pipeline_id": pipeline_id,
                "user_id": doc.get("user_id"),
                "owner_type": doc.get("owner_type")
                or ("company" if doc.get("company_id") else "personal"),
                "company_id": doc.get("company_id"),
            }
        ),
        200,
    )


@pipelines_bp.get("/<pipeline_id>")
def get_pipeline(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    company_id = request.headers.get("X-Company-Id")
    user_role = request.headers.get("X-User-Role")
    doc = _col().find_one({"pipeline_id": pipeline_id}, {"_id": 0})
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if not _can_access(doc, user_id, company_id, user_role):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(_serialize(doc)), 200


@pipelines_bp.put("/<pipeline_id>")
def update_pipeline(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    company_id = request.headers.get("X-Company-Id")
    user_role = request.headers.get("X-User-Role")
    doc = _col().find_one({"pipeline_id": pipeline_id})
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if not _can_mutate(doc, user_id, company_id, user_role):
        return jsonify({"error": "forbidden"}), 403

    body = request.get_json(silent=True) or {}
    allowed = {"name", "nodes", "edges", "type"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if "type" in updates and updates["type"] not in ("ml", "rag", "dl"):
        return jsonify({"error": "invalid_type"}), 400
    now = datetime.now(timezone.utc)
    updates["updated_at"] = now
    # Stamp who actually saved this revision so the dashboard card can render
    # "Last edited by …". For company projects this is the collaborator who
    # clicked Save, not necessarily the original creator.
    updates["last_edited_by"] = user_id
    updates["last_edited_at"] = now

    _col().update_one({"pipeline_id": pipeline_id}, {"$set": updates})
    updated = _col().find_one({"pipeline_id": pipeline_id}, {"_id": 0})
    return jsonify(_serialize(updated)), 200


@pipelines_bp.delete("/<pipeline_id>")
def delete_pipeline(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    company_id = request.headers.get("X-Company-Id")
    user_role = request.headers.get("X-User-Role")
    doc = _col().find_one({"pipeline_id": pipeline_id})
    if not doc:
        return jsonify({"error": "not_found"}), 404
    # Delete is restricted to the creator OR super_admin, not every company member.
    if user_role != "super_admin" and doc.get("user_id") != user_id:
        return jsonify({"error": "forbidden"}), 403
    _col().delete_one({"pipeline_id": pipeline_id})
    return jsonify({"deleted": True}), 200
