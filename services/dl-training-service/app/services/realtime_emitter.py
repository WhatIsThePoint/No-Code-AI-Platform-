"""Publish training progress events to the gateway's SocketIO Redis queue.

Mirrors the helper in `ml-training-service` exactly so the frontend's
`/training` namespace receives ML and DL events through the same channel —
no client-side fork. The Celery worker is *not* a SocketIO server itself;
flask-socketio's `SocketIO(message_queue=...)` constructor lets any
process publish onto a shared Redis queue that the gateway then relays to
connected clients in the matching pipeline room.

If `SOCKETIO_MESSAGE_QUEUE` is unset (e.g. in CI / unit tests), every
helper here becomes a silent no-op.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

log = logging.getLogger(__name__)

_NAMESPACE = "/training"
_emitter = None
_emitter_init_failed = False


def _get_emitter():
    global _emitter, _emitter_init_failed
    if _emitter is not None or _emitter_init_failed:
        return _emitter

    queue_url = os.environ.get("SOCKETIO_MESSAGE_QUEUE")
    if not queue_url:
        _emitter_init_failed = True
        return None

    try:
        from flask_socketio import SocketIO

        # write_only via threading async_mode — the worker only publishes,
        # never listens. Matches the pattern used by ml-training-service.
        _emitter = SocketIO(message_queue=queue_url, async_mode="threading")
    except Exception:  # noqa: BLE001
        log.exception("dl realtime_emitter init failed; events will be dropped")
        _emitter_init_failed = True
        _emitter = None
    return _emitter


def _room(pipeline_id: str) -> str:
    return f"pipeline_{pipeline_id}"


def emit_training_event(pipeline_id: str, event: str, payload: dict[str, Any]) -> None:
    """Best-effort emit. Never raises — a Redis blip must not stop training."""
    sio = _get_emitter()
    if sio is None:
        return
    body = {
        "pipeline_id": pipeline_id,
        "ts": datetime.now(timezone.utc).isoformat(),
        **payload,
    }
    try:
        sio.emit(event, body, to=_room(pipeline_id), namespace=_NAMESPACE)
    except Exception:  # noqa: BLE001
        log.exception("dl emit %s on %s failed", event, _room(pipeline_id))


def emit_progress(pipeline_id: str, pct: int, stage: str, **extra: Any) -> None:
    emit_training_event(
        pipeline_id,
        "training_progress",
        {"progress_pct": pct, "stage": stage, **extra},
    )


def emit_metric_point(
    pipeline_id: str,
    step: int,
    metric: str,
    value: float,
    split: str = "train",
) -> None:
    """One sample on the live metric line."""
    emit_training_event(
        pipeline_id,
        "training_metric",
        {"step": step, "metric": metric, "value": float(value), "split": split},
    )


def emit_epoch(
    pipeline_id: str,
    epoch: int,
    epochs_total: int,
    train_loss: float,
    val_loss: float,
    val_acc: float,
) -> None:
    """Single per-epoch packet so the frontend can render four points at
    once instead of four separate `training_metric` events."""
    emit_training_event(
        pipeline_id,
        "training_epoch",
        {
            "epoch": epoch,
            "epochs_total": epochs_total,
            "train_loss": float(train_loss),
            "val_loss": float(val_loss),
            "val_acc": float(val_acc),
        },
    )


def emit_complete(pipeline_id: str, **payload: Any) -> None:
    emit_training_event(pipeline_id, "training_complete", payload)


def emit_failed(pipeline_id: str, error: str) -> None:
    emit_training_event(pipeline_id, "training_failed", {"error": error[:300]})
