"""
Celery task: ingest a PDF/TXT document into the local pgvector store.

Pipeline:
  1. Load document (PyPDFLoader for .pdf, TextLoader for .txt).
  2. Chunk with RecursiveCharacterTextSplitter (chunk_size=500, overlap=50).
  3. Embed chunks locally via sentence-transformers/all-MiniLM-L6-v2.
  4. Batch-insert into document_chunks (pgvector).
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

from .celery_app import celery


@celery.task(name="app.tasks.rag_ingest.process_rag_document", bind=True)
def process_rag_document(
    self,
    document_id: str,
    pipeline_id: str,
    file_path: str,
    source_name: str,
):
    from pymongo import MongoClient

    from ..services.rag_service import (
        delete_chunks_for_document,
        embed_texts,
        insert_chunks,
    )

    mongo_url = os.environ["MONGO_URL"]
    mongo_db = os.environ.get("MONGO_DB", "nocode_ingestion")
    client = MongoClient(mongo_url)
    db = client[mongo_db]
    documents = db["rag_documents"]
    task_results = db["task_results"]

    task_results.update_one(
        {"task_id": self.request.id},
        {
            "$set": {
                "status": "running",
                "task_type": "rag_ingest",
                "started_at": datetime.now(timezone.utc),
                "progress_pct": 0,
            }
        },
        upsert=True,
    )

    try:
        # 1. Load
        ext = os.path.splitext(file_path)[1].lower()
        if ext == ".pdf":
            from langchain_community.document_loaders import PyPDFLoader

            docs = PyPDFLoader(file_path).load()
        elif ext in (".txt", ".md"):
            from langchain_community.document_loaders import TextLoader

            docs = TextLoader(file_path, encoding="utf-8").load()
        else:
            raise ValueError(f"Unsupported document extension: {ext}")

        task_results.update_one(
            {"task_id": self.request.id}, {"$set": {"progress_pct": 20}}
        )

        # 2. Chunk
        from langchain_text_splitters import RecursiveCharacterTextSplitter

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=500, chunk_overlap=50, length_function=len
        )
        split_docs = splitter.split_documents(docs)
        chunk_texts = [d.page_content for d in split_docs if d.page_content.strip()]

        if not chunk_texts:
            raise ValueError("No extractable text in document")

        task_results.update_one(
            {"task_id": self.request.id}, {"$set": {"progress_pct": 40}}
        )

        # 3. Embed (batched internally by sentence-transformers)
        vectors = embed_texts(chunk_texts)

        task_results.update_one(
            {"task_id": self.request.id}, {"$set": {"progress_pct": 75}}
        )

        # 4. Replace any prior chunks for this document, then insert.
        delete_chunks_for_document(document_id)
        inserted = insert_chunks(
            pipeline_id=pipeline_id,
            document_id=document_id,
            source_name=source_name,
            chunks=chunk_texts,
            embeddings=vectors,
        )

        documents.update_one(
            {"document_id": document_id},
            {
                "$set": {
                    "status": "ready",
                    "chunk_count": inserted,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        task_results.update_one(
            {"task_id": self.request.id},
            {
                "$set": {
                    "status": "success",
                    "progress_pct": 100,
                    "chunk_count": inserted,
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )

    except Exception as exc:
        documents.update_one(
            {"document_id": document_id},
            {"$set": {"status": "error", "error_message": str(exc)[:500]}},
        )
        task_results.update_one(
            {"task_id": self.request.id},
            {
                "$set": {
                    "status": "failure",
                    "error_message": str(exc)[:500],
                    "completed_at": datetime.now(timezone.utc),
                }
            },
        )
        raise

    finally:
        client.close()
