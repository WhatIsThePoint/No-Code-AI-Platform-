"""
Celery task: run preprocessing pipeline on a dataset.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from .celery_app import celery


@celery.task(name="app.tasks.preprocessing.run_preprocessing", bind=True)
def run_preprocessing(self, dataset_id: str, config: dict):
    from pymongo import MongoClient
    from ..services.preprocessing_service import preprocess_dataset

    mongo_url = os.environ["MONGO_URL"]
    mongo_db = os.environ.get("MONGO_DB", "nocode_ingestion")
    client = MongoClient(mongo_url)
    db = client[mongo_db]

    datasets = db["datasets"]
    task_results = db["task_results"]

    task_results.update_one(
        {"task_id": self.request.id},
        {"$set": {"status": "running", "started_at": datetime.now(timezone.utc), "progress_pct": 0}},
        upsert=True,
    )

    try:
        doc = datasets.find_one({"dataset_id": dataset_id})
        if not doc:
            raise ValueError(f"Dataset {dataset_id} not found")

        datasets.update_one(
            {"dataset_id": dataset_id},
            {"$set": {"status": "preprocessing"}},
        )

        task_results.update_one({"task_id": self.request.id}, {"$set": {"progress_pct": 20}})

        upload_folder = os.environ.get("UPLOAD_FOLDER", "/uploads")
        output_dir = os.path.join(upload_folder, dataset_id)
        os.makedirs(output_dir, exist_ok=True)

        preprocess_dataset(
            file_path=doc["file_path"],
            config=config,
            output_dir=output_dir,
            task_id=self.request.id,
            db=db,
        )

        preprocessed_path = os.path.join(output_dir, "train.parquet")
        datasets.update_one(
            {"dataset_id": dataset_id},
            {
                "$set": {
                    "status": "preprocessed",
                    "preprocessed_file_path": preprocessed_path,
                    "preprocessing_config": config,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        task_results.update_one(
            {"task_id": self.request.id},
            {"$set": {"status": "success", "progress_pct": 100, "completed_at": datetime.now(timezone.utc)}},
        )

    except Exception as exc:
        datasets.update_one({"dataset_id": dataset_id}, {"$set": {"status": "error"}})
        task_results.update_one(
            {"task_id": self.request.id},
            {"$set": {"status": "failure", "error_message": str(exc)[:500], "completed_at": datetime.now(timezone.utc)}},
        )
        raise
    finally:
        client.close()
