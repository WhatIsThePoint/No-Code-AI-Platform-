from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..extensions import mongo
from ..tasks.preprocessing import run_preprocessing

preprocessing_bp = Blueprint("preprocessing", __name__)


@preprocessing_bp.post("/datasets/<dataset_id>/preprocess")
def preprocess(dataset_id):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    data = request.get_json() or {}

    # Validate split ratios
    ratios = data.get("split_ratios", {"train": 0.7, "val": 0.15, "test": 0.15})
    total = sum(ratios.values())
    if abs(total - 1.0) > 0.01:
        return (
            jsonify(
                {"error": "invalid_split_ratios", "detail": "Ratios must sum to 1.0"}
            ),
            400,
        )

    company_id = data.get("company_id") or request.args.get("company_id")
    clauses = [{"user_id": user_id}]
    if company_id:
        clauses.append({"company_id": company_id})
    doc = mongo.get_collection("datasets").find_one(
        {"dataset_id": dataset_id, "$or": clauses},
        {"status": 1},
    )
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["status"] not in ("ready", "preprocessed"):
        return jsonify({"error": "dataset_not_ready", "status": doc["status"]}), 409

    config = {
        "target_column": data.get("target_column"),
        "included_columns": data.get("included_columns", []),
        "excluded_columns": data.get("excluded_columns", []),
        "imputation_strategy": data.get("imputation_strategy", "mean"),
        "encoding_strategy": data.get("encoding_strategy", "onehot"),
        "scaling_strategy": data.get("scaling_strategy", "standard"),
        "split_ratios": ratios,
    }

    task = run_preprocessing.apply_async(args=[dataset_id, config], queue="ingestion")
    now = datetime.now(timezone.utc)

    mongo.get_collection("task_results").insert_one(
        {
            "task_id": task.id,
            "dataset_id": dataset_id,
            "task_type": "preprocessing",
            "status": "pending",
            "progress_pct": 0,
            "created_at": now,
        }
    )
    # Refresh the "last edited by" stamp — kicking preprocessing is a real
    # mutation from the user's perspective even though the dataset row
    # otherwise stays the same until the worker reports back.
    mongo.get_collection("datasets").update_one(
        {"dataset_id": dataset_id},
        {"$set": {"last_edited_by": user_id, "last_edited_at": now}},
    )

    return jsonify({"task_id": task.id, "status": "preprocessing"}), 202
