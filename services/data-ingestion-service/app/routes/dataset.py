import json

import redis as redis_client
from flask import Blueprint, current_app, jsonify, request

from ..extensions import mongo
from ..services.storage_service import load_dataframe

dataset_bp = Blueprint("dataset", __name__)


def _get_user_id():
    return request.headers.get("X-User-Id")


def _ownership_query(dataset_id: str, user_id: str) -> dict:
    """Return a MongoDB query that matches a dataset the caller is allowed to access.
    Accepts ownership (user_id) or company membership (company_id query param).
    """
    company_id = request.args.get("company_id")
    clauses = [{"user_id": user_id}]
    if company_id:
        clauses.append({"company_id": company_id})
    return {"dataset_id": dataset_id, "$or": clauses}


def _serialize_doc(doc: dict) -> dict:
    doc.pop("_id", None)
    # Convert datetime to ISO strings for JSON
    for k, v in doc.items():
        if hasattr(v, "isoformat"):
            doc[k] = v.isoformat()
    return doc


@dataset_bp.patch("/datasets/<dataset_id>")
def rename_dataset(dataset_id):
    """Rename / re-describe a dataset. Owner-only mutation, audit-stamped."""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    body = request.get_json(silent=True) or {}
    allowed = {"name", "description"}
    updates = {k: v.strip() if isinstance(v, str) else v for k, v in body.items() if k in allowed}
    if not updates:
        return jsonify({"error": "no_updates"}), 400
    if "name" in updates and (not updates["name"] or len(updates["name"]) > 255):
        return jsonify({"error": "invalid_name"}), 400

    from datetime import datetime, timezone

    company_id = request.headers.get("X-Company-Id")
    clauses = [{"user_id": user_id}]
    if company_id:
        clauses.append({"company_id": company_id})
    now = datetime.now(timezone.utc)
    updates["updated_at"] = now
    updates["last_edited_by"] = user_id
    updates["last_edited_at"] = now

    result = mongo.get_collection("datasets").update_one(
        {"dataset_id": dataset_id, "$or": clauses}, {"$set": updates}
    )
    if result.matched_count == 0:
        return jsonify({"error": "not_found"}), 404
    doc = mongo.get_collection("datasets").find_one({"dataset_id": dataset_id})
    return jsonify(_serialize_doc(doc)), 200


@dataset_bp.get("/admin/users/<target_user_id>/datasets")
def admin_user_datasets(target_user_id):
    """GDPR export: dump every dataset row owned by `target_user_id`.

    Gated by the gateway's super-admin check; this handler trusts the
    forwarded role header (same pattern as other admin proxy routes).
    """
    if request.headers.get("X-User-Role") != "super_admin":
        return jsonify({"error": "forbidden"}), 403
    cursor = mongo.get_collection("datasets").find({"user_id": target_user_id})
    items = []
    for doc in cursor:
        items.append(_serialize_doc(doc))
    return jsonify({"items": items, "total": len(items)}), 200


@dataset_bp.get("/datasets")
def list_datasets():
    user_id = _get_user_id()
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    company_id = request.args.get("company_id")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    status_filter = request.args.get("status")

    clauses = [{"user_id": user_id}]
    if company_id:
        clauses.append({"company_id": company_id})
    query: dict = {"$or": clauses}
    if status_filter:
        query["status"] = status_filter

    total = mongo.get_collection("datasets").count_documents(query)
    docs = list(
        mongo.get_collection("datasets")
        .find(query, {"_id": 0})
        .sort("created_at", -1)
        .skip((page - 1) * limit)
        .limit(limit)
    )

    return (
        jsonify(
            {
                "items": [_serialize_doc(d) for d in docs],
                "total": total,
                "page": page,
                "limit": limit,
            }
        ),
        200,
    )


@dataset_bp.get("/datasets/<dataset_id>")
def get_dataset(dataset_id):
    user_id = _get_user_id()
    doc = mongo.get_collection("datasets").find_one(
        _ownership_query(dataset_id, user_id),
        {"_id": 0, "sql_connector.password_encrypted": 0},
    )
    if not doc:
        return jsonify({"error": "not_found"}), 404
    return jsonify(_serialize_doc(doc)), 200


@dataset_bp.get("/datasets/<dataset_id>/preview")
def preview_dataset(dataset_id):
    user_id = _get_user_id()
    rows = min(int(request.args.get("rows", 50)), 500)

    doc = mongo.get_collection("datasets").find_one(
        _ownership_query(dataset_id, user_id),
        {"file_path": 1, "status": 1, "source_type": 1},
    )
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["status"] not in ("ready", "preprocessed"):
        return jsonify({"error": "dataset_not_ready", "status": doc["status"]}), 409
    # Image datasets aren't tabular — load_dataframe() doesn't know how to
    # parse a zip and would crash with `Unsupported file type: .zip`.
    # Refuse here with a clear, frontend-actionable error so the dataset
    # detail page can route the user to /image-preview instead.
    if doc.get("source_type") == "image":
        return (
            jsonify(
                {
                    "error": "wrong_source_type",
                    "detail": "This is an image dataset; use /datasets/<id>/image-preview.",
                    "source_type": "image",
                }
            ),
            415,
        )

    # Check Redis cache
    _redis = redis_client.from_url(
        current_app.config["REDIS_URL"], decode_responses=True
    )
    cache_key = f"cache:dataset:{dataset_id}:preview:{rows}"
    cached = _redis.get(cache_key)
    if cached:
        return jsonify(json.loads(cached)), 200

    df = load_dataframe(doc["file_path"])
    sample = df.head(rows)
    result = {
        "columns": list(sample.columns),
        "rows": sample.where(sample.notna(), None).values.tolist(),
        "total_rows": len(df),
    }
    _redis.setex(cache_key, current_app.config["PREVIEW_CACHE_TTL"], json.dumps(result))
    return jsonify(result), 200


@dataset_bp.get("/datasets/<dataset_id>/profile")
def get_profile(dataset_id):
    user_id = _get_user_id()
    doc = mongo.get_collection("datasets").find_one(
        _ownership_query(dataset_id, user_id),
        {"profiling_summary": 1, "status": 1},
    )
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if not doc.get("profiling_summary"):
        return (
            jsonify({"error": "profiling_not_complete", "status": doc.get("status")}),
            409,
        )
    return jsonify(doc["profiling_summary"]), 200


@dataset_bp.delete("/datasets/<dataset_id>")
def delete_dataset(dataset_id):
    user_id = _get_user_id()
    result = mongo.get_collection("datasets").delete_one(
        {"dataset_id": dataset_id, "user_id": user_id}
    )
    if result.deleted_count == 0:
        return jsonify({"error": "not_found"}), 404
    return "", 204
