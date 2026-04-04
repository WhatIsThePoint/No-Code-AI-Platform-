"""
Model version listing, detail, and download endpoints.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request, send_file

from ..extensions import mongo
from ..services.model_registry import (
    delete_model_version,
    get_model_version,
    list_model_versions,
)

models_bp = Blueprint("models", __name__)


@models_bp.get("/pipelines/<pipeline_id>/models")
def list_versions(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    pipeline = mongo.db["pipelines"].find_one({"pipeline_id": pipeline_id})
    if not pipeline:
        return jsonify({"error": "not_found"}), 404
    if pipeline["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403

    versions = list_model_versions(mongo.db, pipeline_id)
    return jsonify({"items": versions, "total": len(versions)}), 200


@models_bp.get("/models/<version_id>")
def get_version(version_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    doc = get_model_version(mongo.db, version_id)
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403
    return jsonify(doc), 200


@models_bp.get("/models/<version_id>/download")
def download_model(version_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    doc = get_model_version(mongo.db, version_id)
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403

    artifact_path = doc.get("artifact_path")
    if not artifact_path:
        return jsonify({"error": "artifact_missing"}), 404

    filename = f"model_{doc['algorithm']}_{version_id[:8]}.joblib"
    return send_file(
        artifact_path,
        as_attachment=True,
        download_name=filename,
        mimetype="application/octet-stream",
    )


@models_bp.delete("/models/<version_id>")
def delete_version(version_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    doc = get_model_version(mongo.db, version_id)
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403

    delete_model_version(mongo.db, version_id)
    return jsonify({"deleted": True}), 200
