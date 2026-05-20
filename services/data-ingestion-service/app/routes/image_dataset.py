"""POST /datasets/image-upload   — multipart zip upload, kicks off extract task
GET  /datasets/<id>/image-preview — N thumbnails per class (base64) for the canvas
"""

from __future__ import annotations

import base64
import io
import os
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request

from ..extensions import mongo
from ..limits import check_dataset_upload_limit
from ..tasks.image_extract import run as image_extract_task

image_dataset_bp = Blueprint("image_dataset", __name__)


def _now() -> datetime:
    return datetime.now(timezone.utc)


@image_dataset_bp.post("/datasets/image-upload")
def image_upload():
    """Receive a zip of <class>/<file> images and enqueue extraction.

    The route does the absolute minimum synchronously (size check, tier
    quota, save bytes to disk) so the HTTP request returns inside the
    proxy timeout even for 500 MB uploads. Everything CPU-bound — unzip,
    class profiling, Mongo profile write — happens in the Celery task.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    tier = request.headers.get("X-User-Tier", "free")
    err = check_dataset_upload_limit(mongo, user_id, tier)
    if err:
        return err

    if "file" not in request.files:
        return jsonify({"error": "no_file_provided"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.lower().endswith(".zip"):
        return (
            jsonify(
                {"error": "unsupported_file_type", "detail": "Image upload must be a .zip"}
            ),
            400,
        )

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)

    max_size = current_app.config["MAX_IMAGE_UPLOAD_BYTES"]
    if size > max_size:
        return (
            jsonify(
                {
                    "error": "file_too_large",
                    "max_mb": max_size // (1024 * 1024),
                    "got_mb": size // (1024 * 1024),
                }
            ),
            413,
        )

    dataset_id = str(uuid.uuid4())
    company_id = request.form.get("company_id")
    description = (request.form.get("description") or "").strip() or None

    # Save the zip into a per-dataset staging dir under UPLOAD_FOLDER. The
    # extract task removes it on success; on failure the catch block in
    # the task also cleans up the partially-extracted dir under
    # IMAGE_DATASET_ROOT, leaving no orphans either way.
    staging_dir = Path(current_app.config["UPLOAD_FOLDER"]) / "image_zips"
    staging_dir.mkdir(parents=True, exist_ok=True)
    zip_path = str(staging_dir / f"{dataset_id}.zip")
    file.save(zip_path)

    now = _now()
    mongo.get_collection("datasets").insert_one(
        {
            "dataset_id": dataset_id,
            "user_id": user_id,
            "company_id": company_id,
            "name": file.filename,
            "description": description,
            "source_type": "image",
            "file_path": zip_path,         # cleared by the extract task on success
            "status": "extracting",
            "size_bytes": size,
            "created_at": now,
            "updated_at": now,
            "last_edited_by": user_id,
            "last_edited_at": now,
        }
    )

    image_root = current_app.config["IMAGE_DATASET_ROOT"]
    os.makedirs(image_root, exist_ok=True)
    task = image_extract_task.apply_async(
        args=[dataset_id, zip_path, image_root],
        queue="ingestion",
    )

    mongo.get_collection("task_results").insert_one(
        {
            "task_id": task.id,
            "dataset_id": dataset_id,
            "task_type": "image_extract",
            "status": "pending",
            "progress_pct": 0,
            "stage": "queued",
            "created_at": now,
        }
    )
    mongo.get_collection("datasets").update_one(
        {"dataset_id": dataset_id}, {"$set": {"task_id": task.id}}
    )

    return (
        jsonify({"dataset_id": dataset_id, "task_id": task.id, "status": "extracting"}),
        202,
    )


# Thumbnail size used for `image-preview`; small enough that 50 base64
# strings fit comfortably inside one HTTP response, big enough that the
# canvas node renders something recognisable.
_THUMB_PX = 96
_DEFAULT_PER_CLASS = 3
_MAX_PER_CLASS = 6


@image_dataset_bp.get("/datasets/<dataset_id>/image-preview")
def image_preview(dataset_id: str):
    """Returns up to N thumbnails per class as data-URIs for the canvas
    node's class-strip widget. Read-only — never writes to Mongo or disk."""
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    doc = mongo.get_collection("datasets").find_one({"dataset_id": dataset_id})
    if doc is None:
        return jsonify({"error": "dataset_not_found"}), 404
    if doc.get("source_type") != "image":
        return jsonify({"error": "wrong_source_type", "found": doc.get("source_type")}), 400
    if doc.get("status") != "ready":
        return (
            jsonify(
                {"error": "dataset_not_ready", "status": doc.get("status")}
            ),
            409,
        )

    try:
        per_class = int(request.args.get("per_class", _DEFAULT_PER_CLASS))
    except ValueError:
        per_class = _DEFAULT_PER_CLASS
    per_class = max(1, min(per_class, _MAX_PER_CLASS))

    image_root = Path(current_app.config["IMAGE_DATASET_ROOT"]) / dataset_id
    if not image_root.is_dir():
        return jsonify({"error": "dataset_files_missing"}), 410

    # Pillow is imported lazily — keeps the route module loadable without
    # Pillow during test discovery on a host that hasn't pip-installed it.
    from PIL import Image

    samples: list[dict] = []
    classes = sorted(p for p in image_root.iterdir() if p.is_dir())
    for class_dir in classes:
        files = [
            f for f in class_dir.iterdir()
            if f.is_file() and f.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        ]
        if not files:
            continue
        # Deterministic-ish sampling so refreshes don't shuffle every
        # render — seeded from the dataset_id keeps the demo UX stable.
        rng = random.Random(f"{dataset_id}:{class_dir.name}")
        rng.shuffle(files)
        for f in files[:per_class]:
            try:
                with Image.open(f) as im:
                    im.thumbnail((_THUMB_PX, _THUMB_PX))
                    if im.mode not in ("RGB", "L"):
                        im = im.convert("RGB")
                    buf = io.BytesIO()
                    im.save(buf, format="JPEG", quality=70)
                    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
                    samples.append(
                        {
                            "class": class_dir.name,
                            "thumb_b64": f"data:image/jpeg;base64,{encoded}",
                        }
                    )
            except Exception:
                # A single corrupt image shouldn't kill the whole preview.
                continue

    return jsonify({"dataset_id": dataset_id, "samples": samples}), 200
