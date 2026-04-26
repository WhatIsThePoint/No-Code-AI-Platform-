"""
Celery task: train a model for a pipeline run.
Writes progress + live metrics to MongoDB task_results.
Sends email notification on completion or failure.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone

from ..services.model_registry import save_model_version
from ..services.realtime_emitter import (
    emit_complete,
    emit_failed,
    emit_metric_point,
    emit_progress,
)
from ..services.training_service import get_model, load_split, prepare_xy
from .celery_app import celery


def _progress(
    task_results,
    task_id: str,
    pct: int,
    pipeline_id: str,
    stage: str,
    extra: dict | None = None,
):
    upd = {"progress_pct": pct}
    if extra:
        upd.update(extra)
    task_results.update_one({"task_id": task_id}, {"$set": upd})
    emit_progress(pipeline_id, pct, stage)


@celery.task(name="app.tasks.train.run_training", bind=True)
def run_training(self, pipeline_id: str, run_config: dict):
    """
    run_config keys:
      user_id, user_email, dataset_id, dataset_dir, target_column,
      algorithm, task_type, hyperparams, model_folder, frontend_url
    """
    import pymongo

    mongo_url = os.environ["MONGO_URL"]
    mongo_db = os.environ.get("MONGO_DB", "nocode_ingestion")
    client = pymongo.MongoClient(mongo_url)
    db = client[mongo_db]
    pipelines = db["pipelines"]
    task_results = db["task_results"]

    task_id = self.request.id
    start_time = time.time()

    task_results.update_one(
        {"task_id": task_id},
        {
            "$set": {
                "status": "running",
                "started_at": datetime.now(timezone.utc),
                "progress_pct": 0,
                "task_type": "training",
                "dataset_id": run_config.get("dataset_id"),
                "pipeline_id": pipeline_id,
                "live_metrics": [],
            }
        },
        upsert=True,
    )
    pipelines.update_one(
        {"pipeline_id": pipeline_id},
        {"$set": {"status": "running", "last_run_task_id": task_id}},
    )

    try:
        algorithm = run_config["algorithm"]
        task_type = run_config.get("task_type", "classification")
        hyperparams = run_config.get("hyperparams", {})
        dataset_dir = run_config["dataset_dir"]
        target_column = run_config.get("target_column", "")
        model_folder = run_config.get("model_folder", "/models")
        user_id = run_config["user_id"]

        # ── Load data ──────────────────────────────────────────────────────────
        _progress(task_results, task_id, 10, pipeline_id, "loading_data")
        df_train = load_split(dataset_dir, "train")
        df_test = (
            load_split(dataset_dir, "test") if task_type != "forecasting" else df_train
        )

        _progress(task_results, task_id, 25, pipeline_id, "preparing_features")

        X_train, y_train = prepare_xy(df_train, target_column, task_type)
        X_test, y_test = prepare_xy(df_test, target_column, task_type)

        # ── Train ──────────────────────────────────────────────────────────────
        _progress(task_results, task_id, 40, pipeline_id, "fitting_model")
        model = get_model(algorithm, hyperparams)
        model.train(X_train, y_train)

        _progress(
            task_results,
            task_id,
            75,
            pipeline_id,
            "training_done",
            {"live_metrics": [{"step": "training_done"}]},
        )

        # ── Evaluate ──────────────────────────────────────────────────────────
        metrics = model.evaluate(X_test, y_test)

        # Stream the headline metric so the LiveTrainingChart shows real values
        # (auto-scaling Y-axis on the client absorbs the range mismatch with
        # the prior progress_pct points).
        for metric_name in ("accuracy", "f1", "roc_auc", "r2", "rmse", "mae"):
            value = metrics.get(metric_name)
            if isinstance(value, (int, float)):
                emit_metric_point(
                    pipeline_id, step=100, metric=metric_name, value=value, split="test"
                )

        _progress(task_results, task_id, 90, pipeline_id, "saving_model")

        # ── Save artifact ─────────────────────────────────────────────────────
        duration = time.time() - start_time
        feature_columns = (
            list(X_train.columns) if hasattr(X_train, "columns") else []
        )
        version_id = save_model_version(
            db=db,
            pipeline_id=pipeline_id,
            user_id=user_id,
            algorithm=algorithm,
            task_type=task_type,
            hyperparams=hyperparams,
            metrics=metrics,
            estimator=model.estimator,
            model_folder=model_folder,
            training_duration_s=duration,
            feature_columns=feature_columns,
        )

        pipelines.update_one(
            {"pipeline_id": pipeline_id},
            {
                "$set": {
                    "status": "done",
                    "last_version_id": version_id,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        task_results.update_one(
            {"task_id": task_id},
            {
                "$set": {
                    "status": "success",
                    "progress_pct": 100,
                    "completed_at": datetime.now(timezone.utc),
                    "metrics": metrics,
                    "version_id": version_id,
                }
            },
        )

        emit_complete(
            pipeline_id,
            version_id=version_id,
            metrics=metrics,
            duration_s=round(duration, 2),
        )

        _send_notification(
            run_config, success=True, version_id=version_id, metrics=metrics
        )

    except Exception as exc:
        emit_failed(pipeline_id, str(exc))
        pipelines.update_one(
            {"pipeline_id": pipeline_id},
            {"$set": {"status": "error", "updated_at": datetime.now(timezone.utc)}},
        )
        task_results.update_one(
            {"task_id": task_id},
            {
                "$set": {
                    "status": "failure",
                    "error_message": str(exc)[:500],
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )
        _send_notification(run_config, success=False, error=str(exc))
        raise

    finally:
        client.close()


def _send_notification(run_config: dict, success: bool, **kwargs):
    """Best-effort email notification — never raises."""
    try:
        from flask import Flask
        from flask_mail import Mail, Message

        from ..config import Config

        user_email = run_config.get("user_email")
        if not user_email:
            return

        app = Flask(__name__)
        app.config.from_object(Config)
        m = Mail(app)

        if success:
            metrics = kwargs.get("metrics", {})
            frontend_url = run_config.get("frontend_url", "http://localhost:5173")
            subject = "[NoCode AI] Training complete"
            body = (
                f"Your model has been trained successfully.\n\n"
                f"Algorithm: {run_config.get('algorithm')}\n"
                f"Version: {kwargs.get('version_id', '')}\n"
                f"Metrics: {metrics}\n\n"
                f"View results: {frontend_url}/pipelines/{run_config.get('pipeline_id', '')}\n"
            )
        else:
            subject = "[NoCode AI] Training failed"
            body = (
                f"Your training job failed.\n\n"
                f"Algorithm: {run_config.get('algorithm')}\n"
                f"Error: {kwargs.get('error', 'Unknown error')}\n"
            )

        with app.app_context():
            msg = Message(subject=subject, recipients=[user_email], body=body)
            m.send(msg)

    except Exception:
        pass  # email failure must not affect the training task outcome
