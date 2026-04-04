"""
Pipeline step notes: collaborative annotations per pipeline node.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..extensions import mongo

notes_bp = Blueprint("notes", __name__)


def _col():
    return mongo.db["pipeline_step_notes"]


def _serialize(doc: dict) -> dict:
    doc.pop("_id", None)
    for f in ("created_at", "updated_at"):
        if f in doc and hasattr(doc[f], "isoformat"):
            doc[f] = doc[f].isoformat()
    return doc


@notes_bp.get("/pipelines/<pipeline_id>/nodes/<node_id>/notes")
def list_notes(pipeline_id: str, node_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    pipeline = mongo.db["pipelines"].find_one({"pipeline_id": pipeline_id})
    if not pipeline:
        return jsonify({"error": "not_found"}), 404

    # Any member can read notes (owner or company member)
    docs = list(
        _col()
        .find({"pipeline_id": pipeline_id, "node_id": node_id}, {"_id": 0})
        .sort("created_at", 1)
    )
    for d in docs:
        _serialize(d)
    return jsonify({"items": docs}), 200


@notes_bp.post("/pipelines/<pipeline_id>/nodes/<node_id>/notes")
def create_note(pipeline_id: str, node_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    body = request.get_json(silent=True) or {}
    content = (body.get("content") or "").strip()
    if not content:
        return jsonify({"error": "content_required"}), 400

    now = datetime.now(timezone.utc)
    doc = {
        "note_id": str(uuid.uuid4()),
        "pipeline_id": pipeline_id,
        "node_id": node_id,
        "user_id": user_id,
        "content": content,
        "created_at": now,
        "updated_at": now,
    }
    _col().insert_one(doc)
    return jsonify(_serialize(doc)), 201


@notes_bp.patch("/pipelines/<pipeline_id>/nodes/<node_id>/notes/<note_id>")
def update_note(pipeline_id: str, node_id: str, note_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    doc = _col().find_one({"note_id": note_id})
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403

    body = request.get_json(silent=True) or {}
    content = (body.get("content") or "").strip()
    if not content:
        return jsonify({"error": "content_required"}), 400

    _col().update_one(
        {"note_id": note_id},
        {"$set": {"content": content, "updated_at": datetime.now(timezone.utc)}},
    )
    updated = _col().find_one({"note_id": note_id}, {"_id": 0})
    return jsonify(_serialize(updated)), 200


@notes_bp.delete("/pipelines/<pipeline_id>/nodes/<node_id>/notes/<note_id>")
def delete_note(pipeline_id: str, node_id: str, note_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    doc = _col().find_one({"note_id": note_id})
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403

    _col().delete_one({"note_id": note_id})
    return jsonify({"deleted": True}), 200
