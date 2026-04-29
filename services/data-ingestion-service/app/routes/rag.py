"""
RAG document ingestion endpoints (Sprint 5 Module 2).

POST /pipelines/<pipeline_id>/documents
    multipart/form-data file → enqueue process_rag_document Celery task.

GET  /pipelines/<pipeline_id>/documents
    list documents indexed under a pipeline (with chunk counts + status).
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request

from ..extensions import mongo
from ..services.storage_service import save_uploaded_file
from ..tasks.rag_ingest import process_rag_document

rag_bp = Blueprint("rag", __name__)

ALLOWED_EXTENSIONS = {"pdf", "txt", "md"}
MAX_RAG_FILE_BYTES = 50 * 1024 * 1024  # 50 MB hard cap regardless of tier


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@rag_bp.post("/pipelines/<pipeline_id>/documents")
def upload_rag_document(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    if "file" not in request.files:
        return jsonify({"error": "no_file_provided"}), 400

    file = request.files["file"]
    if not file.filename or not _allowed(file.filename):
        return (
            jsonify(
                {
                    "error": "unsupported_file_type",
                    "allowed": sorted(ALLOWED_EXTENSIONS),
                }
            ),
            400,
        )

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > MAX_RAG_FILE_BYTES:
        return (
            jsonify(
                {
                    "error": "file_too_large",
                    "max_mb": MAX_RAG_FILE_BYTES // (1024 * 1024),
                }
            ),
            413,
        )

    document_id = str(uuid.uuid4())
    ext = file.filename.rsplit(".", 1)[1].lower()
    safe_name = f"{document_id}.{ext}"
    file_path = save_uploaded_file(
        file, document_id, safe_name, current_app.config["UPLOAD_FOLDER"]
    )

    now = datetime.now(timezone.utc)
    documents = mongo.get_collection("rag_documents")
    documents.insert_one(
        {
            "document_id": document_id,
            "pipeline_id": pipeline_id,
            "user_id": user_id,
            "source_name": file.filename,
            "file_path": file_path,
            "size_bytes": size,
            "status": "queued",
            "chunk_count": 0,
            "created_at": now,
            "updated_at": now,
        }
    )

    task = process_rag_document.apply_async(
        args=[document_id, pipeline_id, file_path, file.filename],
        queue="rag",
    )

    mongo.get_collection("task_results").insert_one(
        {
            "task_id": task.id,
            "document_id": document_id,
            "pipeline_id": pipeline_id,
            "task_type": "rag_ingest",
            "status": "pending",
            "progress_pct": 0,
            "created_at": now,
        }
    )

    return (
        jsonify(
            {
                "document_id": document_id,
                "task_id": task.id,
                "status": "queued",
            }
        ),
        202,
    )


@rag_bp.get("/pipelines/<pipeline_id>/documents")
def list_rag_documents(pipeline_id: str):
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    cursor = (
        mongo.get_collection("rag_documents")
        .find({"pipeline_id": pipeline_id})
        .sort("created_at", -1)
    )
    items = []
    for d in cursor:
        items.append(
            {
                "document_id": d["document_id"],
                "source_name": d.get("source_name"),
                "status": d.get("status"),
                "chunk_count": d.get("chunk_count", 0),
                "size_bytes": d.get("size_bytes", 0),
                "created_at": d["created_at"].isoformat()
                if d.get("created_at")
                else None,
                "error_message": d.get("error_message"),
            }
        )
    return jsonify({"items": items, "total": len(items)}), 200


@rag_bp.get("/pipelines/<pipeline_id>/documents/<document_id>/chunks")
def list_document_chunks(pipeline_id: str, document_id: str):
    """Stream a document's indexed chunks back to the UI for transparency.

    Used by the "preview indexed content" affordance on DocumentNode so the
    user can see exactly what the LLM is grounded on. Lightweight pagination
    via `?page=` and `?page_size=` to avoid blowing up the wire on big PDFs.
    """
    user_id = request.headers.get("X-User-Id")
    if not user_id:
        return jsonify({"error": "missing_user_id"}), 401

    # Sanity-check that the document is actually scoped to this pipeline so
    # one user can't peek at another pipeline's chunks by guessing IDs.
    doc = mongo.get_collection("rag_documents").find_one(
        {"document_id": document_id, "pipeline_id": pipeline_id}
    )
    if not doc:
        return jsonify({"error": "not_found"}), 404

    page = max(1, int(request.args.get("page", 1)))
    page_size = max(1, min(int(request.args.get("page_size", 25)), 200))
    offset = (page - 1) * page_size

    from ..services.rag_service import get_pg_connection

    items: list[dict] = []
    total = 0
    try:
        conn = get_pg_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COUNT(*) FROM document_chunks WHERE document_id = %s",
                    (document_id,),
                )
                total = int(cur.fetchone()[0])
                cur.execute(
                    """
                    SELECT chunk_index, text_content, length(text_content) AS chars
                    FROM document_chunks
                    WHERE document_id = %s
                    ORDER BY chunk_index ASC
                    LIMIT %s OFFSET %s
                    """,
                    (document_id, page_size, offset),
                )
                for chunk_index, text_content, chars in cur.fetchall():
                    items.append(
                        {
                            "chunk_index": int(chunk_index),
                            "text": text_content,
                            "chars": int(chars),
                        }
                    )
        finally:
            conn.close()
    except Exception as exc:
        current_app.logger.warning("chunk preview failed: %s", exc)
        return (
            jsonify({"error": "pgvector_unavailable", "detail": str(exc)[:200]}),
            503,
        )

    return (
        jsonify(
            {
                "document_id": document_id,
                "source_name": doc.get("source_name"),
                "page": page,
                "page_size": page_size,
                "total": total,
                "items": items,
            }
        ),
        200,
    )
