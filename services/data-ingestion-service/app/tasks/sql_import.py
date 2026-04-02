"""
Celery task: import data from a SQL database.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from .celery_app import celery


@celery.task(name="app.tasks.sql_import.import_from_sql", bind=True)
def import_from_sql(self, dataset_id: str, connector_config: dict):
    from pymongo import MongoClient
    import pandas as pd
    from sqlalchemy import create_engine, text

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

        # Decrypt password
        from ..services.storage_service import decrypt_value
        password = decrypt_value(connector_config["password_encrypted"])

        db_type = connector_config["db_type"]
        if db_type == "postgres":
            conn_str = (
                f"postgresql://{connector_config['username']}:{password}"
                f"@{connector_config['host']}:{connector_config['port']}"
                f"/{connector_config['database']}"
            )
        else:  # mysql
            conn_str = (
                f"mysql+pymysql://{connector_config['username']}:{password}"
                f"@{connector_config['host']}:{connector_config['port']}"
                f"/{connector_config['database']}"
            )

        engine = create_engine(conn_str, connect_args={"connect_timeout": 30})
        task_results.update_one({"task_id": self.request.id}, {"$set": {"progress_pct": 20}})

        # Read in chunks for large datasets
        chunks = []
        with engine.connect() as conn:
            for chunk in pd.read_sql(text(connector_config["query"]), conn, chunksize=50_000):
                chunks.append(chunk)
        df = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()

        task_results.update_one({"task_id": self.request.id}, {"$set": {"progress_pct": 70}})

        # Save as parquet
        upload_folder = os.environ.get("UPLOAD_FOLDER", "/uploads")
        file_path = os.path.join(upload_folder, f"{dataset_id}_raw.parquet")
        df.to_parquet(file_path, index=False)

        datasets.update_one(
            {"dataset_id": dataset_id},
            {
                "$set": {
                    "file_path": file_path,
                    "row_count": len(df),
                    "column_count": len(df.columns),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        task_results.update_one({"task_id": self.request.id}, {"$set": {"progress_pct": 90}})

        # Kick off profiling
        from .profiling import profile_dataset
        profile_dataset.apply_async(args=[dataset_id], queue="ingestion")

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
