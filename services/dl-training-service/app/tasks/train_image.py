"""Image-classification training task.

End-to-end:
  1. Mark task_results / model_versions as `running`.
  2. Load images via ImageFolder, split train/val.
  3. Build the model from the arch registry.
  4. Train with mixed precision when CUDA is available (halves activation
     memory, fits a comfortable batch on the 1660 Super).
  5. Per epoch: write a fresh metric point to task_results.live_metrics
     and emit a `training_epoch` socket event.
  6. On success: save the state_dict + sidecar via model_storage and mark
     task_results / model_versions as `success`.
  7. On failure: best-effort error capture into task_results, then re-raise
     so Celery records the traceback.

The Celery task is defined here (not in a generic tasks module) so the
worker autodiscovery in `celery_app.py` finds it via the
`app.tasks.train_image.run` route — same convention as ml-training.
"""

from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Any

from .celery_app import celery


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _open_db():
    """Open a fresh Mongo client for this task. The Flask app's PyMongo
    extension lives in the API process, not the worker — re-using it from
    Celery would be a cross-process pickle hazard."""
    import pymongo

    mongo_url = os.environ["MONGO_URL"]
    mongo_db = os.environ.get("MONGO_DB", "nocode_ingestion")
    client = pymongo.MongoClient(mongo_url)
    return client, client[mongo_db]


def _update_progress(task_results, task_id: str, pct: int, stage: str, **extra: Any) -> None:
    """Single source of truth for task_results writes — keeps the doc shape
    identical to ml-training's `task_results` so the gateway's polling
    endpoint and the LiveTrainingChart subscriber don't need to fork on
    framework."""
    upd = {"progress_pct": pct, "stage": stage, **extra}
    task_results.update_one({"task_id": task_id}, {"$set": upd})


