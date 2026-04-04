"""
Model comparison endpoint.
POST /models/compare — compare 2+ model versions on the same dataset.
Available on solo and company tiers only.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..extensions import mongo
from ..limits import check_feature
from ..services.model_registry import get_model_version

compare_bp = Blueprint("compare", __name__)

_COMMON_METRICS = {
    "classification": ["accuracy", "f1", "precision", "recall"],
    "regression": ["r2", "rmse", "mae"],
    "clustering": ["silhouette_score", "inertia", "n_clusters"],
    "forecasting": ["mse", "mae"],
}


@compare_bp.post("/models/compare")
def compare_models():
    user_id = request.headers.get("X-User-Id")
    tier = request.headers.get("X-User-Tier", "free")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    err = check_feature("model_comparison", tier)
    if err:
        return err

    body = request.get_json(silent=True) or {}
    version_ids: list[str] = body.get("version_ids", [])
    if len(version_ids) < 2:
        return jsonify({"error": "at_least_two_versions_required"}), 400
    if len(version_ids) > 10:
        return jsonify({"error": "max_ten_versions"}), 400

    versions = []
    for vid in version_ids:
        doc = get_model_version(mongo.db, vid)
        if not doc:
            return jsonify({"error": "not_found", "version_id": vid}), 404
        if doc["user_id"] != user_id:
            return jsonify({"error": "forbidden", "version_id": vid}), 403
        versions.append(doc)

    # Ensure all models are of the same task type
    task_types = {v["task_type"] for v in versions}
    if len(task_types) > 1:
        return jsonify({"error": "mixed_task_types", "types": list(task_types)}), 400

    task_type = task_types.pop()
    metric_keys = _COMMON_METRICS.get(task_type, [])

    # Build comparison table
    rows = []
    for v in versions:
        metrics = v.get("metrics", {})
        row: dict = {
            "version_id": v["version_id"],
            "algorithm": v["algorithm"],
            "task_type": v["task_type"],
            "training_duration_s": v.get("training_duration_s"),
            "created_at": v.get("created_at"),
        }
        for k in metric_keys:
            row[k] = metrics.get(k)
        # Include all metrics (some may be complex objects like confusion_matrix)
        row["metrics"] = metrics
        rows.append(row)

    # Compute best model per metric (higher = better, except for error metrics)
    lower_is_better = {"rmse", "mae", "mse", "inertia"}
    rankings: dict[str, str | None] = {}
    for k in metric_keys:
        values = [(r["version_id"], r.get(k)) for r in rows if r.get(k) is not None]
        if not values:
            rankings[k] = None
            continue
        try:
            if k in lower_is_better:
                best = min(values, key=lambda x: x[1])
            else:
                best = max(values, key=lambda x: x[1])
            rankings[k] = best[0]
        except TypeError:
            rankings[k] = None

    return (
        jsonify(
            {
                "task_type": task_type,
                "versions": rows,
                "best_by_metric": rankings,
                "metric_keys": metric_keys,
            }
        ),
        200,
    )
