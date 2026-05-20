"""Extract an uploaded zip into the ImageFolder layout dl-training expects.

Layout produced under `IMAGE_DATASET_ROOT/<dataset_id>/`:

    dataset_id/
        <class_a>/
            img1.jpg
            img2.png
        <class_b>/
            ...

The zip the user uploads must already group images by class (one folder
per class at the top level). We accept a zip with a single wrapper folder
("CIFAR-10/cat/...") and strip that wrapper transparently so users don't
have to worry about whether they zipped the parent folder or its contents.

Profiling output written back onto the dataset doc:
  class_counts: {<class>: <int>, ...}
  total_images, num_classes, image_dims_sample (first image only — full
  EXIF probe is too expensive on a 50k-image batch)
"""

from __future__ import annotations

import os
import shutil
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from .celery_app import celery

# Image extensions accepted by torchvision.datasets.ImageFolder. Anything
# else inside the zip is silently dropped during the copy step.
_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".gif", ".webp", ".tiff"}

# Defensive caps. A malformed zip with bombing ratios or a typo'd dataset
# (e.g. user zipped their entire camera roll) shouldn't be able to fill
# the host disk before the worker even gets a progress update.
_MAX_FILES = 100_000
_MAX_TOTAL_UNCOMPRESSED_BYTES = 5 * 1024 * 1024 * 1024  # 5 GB


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _safe_member_path(zip_root: Path, member_name: str) -> Path | None:
    """Resolve `member_name` against `zip_root`, refusing path traversal.

    Returns None for members we'd skip (directories, hidden files,
    `__MACOSX/` cruft, anything that escapes the destination).
    """
    if member_name.endswith("/"):
        return None
    if member_name.startswith("__MACOSX/") or "/.DS_Store" in member_name:
        return None
    if member_name.startswith("/") or ".." in member_name.split("/"):
        return None

    target = (zip_root / member_name).resolve()
    try:
        target.relative_to(zip_root.resolve())
    except ValueError:
        return None
    return target


def _detect_wrapper_prefix(top_dirs: set[str], top_files: set[str]) -> str:
    """If the zip has exactly one top-level directory and no top-level files
    that look like images, treat that directory as a wrapper to strip."""
    if len(top_dirs) == 1 and not any(
        Path(name).suffix.lower() in _IMAGE_EXTS for name in top_files
    ):
        return next(iter(top_dirs)) + "/"
    return ""


