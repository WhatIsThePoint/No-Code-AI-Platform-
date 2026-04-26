"""
Sprint 7 Module 4 — POST /api/companion/ask.

Auth: any logged-in user. Rate limit: 30/min/user (LLM calls are
expensive on the local 6 GB GPU).
Body: {"question": str, "context": {...optional}}
Returns: {"answer": str, "model": str, "elapsed_ms": int}
"""

from __future__ import annotations

import logging

import requests
from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from ..services.companion_service import ask_companion

log = logging.getLogger(__name__)

companion_bp = Blueprint("companion", __name__, url_prefix="/api/companion")


def _limiter():
    return current_app.extensions.get("limiter")


@companion_bp.post("/ask")
@jwt_required()
def ask():
    body = request.get_json(silent=True) or {}
    question = (body.get("question") or "").strip()
    context = body.get("context") or None

    if not question:
        return jsonify({"error": "question_required"}), 400
    if not isinstance(context, (dict, type(None))):
        return jsonify({"error": "invalid_context"}), 400

    try:
        result = ask_companion(question, context=context)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except requests.Timeout:
        return jsonify({"error": "ollama_timeout"}), 504
    except requests.ConnectionError:
        return jsonify({"error": "ollama_unavailable"}), 503
    except requests.HTTPError as exc:
        log.warning("ollama returned %s", exc.response.status_code if exc.response else "?")
        return jsonify({"error": "ollama_error"}), 502
    except Exception:  # noqa: BLE001
        log.exception("companion failed")
        return jsonify({"error": "companion_error"}), 500

    return jsonify(result), 200


# Apply per-user rate limit (configured in app factory).
def _attach_limit(app):
    limiter = app.extensions.get("limiter")
    if limiter is not None:
        limiter.limit("30/minute")(companion_bp)
