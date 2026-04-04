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

        summary = compute_profile_summary(df)

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