@celery.task(name="app.tasks.image_extract.run", bind=True, max_retries=0)
def run(self, dataset_id: str, zip_path: str, dataset_root: str) -> dict:
    import pymongo

    mongo_url = os.environ["MONGO_URL"]
    mongo_db = os.environ.get("MONGO_DB", "nocode_ingestion")
    client = pymongo.MongoClient(mongo_url)
    db = client[mongo_db]
    datasets = db["datasets"]
    task_results = db["task_results"]

    task_id = self.request.id
    task_results.update_one(
        {"task_id": task_id},
        {
            "$set": {
                "status": "running",
                "started_at": _now(),
                "stage": "scanning_zip",
                "progress_pct": 5,
            }
        },
        upsert=True,
    )

    target_dir = Path(dataset_root) / dataset_id
    try:
        if not zipfile.is_zipfile(zip_path):
            raise ValueError("Uploaded file is not a valid zip archive.")

        # ── Plan the extraction ──────────────────────────────────────────
        with zipfile.ZipFile(zip_path) as zf:
            members = [m for m in zf.infolist() if not m.is_dir()]
            if len(members) > _MAX_FILES:
                raise ValueError(
                    f"Zip contains {len(members)} files; the limit is {_MAX_FILES}."
                )
            total_uncompressed = sum(m.file_size for m in members)
            if total_uncompressed > _MAX_TOTAL_UNCOMPRESSED_BYTES:
                raise ValueError(
                    f"Uncompressed size {total_uncompressed} bytes exceeds "
                    f"the {_MAX_TOTAL_UNCOMPRESSED_BYTES} byte limit."
                )

            top_dirs: set[str] = set()
            top_files: set[str] = set()
            for m in members:
                head, _, _ = m.filename.partition("/")
                if "/" in m.filename:
                    top_dirs.add(head)
                else:
                    top_files.add(head)
            wrapper = _detect_wrapper_prefix(top_dirs, top_files)

            # ── Extract under the canonical layout ───────────────────────
            target_dir.mkdir(parents=True, exist_ok=True)
            class_counts: Counter[str] = Counter()
            sample_dim: tuple[int, int] | None = None
            written = 0

            for idx, member in enumerate(members):
                rel = member.filename
                if wrapper and rel.startswith(wrapper):
                    rel = rel[len(wrapper):]
                if not rel:
                    continue

                # ImageFolder requires exactly <class>/<file>; deeper nesting
                # is flattened by joining with `__` so users who zipped a
                # train/<class>/<file> tree still produce one folder per
                # class without manual cleanup.
                parts = [p for p in rel.split("/") if p]
                if len(parts) < 2:
                    continue
                class_name = "__".join(parts[:-1])
                filename = parts[-1]
                if Path(filename).suffix.lower() not in _IMAGE_EXTS:
                    continue

                target = _safe_member_path(target_dir, f"{class_name}/{filename}")
                if target is None:
                    continue
                target.parent.mkdir(parents=True, exist_ok=True)

                with zf.open(member) as src, open(target, "wb") as dst:
                    shutil.copyfileobj(src, dst)
                class_counts[class_name] += 1
                written += 1

                # Probe a single image's dimensions for the dataset summary.
                # Done inline (cheap on the first valid file, then skipped)
                # rather than re-opening the directory afterwards.
                if sample_dim is None:
                    try:
                        from PIL import Image

                        with Image.open(target) as im:
                            sample_dim = (im.width, im.height)
                    except Exception:
                        sample_dim = None  # leave as unknown; not fatal

                # Update progress at most once every ~5 % of the work; the
                # wall-clock cost of writing to Mongo per-file would dwarf
                # the actual extraction on small datasets.
                if idx % max(1, len(members) // 20) == 0:
                    pct = 5 + int(idx / max(1, len(members)) * 85)
                    task_results.update_one(
                        {"task_id": task_id},
                        {
                            "$set": {
                                "progress_pct": pct,
                                "stage": f"extracted_{idx}_of_{len(members)}",
                            }
                        },
                    )

        if written == 0:
            raise ValueError(
                "No images found in a usable layout. Each image must sit "
                "inside a folder named after its class, e.g. "
                "dataset.zip > cat/img1.jpg, dog/img2.jpg. "
                "A flat zip of loose image files (no class folders) cannot "
                "be used for classification — group the images into one "
                "folder per label and re-upload."
            )
        if len(class_counts) < 2:
            only = next(iter(class_counts))
            raise ValueError(
                f"Image classification needs at least 2 class folders; the "
                f"zip only produced 1 ('{only}'). Add a second labelled "
                f"folder of images and re-upload."
            )

        # ── Persist dataset profile + mark ready ────────────────────────
        datasets.update_one(
            {"dataset_id": dataset_id},
            {
                "$set": {
                    "status": "ready",
                    "row_count": written,
                    "image_profile": {
                        "total_images": written,
                        "num_classes": len(class_counts),
                        "class_counts": dict(class_counts),
                        "sample_dim": list(sample_dim) if sample_dim else None,
                    },
                    "updated_at": _now(),
                }
            },
        )
        task_results.update_one(
            {"task_id": task_id},
            {
                "$set": {
                    "status": "success",
                    "progress_pct": 100,
                    "stage": "done",
                    "completed_at": _now(),
                    "result": {
                        "total_images": written,
                        "num_classes": len(class_counts),
                    },
                }
            },
        )
        return {
            "dataset_id": dataset_id,
            "total_images": written,
            "num_classes": len(class_counts),
        }

    except Exception as exc:
        # Roll back partial extracts so a failed import doesn't leave
        # half-populated class folders that ImageFolder would later treat
        # as legitimate data.
        try:
            if target_dir.exists():
                shutil.rmtree(target_dir, ignore_errors=True)
        except Exception:
            pass
        message = str(exc)[:500] or exc.__class__.__name__
        datasets.update_one(
            {"dataset_id": dataset_id},
            {"$set": {"status": "error", "error_message": message, "updated_at": _now()}},
        )
        task_results.update_one(
            {"task_id": task_id},
            {
                "$set": {
                    "status": "failure",
                    "stage": "error",
                    "error_message": message,
                    "completed_at": _now(),
                }
            },
        )
        raise

    finally:
        # Drop the source zip — it's been extracted, hanging onto it would
        # double the disk footprint on every dataset.
        try:
            if os.path.exists(zip_path):
                os.remove(zip_path)
        except Exception:
            pass
        client.close()