@celery.task(name="app.tasks.train_image.run", bind=True, max_retries=0)
def run(
    self,
    pipeline_id: str,
    dataset_id: str,
    version_id: str,
    user_id: str,
    hparams: dict,
) -> dict:
    # Lazy heavy imports — keeps Celery's autodiscover scan cheap, and
    # means a worker that's never asked to train doesn't pay the torch
    # CUDA-runtime initialisation cost just to subscribe to the queue.
    import torch
    from torch import nn, optim
    from torch.utils.data import DataLoader

    from ..archs import build as build_arch
    from ..services import model_storage
    from ..services.image_dataset import load_split
    from ..services.realtime_emitter import (
        emit_complete,
        emit_epoch,
        emit_failed,
        emit_progress,
    )

    task_id = self.request.id
    started = time.time()
    client, db = _open_db()
    task_results = db["task_results"]
    model_versions = db["model_versions"]
    pipelines = db["pipelines"]

    task_results.update_one(
        {"task_id": task_id},
        {
            "$set": {
                "status": "running",
                "started_at": _now(),
                "progress_pct": 0,
                "stage": "loading_data",
                "task_type": "dl_training",
                "pipeline_id": pipeline_id,
                "dataset_id": dataset_id,
                "version_id": version_id,
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
        epochs = int(hparams["epochs"])
        batch_size = int(hparams["batch_size"])
        lr = float(hparams["lr"])
        optimizer_name = hparams["optimizer"]
        arch = hparams["arch"]
        input_size = int(hparams["input_size"])
        pretrained = bool(hparams.get("pretrained", False))
        augment = bool(hparams.get("augment", False))

        # ── Data ──────────────────────────────────────────────────────────
        emit_progress(pipeline_id, 5, "loading_data")
        dataset_root = os.environ.get("IMAGE_DATASET_ROOT", "/uploads/images")
        train_set, val_set, idx_to_class = load_split(
            dataset_root=dataset_root,
            dataset_id=dataset_id,
            input_size=input_size,
            augment=augment,
        )
        num_classes = len(idx_to_class)
        if num_classes < 2:
            raise ValueError(
                f"Need at least 2 classes; dataset has {num_classes}."
            )

        # Celery's default prefork pool runs tasks as *daemonic* worker
        # processes, and Python's multiprocessing refuses to let a daemon
        # spawn further children — which is exactly what
        # `DataLoader(num_workers>0)` does. The result is an
        # AssertionError("daemonic processes are not allowed to have
        # children") the moment training tries to iterate the loader.
        # `num_workers=0` runs the loader in-process, which is the
        # correct setting for a Celery worker. The throughput cost is
        # negligible on the demo's small image datasets — the dominant
        # term is the GPU forward/backward pass, not data loading.
        # `pin_memory=True` only when the model will live on CUDA — pinning
        # host memory for a CPU run wastes RAM and accomplishes nothing.
        cuda_available = torch.cuda.is_available()
        train_loader = DataLoader(
            train_set,
            batch_size=batch_size,
            shuffle=True,
            num_workers=0,
            pin_memory=cuda_available,
            drop_last=False,
        )
        val_loader = DataLoader(
            val_set,
            batch_size=batch_size,
            shuffle=False,
            num_workers=0,
            pin_memory=cuda_available,
            drop_last=False,
        )

        # ── Model ─────────────────────────────────────────────────────────
        emit_progress(pipeline_id, 10, "building_model")
        device = torch.device("cuda" if cuda_available else "cpu")
        model = build_arch(
            arch=arch,
            num_classes=num_classes,
            input_size=input_size,
            pretrained=pretrained,
        ).to(device)

        if optimizer_name == "adam":
            optimizer = optim.Adam(model.parameters(), lr=lr)
        else:
            optimizer = optim.SGD(model.parameters(), lr=lr, momentum=0.9, nesterov=True)

        criterion = nn.CrossEntropyLoss()
        # Mixed precision halves activation memory on Turing+. CPU training
        # bypasses this entirely — autocast on CPU works but offers no
        # measurable speed-up and complicates the loss path.
        scaler = torch.amp.GradScaler("cuda") if cuda_available else None

        # ── Training loop ────────────────────────────────────────────────
        live_metrics: list[dict] = []
        best_val_acc = 0.0

        for epoch in range(1, epochs + 1):
            model.train()
            train_loss_sum = 0.0
            train_n = 0
            for images, labels in train_loader:
                images = images.to(device, non_blocking=cuda_available)
                labels = labels.to(device, non_blocking=cuda_available)

                optimizer.zero_grad(set_to_none=True)
                if scaler is not None:
                    with torch.amp.autocast("cuda"):
                        logits = model(images)
                        loss = criterion(logits, labels)
                    scaler.scale(loss).backward()
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    logits = model(images)
                    loss = criterion(logits, labels)
                    loss.backward()
                    optimizer.step()

                train_loss_sum += float(loss.item()) * images.size(0)
                train_n += images.size(0)

            train_loss = train_loss_sum / max(1, train_n)

            # ── Validation ───────────────────────────────────────────────
            model.eval()
            val_loss_sum = 0.0
            val_correct = 0
            val_n = 0
            with torch.no_grad():
                for images, labels in val_loader:
                    images = images.to(device, non_blocking=cuda_available)
                    labels = labels.to(device, non_blocking=cuda_available)
                    if cuda_available:
                        with torch.amp.autocast("cuda"):
                            logits = model(images)
                            loss = criterion(logits, labels)
                    else:
                        logits = model(images)
                        loss = criterion(logits, labels)
                    val_loss_sum += float(loss.item()) * images.size(0)
                    val_correct += int((logits.argmax(dim=1) == labels).sum().item())
                    val_n += images.size(0)

            val_loss = val_loss_sum / max(1, val_n)
            val_acc = val_correct / max(1, val_n)
            best_val_acc = max(best_val_acc, val_acc)

            # `progress_pct` reserves the final 5 % for save/cleanup so a
            # 100 % bar never sits there for two seconds at the end.
            pct = int(round(15 + (epoch / epochs) * 80))
            point = {
                "epoch": epoch,
                "train_loss": round(train_loss, 5),
                "val_loss": round(val_loss, 5),
                "val_acc": round(val_acc, 5),
            }
            live_metrics.append(point)
            task_results.update_one(
                {"task_id": task_id},
                {
                    "$set": {
                        "progress_pct": pct,
                        "stage": f"epoch_{epoch}_of_{epochs}",
                        "live_metrics": live_metrics,
                    }
                },
            )
            emit_epoch(
                pipeline_id,
                epoch=epoch,
                epochs_total=epochs,
                train_loss=train_loss,
                val_loss=val_loss,
                val_acc=val_acc,
            )

        # ── Save artefacts ────────────────────────────────────────────────
        _update_progress(task_results, task_id, 95, "saving_model")
        model_folder = os.environ.get("MODEL_FOLDER", "/models")
        meta = {
            "framework": "pytorch",
            "arch": arch,
            "pretrained": pretrained,
            "input_size": input_size,
            "epochs": epochs,
            "batch_size": batch_size,
            "lr": lr,
            "optimizer": optimizer_name,
            "augment": augment,
            "dataset_id": dataset_id,
            "pipeline_id": pipeline_id,
            "user_id": user_id,
            "metrics": {
                "val_acc": round(best_val_acc, 5),
                "final_train_loss": round(train_loss, 5),
                "final_val_loss": round(val_loss, 5),
            },
            "duration_s": round(time.time() - started, 2),
            "trained_at": _now().isoformat(),
        }
        model_storage.save(
            model_folder=model_folder,
            version_id=version_id,
            state_dict=model.state_dict(),
            class_index=idx_to_class,
            meta=meta,
        )

        # ── Mongo bookkeeping ────────────────────────────────────────────
        # `artifact_path` points at the model.pt file so the existing
        # ml-training /models/<id>/download endpoint can stream it back
        # without per-framework branching. The class_index + meta sidecars
        # live in the same directory and are exposed via /models/<id>
        # (which returns the full doc, including the meta we just saved).
        from ..services import model_storage as _ms

        model_versions.update_one(
            {"version_id": version_id},
            {
                "$set": {
                    "status": "ready",
                    "framework": "pytorch",
                    "arch": arch,
                    "metrics": meta["metrics"],
                    "trained_at": _now(),
                    "duration_s": meta["duration_s"],
                    "artifact_path": _ms.model_state_path(model_folder, version_id),
                    "artifact_dir": _ms.version_dir(model_folder, version_id),
                }
            },
        )
        pipelines.update_one(
            {"pipeline_id": pipeline_id},
            {
                "$set": {
                    "status": "done",
                    "last_version_id": version_id,
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
                    "metrics": meta["metrics"],
                    "version_id": version_id,
                }
            },
        )

        emit_complete(
            pipeline_id,
            version_id=version_id,
            metrics=meta["metrics"],
            duration_s=meta["duration_s"],
        )
        return {"version_id": version_id, "metrics": meta["metrics"]}

    except Exception as exc:
        # Map worker exceptions into a user-readable failure on every
        # surface that's currently spinning a UI: socket banner, polled
        # task_results, model_versions row, pipeline status.
        from ..services.realtime_emitter import emit_failed as _emit_failed

        message = str(exc)[:500] or exc.__class__.__name__
        _emit_failed(pipeline_id, message)
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
        model_versions.update_one(
            {"version_id": version_id},
            {"$set": {"status": "error", "error_message": message}},
        )
        pipelines.update_one(
            {"pipeline_id": pipeline_id},
            {"$set": {"status": "error", "updated_at": _now()}},
        )
        raise

    finally:
        client.close()
