"""POST /dl/train, GET /dl/train/<task_id>.

Skeleton for chat 1 — payload validation lives here, but the actual Celery
enqueue + Mongo bookkeeping is wired up in chat 3 once the training task
itself exists. The validation-only path is enough to (a) prove the gateway
proxy works end-to-end and (b) let the frontend wire up its node forms
against a live error contract.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request

from ..archs import available as available_archs
from ..extensions import mongo
from ..services import vram_guard
from ..services.plan_limits import for_tier as tier_limits

train_bp = Blueprint("dl_train", __name__)

# Source of truth lives in the arch registry; the route just enforces the
# closed set so an unknown arch fails at the boundary with a clear 400
# instead of inside the worker.
ALLOWED_ARCHS = set(available_archs())
ALLOWED_OPTIMIZERS = {"sgd", "adam"}
ALLOWED_INPUT_SIZES = {28, 64, 128, 224}


def _validate_payload(data: dict) -> tuple[dict | None, tuple[dict, int] | None]:
    """Returns (payload, None) on success, (None, (error_response, status)) on failure."""
    required = [
        "pipeline_id",
        "dataset_id",
        "arch",
        "input_size",
        "epochs",
        "batch_size",
        "lr",
        "optimizer",
    ]
    for field in required:
        if field not in data:
            return None, (
                {"error": "validation_error", "detail": f"Missing field: {field}"},
                400,
            )

    if data["arch"] not in ALLOWED_ARCHS:
        return None, (
            {
                "error": "validation_error",
                "detail": f"arch must be one of {sorted(ALLOWED_ARCHS)}",
            },
            400,
        )
    if data["optimizer"] not in ALLOWED_OPTIMIZERS:
        return None, (
            {
                "error": "validation_error",
                "detail": f"optimizer must be one of {sorted(ALLOWED_OPTIMIZERS)}",
            },
            400,
        )
    if int(data["input_size"]) not in ALLOWED_INPUT_SIZES:
        return None, (
            {
                "error": "validation_error",
                "detail": f"input_size must be one of {sorted(ALLOWED_INPUT_SIZES)}",
            },
            400,
        )

    epochs = int(data["epochs"])
    batch_size = int(data["batch_size"])
    if epochs < 1 or epochs > current_app.config["HARD_MAX_EPOCHS"]:
        return None, (
            {
                "error": "validation_error",
                "detail": f"epochs must be in [1, {current_app.config['HARD_MAX_EPOCHS']}]",
            },
            400,
        )
    if batch_size < 1 or batch_size > current_app.config["HARD_MAX_BATCH_SIZE"]:
        return None, (
            {
                "error": "validation_error",
                "detail": f"batch_size must be in [1, {current_app.config['HARD_MAX_BATCH_SIZE']}]",
            },
            400,
        )

    try:
        lr = float(data["lr"])
    except (TypeError, ValueError):
        return None, ({"error": "validation_error", "detail": "lr must be a number"}, 400)
    if lr <= 0 or lr > 1:
        return None, ({"error": "validation_error", "detail": "lr must be in (0, 1]"}, 400)

    return (
        {
            "pipeline_id": str(data["pipeline_id"]),
            "dataset_id": str(data["dataset_id"]),
            "arch": data["arch"],
            "pretrained": bool(data.get("pretrained", False)),
            "input_size": int(data["input_size"]),
            "epochs": epochs,
            "batch_size": batch_size,
            "lr": lr,
            "optimizer": data["optimizer"],
            "augment": bool(data.get("augment", False)),
        },
        None,
    )


@train_bp.post("/dl/train")
def start_training():
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    data = request.get_json(silent=True) or {}
    payload, error = _validate_payload(data)
    if error is not None:
        body, status = error
        return jsonify(body), status

    # ── Tier-aware ceilings ──────────────────────────────────────────────
    # The gateway forwards `X-User-Tier` from the JWT claim. We resolve
    # `(max_vram_mb, max_dl_epochs, max_dl_batch_size)` from the per-tier
    # table and use those as the *effective* caps for this request. An
    # explicit `X-Max-*` header (set by the admin proxy when issuing
    # one-off overrides) wins over the tier default — this lets a
    # super-admin temporarily lift caps without invalidating live JWTs.
    tier = request.headers.get("X-User-Tier", "free")
    limits = tier_limits(tier)

    user_max_vram_mb = float(
        request.headers.get(
            "X-Max-Vram-MB",
            min(limits["max_vram_mb"], current_app.config["DEFAULT_MAX_VRAM_MB"]),
        )
    )
    user_max_epochs = int(request.headers.get("X-Max-DL-Epochs", limits["max_dl_epochs"]))
    user_max_batch = int(request.headers.get("X-Max-DL-Batch-Size", limits["max_dl_batch_size"]))

    if payload["epochs"] > user_max_epochs:
        return (
            jsonify(
                {
                    "error": "epochs_over_tier_limit",
                    "detail": f"epochs={payload['epochs']} exceeds tier ceiling {user_max_epochs}.",
                    "tier": tier,
                    "max_dl_epochs": user_max_epochs,
                }
            ),
            400,
        )
    if payload["batch_size"] > user_max_batch:
        return (
            jsonify(
                {
                    "error": "batch_size_over_tier_limit",
                    "detail": (
                        f"batch_size={payload['batch_size']} exceeds tier ceiling "
                        f"{user_max_batch}."
                    ),
                    "tier": tier,
                    "max_dl_batch_size": user_max_batch,
                }
            ),
            400,
        )

    # Pre-flight: refuse jobs whose static memory estimate exceeds the
    # tenant's VRAM budget (with 1 GB headroom for the driver / allocator).
    budget = vram_guard.budget_after_headroom(user_max_vram_mb)
    est = vram_guard.estimate(payload["arch"], payload["input_size"], payload["batch_size"])
    if est.total_mb > budget:
        return (
            jsonify(
                {
                    "error": "vram_budget_exceeded",
                    "detail": (
                        f"Estimated peak VRAM {est.total_mb:.0f} MB exceeds "
                        f"the {budget:.0f} MB budget for this plan. Reduce "
                        f"batch_size or input_size, or pick a smaller arch."
                    ),
                    "estimate": est.to_dict(),
                    "budget_mb": round(budget, 1),
                }
            ),
            400,
        )

    # ── Verify the dataset is image-typed and ready ──────────────────────
    # The frontend node already filters its picker by source_type=image, but
    # an API client could POST any dataset_id — the route needs to defend.
    datasets = mongo.get_collection("datasets")
    dataset = datasets.find_one({"dataset_id": payload["dataset_id"]})
    if dataset is None:
        return jsonify({"error": "dataset_not_found", "dataset_id": payload["dataset_id"]}), 404
    if dataset.get("source_type") != "image":
        return (
            jsonify(
                {
                    "error": "wrong_source_type",
                    "detail": "DL training requires an image dataset.",
                    "found": dataset.get("source_type"),
                }
            ),
            400,
        )
    if dataset.get("status") not in {"ready", "preprocessed"}:
        return (
            jsonify(
                {
                    "error": "dataset_not_ready",
                    "detail": "The image extract task has not finished yet.",
                    "status": dataset.get("status"),
                }
            ),
            409,
        )

    # ── Insert version + enqueue ─────────────────────────────────────────
    version_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    mongo.get_collection("model_versions").insert_one(
        {
            "version_id": version_id,
            "pipeline_id": payload["pipeline_id"],
            "dataset_id": payload["dataset_id"],
            "user_id": user_id,
            "framework": "pytorch",
            "arch": payload["arch"],
            "status": "training",
            "hparams": {
                "input_size": payload["input_size"],
                "epochs": payload["epochs"],
                "batch_size": payload["batch_size"],
                "lr": payload["lr"],
                "optimizer": payload["optimizer"],
                "pretrained": payload["pretrained"],
                "augment": payload["augment"],
            },
            "vram_estimate_mb": est.to_dict(),
            "created_at": now,
        }
    )

    # Imported lazily so the route blueprint loads even when celery isn't
    # reachable (e.g. unit tests stub the task module).
    from ..tasks.train_image import run as train_task

    async_result = train_task.apply_async(
        kwargs={
            "pipeline_id": payload["pipeline_id"],
            "dataset_id": payload["dataset_id"],
            "version_id": version_id,
            "user_id": user_id,
            "hparams": payload,
        },
        queue="dl_training",
    )

    mongo.get_collection("task_results").insert_one(
        {
            "task_id": async_result.id,
            "version_id": version_id,
            "pipeline_id": payload["pipeline_id"],
            "dataset_id": payload["dataset_id"],
            "task_type": "dl_training",
            "status": "pending",
            "progress_pct": 0,
            "stage": "queued",
            "created_at": now,
        }
    )

    return (
        jsonify(
            {
                "task_id": async_result.id,
                "version_id": version_id,
                "estimate": est.to_dict(),
                "budget_mb": round(budget, 1),
            }
        ),
        202,
    )


@train_bp.get("/dl/train/<task_id>")
def training_status(task_id: str):
    """Returns the live state of a DL training run.

    The doc shape is the same one ml-training-service writes for its own
    runs (status, progress_pct, stage, live_metrics, metrics, error_message)
    so the gateway's polling endpoint and the frontend's `useTaskStatus`
    hook stay framework-agnostic — no fork on `framework: "pytorch"` vs.
    `framework: "h2o"`.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    doc = mongo.get_collection("task_results").find_one({"task_id": task_id})
    if doc is None:
        return jsonify({"error": "task_not_found", "task_id": task_id}), 404

    # Strip the Mongo `_id` so the JSON response is stable and doesn't leak
    # the storage primary key. Datetimes are serialised as isoformat for
    # consistency with the other services.
    doc.pop("_id", None)
    for key in ("created_at", "started_at", "completed_at"):
        if isinstance(doc.get(key), datetime):
            doc[key] = doc[key].isoformat()
    return jsonify(doc), 200
