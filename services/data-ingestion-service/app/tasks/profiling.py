"""
Celery task: profile an uploaded dataset.
Uses pandas + ydata-profiling minimal mode.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from ..services.profiling_service import compute_profile_summary
from ..services.storage_service import load_dataframe
from .celery_app import celery


@celery.task(name="app.tasks.profiling.profile_dataset", bind=True)
def profile_dataset(self, dataset_id: str):
    from pymongo import MongoClient

    mongo_url = os.environ["MONGO_URL"]
    mongo_db = os.environ.get("MONGO_DB", "nocode_ingestion")
    client = MongoClient(mongo_url)
    db = client[mongo_db]

    datasets = db["datasets"]
    task_results = db["task_results"]

    # Mark task as running
    task_results.update_one(
        {"task_id": self.request.id},
        {
            "$set": {
                "status": "running",
                "started_at": datetime.now(timezone.utc),
                "progress_pct": 0,
            }
        },
        upsert=True,
    )

    try:
        doc = datasets.find_one({"dataset_id": dataset_id})
        if not doc:
            raise ValueError(f"Dataset {dataset_id} not found")

        datasets.update_one(
            {"dataset_id": dataset_id},
            {"$set": {"status": "profiling", "task_id": self.request.id}},
        )

        task_results.update_one(
            {"task_id": self.request.id},
            {"$set": {"progress_pct": 10}},
        )

        df = load_dataframe(doc["file_path"])

        task_results.update_one(
            {"task_id": self.request.id},
            {"$set": {"progress_pct": 50}},
        )

        # Sprint 7 Module 2: profile is target-aware when the user has already
        # picked a target via the preprocessing step or upload form.
        target_column = (
            (doc.get("preprocessing_config") or {}).get("target_column")
            or doc.get("target_column")
        )
        summary = compute_profile_summary(df, target_column=target_column)

        # Inject user-provided context (Sprint 5 Module 2.1).
        # Downstream model-suggestion / chat steps read summary["context"]
        # to ground their guidance in the dataset's domain semantics.
        description = (doc.get("description") or "").strip()
        if description:
            summary["context"] = {
                "description": description,
                "source": "user_provided",
            }

        task_results.update_one(
            {"task_id": self.request.id},
            {"$set": {"progress_pct": 90}},
        )

        datasets.update_one(
            {"dataset_id": dataset_id},
            {
                "$set": {
                    "status": "ready",
                    "profiling_summary": summary,
                    "row_count": len(df),
                    "column_count": len(df.columns),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        task_results.update_one(
            {"task_id": self.request.id},
            {
                "$set": {
                    "status": "success",
                    "progress_pct": 100,
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )

    except Exception as exc:
        datasets.update_one(
            {"dataset_id": dataset_id},
            {"$set": {"status": "error"}},
        )
        task_results.update_one(
            {"task_id": self.request.id},
            {
                "$set": {
                    "status": "failure",
                    "error_message": str(exc)[:500],
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )
        raise

    finally:
        client.close()
