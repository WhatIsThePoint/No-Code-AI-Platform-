"""
Sprint 7 Module 3 — publish training progress events to the gateway's
SocketIO Redis message queue so clients connected to the gateway receive
them in real time.

The Celery worker is *not* a SocketIO server itself — it's an external
emitter. flask-socketio's `SocketIO(message_queue=...)` constructor gives
us exactly that: any process can build one and call `.emit()`, which
pushes the event onto the shared Redis queue; subscribed gateway workers
relay it to connected clients in the matching room.

If `SOCKETIO_MESSAGE_QUEUE` is unset (e.g. in unit tests), every helper
becomes a silent no-op so imports stay cheap and tests stay isolated.
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

        # write_only=True keeps the worker from spinning up its own
        # listener — it just publishes onto the queue.
        _emitter = SocketIO(message_queue=queue_url, async_mode="threading")
    except Exception:  # noqa: BLE001
        log.exception("realtime_emitter init failed; events will be dropped")
        _emitter_init_failed = True
        _emitter = None
    return _emitter


def _room(pipeline_id: str) -> str:
    return f"pipeline_{pipeline_id}"


def emit_training_event(pipeline_id: str, event: str, payload: dict[str, Any]) -> None:
    """Best-effort emit. Never raises — the training task must not be
    blocked by a transient Redis blip."""
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
        log.exception("emit %s on %s failed", event, _room(pipeline_id))


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
    """One sample on the live metric line — chart Y-axis is auto-scaled
    on the client so absolute scale doesn't matter here."""
    emit_training_event(
        pipeline_id,
        "training_metric",
        {"step": step, "metric": metric, "value": float(value), "split": split},
    )


def emit_complete(pipeline_id: str, **payload: Any) -> None:
    emit_training_event(pipeline_id, "training_complete", payload)


def emit_failed(pipeline_id: str, error: str) -> None:
    emit_training_event(pipeline_id, "training_failed", {"error": error[:300]})
