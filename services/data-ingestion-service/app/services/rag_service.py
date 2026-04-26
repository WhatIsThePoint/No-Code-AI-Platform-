"""
RAG service: local embedding model + pgvector helpers.

Sprint 5 Module 2 — keeps the platform 100% local.
- Embeddings: sentence-transformers/all-MiniLM-L6-v2 (384-dim, runs on CPU).
- Vector store: PostgreSQL pgvector (cosine similarity).

The SentenceTransformer is loaded lazily and cached at module level so each
Celery worker process pays the 80 MB download / 200 MB RAM cost exactly once.
"""

from __future__ import annotations

import os
import threading
from typing import Iterable

_EMBED_MODEL = None
_EMBED_LOCK = threading.Lock()

EMBED_DIM = 384  # all-MiniLM-L6-v2


def get_embedding_model():
    """Lazy-load the sentence-transformer once per process."""
    global _EMBED_MODEL
    if _EMBED_MODEL is None:
        with _EMBED_LOCK:
            if _EMBED_MODEL is None:
                from sentence_transformers import SentenceTransformer

                model_name = os.environ.get(
                    "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
                )
                _EMBED_MODEL = SentenceTransformer(model_name)
    return _EMBED_MODEL


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of strings. Returns a list of 384-float lists."""
    model = get_embedding_model()
    vectors = model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
    return [v.tolist() for v in vectors]


def get_pg_connection():
    """Open a fresh psycopg2 connection. Caller is responsible for closing."""
    import psycopg2

    dsn = os.environ.get("PGVECTOR_DSN")
    if not dsn:
        raise RuntimeError("PGVECTOR_DSN environment variable not set")
    return psycopg2.connect(dsn)


def insert_chunks(
    pipeline_id: str,
    document_id: str,
    source_name: str,
    chunks: Iterable[str],
    embeddings: Iterable[list[float]],
) -> int:
    """Batch-insert chunks + embeddings into document_chunks. Returns row count."""
    from pgvector.psycopg2 import register_vector

    rows = list(zip(chunks, embeddings, strict=True))
    if not rows:
        return 0

    conn = get_pg_connection()
    try:
        register_vector(conn)
        with conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO document_chunks
                    (pipeline_id, document_id, source_name, chunk_index, text_content, embedding)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                [
                    (pipeline_id, document_id, source_name, i, text, vec)
                    for i, (text, vec) in enumerate(rows)
                ],
            )
        conn.commit()
        return len(rows)
    finally:
        conn.close()


def delete_chunks_for_document(document_id: str) -> int:
    """Remove all chunks for a given document (used when re-ingesting)."""
    conn = get_pg_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM document_chunks WHERE document_id = %s",
                (document_id,),
            )
            deleted = cur.rowcount
        conn.commit()
        return deleted
    finally:
        conn.close()
