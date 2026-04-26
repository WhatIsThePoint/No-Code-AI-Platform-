"""Sprint 7 Module 1 — model export endpoints.

Exposes two pipeline-scoped downloads:

  GET /pipelines/<pipeline_id>/export/tabular  → trained scikit/XGBoost zip
  GET /pipelines/<pipeline_id>/export/genai    → Ollama Modelfile + RAG manifest

The gateway already runs `require_project_access("read")` on the proxy route,
so these handlers only need to mirror the standard pipeline ACL via the
forwarded headers (matches what `/pipelines/<id>` does).
"""

from __future__ import annotations

import os

from flask import Blueprint, Response, current_app, jsonify, request

from ..extensions import mongo
from ..services.export_service import build_genai_zip, build_tabular_zip
from ..services.model_registry import list_model_versions
from ..services.rag_chat import SYSTEM_PROMPT as RAG_SYSTEM_PROMPT

export_bp = Blueprint("export", __name__, url_prefix="/pipelines")


def _can_access(doc: dict, user_id: str | None, company_id: str | None, user_role: str | None) -> bool:
    if user_role == "super_admin":
        return True
    owner_type = doc.get("owner_type") or ("company" if doc.get("company_id") else "personal")
    if owner_type == "personal":
        return doc.get("user_id") == user_id
    return bool(company_id) and doc.get("company_id") == company_id


def _load_pipeline_or_403(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    company_id = request.headers.get("X-Company-Id")
    user_role = request.headers.get("X-User-Role")
    if not user_id:
        return None, (jsonify({"error": "unauthorized"}), 401)

    doc = mongo.db["pipelines"].find_one({"pipeline_id": pipeline_id})
    if not doc:
        return None, (jsonify({"error": "not_found"}), 404)
    if not _can_access(doc, user_id, company_id, user_role):
        return None, (jsonify({"error": "forbidden"}), 403)
    return doc, None


def _zip_response(buf, filename: str) -> Response:
    payload = buf.getvalue()
    return Response(
        payload,
        status=200,
        mimetype="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(payload)),
            "Cache-Control": "no-store",
        },
    )


@export_bp.get("/<pipeline_id>/export/tabular")
def export_tabular(pipeline_id: str):
    pipeline, err = _load_pipeline_or_403(pipeline_id)
    if err:
        return err

    if pipeline.get("type") == "rag":
        return (
            jsonify(
                {
                    "error": "wrong_pipeline_type",
                    "message": "Use /export/genai for RAG pipelines.",
                }
            ),
            400,
        )

    versions = list_model_versions(mongo.db, pipeline_id)
    if not versions:
        return jsonify({"error": "no_trained_model"}), 404

    latest = versions[0]  # already sorted desc by created_at
    try:
        buf = build_tabular_zip(latest)
    except FileNotFoundError:
        return jsonify({"error": "artifact_missing"}), 410

    filename = f"{pipeline.get('name') or 'model'}_{latest['version_id'][:8]}.zip"
    # Strip path-unfriendly chars.
    filename = "".join(c if c.isalnum() or c in "._-" else "_" for c in filename)
    return _zip_response(buf, filename)


@export_bp.get("/<pipeline_id>/export/genai")
def export_genai(pipeline_id: str):
    pipeline, err = _load_pipeline_or_403(pipeline_id)
    if err:
        return err

    if pipeline.get("type") != "rag":
        return (
            jsonify(
                {
                    "error": "wrong_pipeline_type",
                    "message": "Use /export/tabular for ML pipelines.",
                }
            ),
            400,
        )

    # RAG documents live on the data-ingestion service's mongo (same cluster,
    # same DB by convention). Read directly via the shared client.
    docs = list(
        mongo.db["rag_documents"]
        .find({"pipeline_id": pipeline_id}, {"_id": 0})
        .sort("uploaded_at", -1)
    )

    base_model = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")

    try:
        buf = build_genai_zip(
            pipeline_doc=pipeline,
            documents=docs,
            system_prompt=RAG_SYSTEM_PROMPT,
            base_model=base_model,
        )
    except Exception as exc:  # never leak Mongo / FS internals
        current_app.logger.exception("genai export failed")
        return jsonify({"error": "export_failed", "message": str(exc)[:200]}), 500

    safe_name = "".join(
        c if c.isalnum() or c in "._-" else "_" for c in (pipeline.get("name") or "rag")
    )
    filename = f"{safe_name}_rag_export.zip"
    return _zip_response(buf, filename)
