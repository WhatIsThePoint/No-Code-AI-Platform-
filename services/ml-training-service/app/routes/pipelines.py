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
    for field in ("created_at", "updated_at"):
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
    now = datetime.now(timezone.utc)

    doc = {
        "pipeline_id": str(uuid.uuid4()),
        "user_id": user_id,
        "company_id": body.get("company_id"),
        "name": name,
        "nodes": body.get("nodes", []),
        "edges": body.get("edges", []),
        "status": "draft",
        "last_run_task_id": None,
        "last_version_id": None,
        "created_at": now,
        "updated_at": now,
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

    query = {"user_id": user_id}
    if company_id := request.args.get("company_id"):
        query = {"$or": [{"user_id": user_id}, {"company_id": company_id}]}

    total = _col().count_documents(query)
    docs = list(_col().find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit))
    for d in docs:
        _serialize(d)

    return jsonify({"items": docs, "total": total, "page": page, "limit": limit}), 200


@pipelines_bp.get("/<pipeline_id>")
def get_pipeline(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    doc = _col().find_one({"pipeline_id": pipeline_id}, {"_id": 0})
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["user_id"] != user_id and not doc.get("company_id"):
        return jsonify({"error": "forbidden"}), 403
    return jsonify(_serialize(doc)), 200


@pipelines_bp.put("/<pipeline_id>")
def update_pipeline(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    doc = _col().find_one({"pipeline_id": pipeline_id})
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403

    body = request.get_json(silent=True) or {}
    allowed = {"name", "nodes", "edges"}
    updates = {k: v for k, v in body.items() if k in allowed}
    updates["updated_at"] = datetime.now(timezone.utc)

    _col().update_one({"pipeline_id": pipeline_id}, {"$set": updates})
    updated = _col().find_one({"pipeline_id": pipeline_id}, {"_id": 0})
    return jsonify(_serialize(updated)), 200


@pipelines_bp.delete("/<pipeline_id>")
def delete_pipeline(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    doc = _col().find_one({"pipeline_id": pipeline_id})
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403
    _col().delete_one({"pipeline_id": pipeline_id})
    return jsonify({"deleted": True}), 200
