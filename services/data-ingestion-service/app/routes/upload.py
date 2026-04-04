import os
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request

from ..extensions import mongo
from ..services.storage_service import save_uploaded_file
from ..tasks.profiling import profile_dataset

upload_bp = Blueprint("upload", __name__)

ALLOWED_EXTENSIONS = {"csv", "xlsx", "xls"}


def _allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@upload_bp.post("/datasets/upload")
def upload_file():
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    if "file" not in request.files:
        return jsonify({"error": "no_file_provided"}), 400

    file = request.files["file"]
    if not file.filename or not _allowed_file(file.filename):
        return jsonify({"error": "unsupported_file_type"}), 400

    # Check file size
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    max_size = current_app.config["MAX_UPLOAD_BYTES"]
    if size > max_size:
        return (
            jsonify({"error": "file_too_large", "max_mb": max_size // (1024 * 1024)}),
            413,
        )

    dataset_id = str(uuid.uuid4())
    company_id = request.form.get("company_id")

    ext = file.filename.rsplit(".", 1)[1].lower()
    safe_name = f"{dataset_id}.{ext}"
    file_path = save_uploaded_file(
        file, dataset_id, safe_name, current_app.config["UPLOAD_FOLDER"]
    )

    now = datetime.now(timezone.utc)
    doc = {
        "dataset_id": dataset_id,
        "user_id": user_id,
        "company_id": company_id,
        "name": file.filename,
        "source_type": ext if ext != "xls" else "excel",
        "file_path": file_path,
        "status": "uploaded",
        "size_bytes": size,
        "task_id": None,
        "created_at": now,
        "updated_at": now,
    }
    mongo.get_collection("datasets").insert_one(doc)

    # Dispatch profiling task
    task = profile_dataset.apply_async(args=[dataset_id], queue="ingestion")

    # Create task_results entry
    mongo.get_collection("task_results").insert_one(
        {
            "task_id": task.id,
            "dataset_id": dataset_id,
            "task_type": "profiling",
            "status": "pending",
            "progress_pct": 0,
            "created_at": now,
        }
    )
    mongo.get_collection("datasets").update_one(
        {"dataset_id": dataset_id}, {"$set": {"task_id": task.id}}
    )

    return (
        jsonify({"dataset_id": dataset_id, "task_id": task.id, "status": "uploaded"}),
        202,
    )
