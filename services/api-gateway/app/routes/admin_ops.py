"""
Admin Ops Console — live system telemetry endpoints.

Three live panels back this blueprint:
  * /admin/system/queues  → Redis LLEN per known Celery queue
  * /admin/ollama/models  → list + delete Ollama model weights

Routes are registered BEFORE proxy_bp in main.py so Werkzeug's static-segment
routing wins over `/admin/<path:subpath>`. The hardware probe lives in
routes/system.py and is polled by the same admin panel.
"""

from __future__ import annotations

import requests
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required

admin_ops_bp = Blueprint("admin_ops", __name__)

# Celery queues we ship: ingestion + connectors + rag (data-ingestion-worker)
# and training (ml-training-worker). Add to this list when a new queue lands.
KNOWN_QUEUES = ("ingestion", "connectors", "rag", "training")

OLLAMA_TIMEOUT = 5.0


def _require_admin():
    """Return None if caller is super_admin; otherwise a Flask 403 response."""
    claims = get_jwt()
    if claims.get("role") != "super_admin":
        return jsonify({"error": "forbidden", "message": "super_admin required"}), 403
    return None


# ── Celery queue depths ──────────────────────────────────────────────────────


@admin_ops_bp.get("/admin/system/queues")
@jwt_required()
def queue_depths():
    forbidden = _require_admin()
    if forbidden:
        return forbidden

    redis = current_app.extensions.get("redis")
    if redis is None:
        return jsonify({"error": "redis_unavailable", "queues": {}}), 503

    queues: dict[str, int | None] = {}
    redis_ok = True
    redis_error: str | None = None
    try:
        # Pipeline so we make one round trip rather than N.
        pipe = redis.pipeline()
        for name in KNOWN_QUEUES:
            pipe.llen(name)
        results = pipe.execute()
        for name, length in zip(KNOWN_QUEUES, results):
            try:
                queues[name] = int(length)
            except (TypeError, ValueError):
                queues[name] = None
    except Exception as exc:  # redis.exceptions.RedisError + ConnectionError
        redis_ok = False
        redis_error = str(exc)[:200]
        queues = {name: None for name in KNOWN_QUEUES}

    return (
        jsonify(
            {
                "redis_ok": redis_ok,
                "redis_error": redis_error,
                "queues": queues,
                "total_pending": sum(v for v in queues.values() if v is not None),
            }
        ),
        200,
    )


# ── Ollama registry ──────────────────────────────────────────────────────────


def _ollama_url() -> str:
    return current_app.config["OLLAMA_URL"].rstrip("/")


@admin_ops_bp.get("/admin/ollama/models")
@jwt_required()
def list_ollama_models():
    forbidden = _require_admin()
    if forbidden:
        return forbidden

    url = f"{_ollama_url()}/api/tags"
    try:
        resp = requests.get(url, timeout=OLLAMA_TIMEOUT)
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "ollama_unreachable", "models": []}), 503
    except requests.exceptions.Timeout:
        return jsonify({"error": "ollama_timeout", "models": []}), 504
    except requests.exceptions.HTTPError as exc:
        return jsonify({"error": "ollama_error", "detail": str(exc)[:300]}), 502

    payload = resp.json() or {}
    raw_models = payload.get("models") or []
    # Normalize the shape so the frontend doesn't have to know Ollama's
    # response schema (which has changed across versions).
    models = []
    for m in raw_models:
        details = m.get("details") or {}
        models.append(
            {
                "name": m.get("name") or m.get("model"),
                "size_bytes": int(m.get("size") or 0),
                "modified_at": m.get("modified_at"),
                "digest": m.get("digest"),
                "family": details.get("family"),
                "parameter_size": details.get("parameter_size"),
                "quantization": details.get("quantization_level"),
            }
        )

    return jsonify({"models": models, "count": len(models)}), 200


@admin_ops_bp.delete("/admin/ollama/models/<path:model_name>")
@jwt_required()
def delete_ollama_model(model_name: str):
    forbidden = _require_admin()
    if forbidden:
        return forbidden

    if not model_name or len(model_name) > 200:
        return jsonify({"error": "invalid_model_name"}), 400

    url = f"{_ollama_url()}/api/delete"
    try:
        resp = requests.delete(
            url, json={"name": model_name}, timeout=OLLAMA_TIMEOUT
        )
        # Ollama returns 200 on success and 404 if the model is unknown.
        if resp.status_code == 404:
            return jsonify({"error": "model_not_found", "name": model_name}), 404
        resp.raise_for_status()
    except requests.exceptions.ConnectionError:
        return jsonify({"error": "ollama_unreachable"}), 503
    except requests.exceptions.Timeout:
        return jsonify({"error": "ollama_timeout"}), 504
    except requests.exceptions.HTTPError as exc:
        return jsonify({"error": "ollama_error", "detail": str(exc)[:300]}), 502

    return jsonify({"deleted": model_name}), 200
