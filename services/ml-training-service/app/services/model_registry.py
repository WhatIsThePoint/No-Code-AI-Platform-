"""
Model registry: saves/loads versioned model artifacts with metadata in MongoDB.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Any

import joblib


def _models_col(db):
    return db["model_versions"]


def save_model_version(
    db,
    pipeline_id: str,
    user_id: str,
    algorithm: str,
    task_type: str,
    hyperparams: dict,
    metrics: dict[str, Any],
    estimator: Any,
    model_folder: str,
    training_duration_s: float,
) -> str:
    version_id = str(uuid.uuid4())
    rel_path = os.path.join(pipeline_id, f"{version_id}.joblib")
    abs_path = os.path.join(model_folder, rel_path)

    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    joblib.dump(estimator, abs_path)

    doc = {
        "version_id": version_id,
        "pipeline_id": pipeline_id,
        "user_id": user_id,
        "algorithm": algorithm,
        "task_type": task_type,
        "hyperparams": hyperparams,
        "metrics": metrics,
        "artifact_path": abs_path,
        "training_duration_s": round(training_duration_s, 2),
        "created_at": datetime.now(timezone.utc),
    }
    _models_col(db).insert_one(doc)
    return version_id


def list_model_versions(db, pipeline_id: str) -> list[dict]:
    docs = list(
        _models_col(db)
        .find({"pipeline_id": pipeline_id}, {"_id": 0})
        .sort("created_at", -1)
    )
    for d in docs:
        if "created_at" in d:
            d["created_at"] = d["created_at"].isoformat()
    return docs


def get_model_version(db, version_id: str) -> dict | None:
    doc = _models_col(db).find_one({"version_id": version_id}, {"_id": 0})
    if doc and "created_at" in doc:
        doc["created_at"] = doc["created_at"].isoformat()
    return doc


def delete_model_version(db, version_id: str) -> bool:
    doc = _models_col(db).find_one({"version_id": version_id})
    if not doc:
        return False
    try:
        os.remove(doc["artifact_path"])
    except FileNotFoundError:
        pass
    _models_col(db).delete_one({"version_id": version_id})
    return True
