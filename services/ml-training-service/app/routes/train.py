"""
Training trigger and status endpoints.
"""
from __future__ import annotations

import os

from flask import Blueprint, current_app, jsonify, request

from ..extensions import mongo
from ..tasks.train import run_training
from ..services.training_service import SUPPORTED_ALGORITHMS

train_bp = Blueprint("train", __name__)


def _task_results():
    return mongo.db["task_results"]


def _pipelines():
    return mongo.db["pipelines"]


def _datasets():
    return mongo.db["datasets"]


@train_bp.post("/pipelines/<pipeline_id>/train")
def start_training(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    user_email = request.headers.get("X-User-Email", "")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    pipeline = _pipelines().find_one({"pipeline_id": pipeline_id})
    if not pipeline:
        return jsonify({"error": "pipeline_not_found"}), 404
    if pipeline["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403
    if pipeline["status"] == "running":
        return jsonify({"error": "already_running"}), 409

    body = request.get_json(silent=True) or {}

    # Extract train node config from body or pipeline nodes
    algorithm = body.get("algorithm")
    task_type = body.get("task_type", "classification")
    hyperparams = body.get("hyperparams", {})
    dataset_id = body.get("dataset_id")
    target_column = body.get("target_column", "")

    if not algorithm:
        # Try to extract from pipeline nodes
        for node in pipeline.get("nodes", []):
            if node.get("type") == "train":
                node_data = node.get("data", {})
                algorithm = node_data.get("algorithm")
                task_type = node_data.get("task_type", "classification")
                hyperparams = node_data.get("hyperparams", {})
                break

    if not algorithm or algorithm not in SUPPORTED_ALGORITHMS:
        return jsonify({
            "error": "invalid_algorithm",
            "supported": SUPPORTED_ALGORITHMS,
        }), 400

    if not dataset_id:
        # Extract from dataset node
        for node in pipeline.get("nodes", []):
            if node.get("type") == "dataset":
                dataset_id = node.get("data", {}).get("dataset_id")
                break

    if not dataset_id:
        return jsonify({"error": "dataset_id_required"}), 400

    dataset = _datasets().find_one({"dataset_id": dataset_id})
    if not dataset:
        return jsonify({"error": "dataset_not_found"}), 404

    upload_folder = current_app.config.get("UPLOAD_FOLDER", "/uploads")
    dataset_dir = os.path.join(upload_folder, dataset_id)

    if not target_column and dataset.get("preprocessing_config"):
        target_column = dataset["preprocessing_config"].get("target_column", "")

    run_config = {
        "user_id": user_id,
        "user_email": user_email,
        "dataset_id": dataset_id,
        "dataset_dir": dataset_dir,
        "target_column": target_column,
        "algorithm": algorithm,
        "task_type": task_type,
        "hyperparams": hyperparams,
        "model_folder": current_app.config.get("MODEL_FOLDER", "/models"),
        "frontend_url": current_app.config.get("FRONTEND_URL", "http://localhost:5173"),
        "pipeline_id": pipeline_id,
    }

    task = run_training.apply_async(
        args=[pipeline_id, run_config],
        queue="training",
    )

    return jsonify({"task_id": task.id, "status": "queued"}), 202


@train_bp.get("/tasks/<task_id>/status")
def get_task_status(task_id: str):
    doc = _task_results().find_one({"task_id": task_id}, {"_id": 0})
    if not doc:
        return jsonify({
            "task_id": task_id,
            "status": "pending",
            "progress_pct": 0,
        }), 200

    for field in ("started_at", "completed_at"):
        if field in doc and hasattr(doc[field], "isoformat"):
            doc[field] = doc[field].isoformat()

    return jsonify(doc), 200
