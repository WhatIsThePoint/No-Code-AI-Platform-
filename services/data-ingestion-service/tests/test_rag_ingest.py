"""
Unit tests for the RAG ingest Celery task and the rag_service helpers.

Mocks PyPDFLoader / TextLoader, the embedding model, and pgvector to keep
tests pure (no network, no DB, no GPU).
"""

import os
import tempfile
from unittest.mock import MagicMock, patch


# ── rag_service.embed_texts / insert_chunks ──────────────────────────────────


def test_embed_texts_uses_singleton_and_normalizes(monkeypatch):
    from app.services import rag_service

    fake_model = MagicMock()
    fake_model.encode.return_value = [
        type("Vec", (), {"tolist": lambda self: [0.1] * 384})(),
        type("Vec", (), {"tolist": lambda self: [0.2] * 384})(),
    ]

    monkeypatch.setattr(rag_service, "_EMBED_MODEL", None)
    with patch.object(rag_service, "get_embedding_model", return_value=fake_model):
        out = rag_service.embed_texts(["hello", "world"])

    assert len(out) == 2
    assert all(len(v) == 384 for v in out)
    fake_model.encode.assert_called_once()
    _, kwargs = fake_model.encode.call_args
    assert kwargs.get("normalize_embeddings") is True
    assert kwargs.get("show_progress_bar") is False


def test_insert_chunks_executes_batched_insert(monkeypatch):
    from app.services import rag_service

    monkeypatch.setenv("PGVECTOR_DSN", "postgresql://test")

    cursor = MagicMock()
    cursor.__enter__ = MagicMock(return_value=cursor)
    cursor.__exit__ = MagicMock(return_value=False)
    conn = MagicMock()
    conn.cursor.return_value = cursor

    with patch.object(rag_service, "get_pg_connection", return_value=conn), patch(
        "pgvector.psycopg2.register_vector"
    ):
        n = rag_service.insert_chunks(
            pipeline_id="p-1",
            document_id="d-1",
            source_name="iris.pdf",
            chunks=["chunk-a", "chunk-b"],
            embeddings=[[0.0] * 384, [1.0] * 384],
        )

    assert n == 2
    cursor.executemany.assert_called_once()
    sql, rows = cursor.executemany.call_args[0]
    assert "INSERT INTO document_chunks" in sql
    assert rows == [
        ("p-1", "d-1", "iris.pdf", 0, "chunk-a", [0.0] * 384),
        ("p-1", "d-1", "iris.pdf", 1, "chunk-b", [1.0] * 384),
    ]
    conn.commit.assert_called_once()
    conn.close.assert_called_once()


def test_insert_chunks_returns_zero_on_empty():
    from app.services import rag_service

    assert (
        rag_service.insert_chunks(
            pipeline_id="p", document_id="d", source_name="s", chunks=[], embeddings=[]
        )
        == 0
    )


def test_get_pg_connection_raises_without_dsn(monkeypatch):
    from app.services import rag_service

    monkeypatch.delenv("PGVECTOR_DSN", raising=False)
    try:
        rag_service.get_pg_connection()
    except RuntimeError as exc:
        assert "PGVECTOR_DSN" in str(exc)
    else:
        raise AssertionError("expected RuntimeError")


# ── Celery task: process_rag_document ────────────────────────────────────────


def _fake_loaded_doc(text):
    """Mimic a langchain Document (page_content + metadata dict)."""
    from langchain_core.documents import Document

    return Document(page_content=text, metadata={})


@patch("pymongo.MongoClient")
def test_process_rag_document_txt_happy_path(mock_mongo_cls, monkeypatch):
    from app.tasks import rag_ingest

    monkeypatch.setenv("MONGO_URL", "mongodb://test")
    monkeypatch.setenv("MONGO_DB", "test_db")

    # Fake mongo handles.
    mongo_db = MagicMock()
    documents = MagicMock()
    task_results = MagicMock()
    mongo_db.__getitem__.side_effect = lambda key: {
        "rag_documents": documents,
        "task_results": task_results,
    }[key]
    client = MagicMock()
    client.__getitem__.return_value = mongo_db
    mock_mongo_cls.return_value = client

    # Write a tiny txt fixture.
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".txt", delete=False, encoding="utf-8"
    ) as f:
        f.write("Some text about iris flowers. " * 80)
        path = f.name

    try:
        with patch(
            "langchain_community.document_loaders.TextLoader"
        ) as mock_loader_cls, patch(
            "app.services.rag_service.embed_texts"
        ) as mock_embed, patch(
            "app.services.rag_service.delete_chunks_for_document"
        ) as mock_delete, patch(
            "app.services.rag_service.insert_chunks"
        ) as mock_insert:
            loader = MagicMock()
            loader.load.return_value = [_fake_loaded_doc("Iris setosa. " * 100)]
            mock_loader_cls.return_value = loader

            # Whatever number of chunks the splitter produces, return a vector each.
            def fake_embed(texts):
                return [[0.0] * 384 for _ in texts]

            mock_embed.side_effect = fake_embed
            mock_insert.side_effect = lambda **kw: len(kw["chunks"])

            # Bind so self.request.id works inside the task.
            task = rag_ingest.process_rag_document
            task.push_request(id="celery-task-xyz")
            try:
                task.run(
                    document_id="doc-1",
                    pipeline_id="pipe-1",
                    file_path=path,
                    source_name="iris.txt",
                )
            finally:
                task.pop_request()

            mock_loader_cls.assert_called_once_with(path, encoding="utf-8")
            mock_delete.assert_called_once_with("doc-1")
            assert mock_insert.called
            kwargs = mock_insert.call_args.kwargs
            assert kwargs["pipeline_id"] == "pipe-1"
            assert kwargs["document_id"] == "doc-1"
            assert kwargs["source_name"] == "iris.txt"
            assert len(kwargs["chunks"]) > 0
            assert len(kwargs["embeddings"]) == len(kwargs["chunks"])

        # Mongo bookkeeping: status flipped to ready, task marked success.
        ready_call = next(
            c
            for c in documents.update_one.call_args_list
            if c.args[0] == {"document_id": "doc-1"}
            and c.args[1]["$set"].get("status") == "ready"
        )
        assert ready_call.args[1]["$set"]["chunk_count"] > 0

        success_call = next(
            c
            for c in task_results.update_one.call_args_list
            if c.args[1]["$set"].get("status") == "success"
        )
        assert success_call.args[1]["$set"]["progress_pct"] == 100
    finally:
        os.unlink(path)


@patch("pymongo.MongoClient")
def test_process_rag_document_unsupported_extension(mock_mongo_cls, monkeypatch):
    from app.tasks import rag_ingest

    monkeypatch.setenv("MONGO_URL", "mongodb://test")
    monkeypatch.setenv("MONGO_DB", "test_db")

    mongo_db = MagicMock()
    documents = MagicMock()
    task_results = MagicMock()
    mongo_db.__getitem__.side_effect = lambda key: {
        "rag_documents": documents,
        "task_results": task_results,
    }[key]
    client = MagicMock()
    client.__getitem__.return_value = mongo_db
    mock_mongo_cls.return_value = client

    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as f:
        f.write(b"binary garbage")
        path = f.name

    try:
        task = rag_ingest.process_rag_document
        task.push_request(id="celery-task-fail")
        try:
            try:
                task.run(
                    document_id="doc-bad",
                    pipeline_id="pipe-1",
                    file_path=path,
                    source_name="weird.docx",
                )
            except ValueError as exc:
                assert "Unsupported document extension" in str(exc)
            else:
                raise AssertionError("expected ValueError")
        finally:
            task.pop_request()

        # The failure must be persisted in mongo, not silently swallowed.
        failure_call = next(
            c
            for c in task_results.update_one.call_args_list
            if c.args[1]["$set"].get("status") == "failure"
        )
        assert "Unsupported document extension" in failure_call.args[1]["$set"][
            "error_message"
        ]
        documents.update_one.assert_called_with(
            {"document_id": "doc-bad"},
            {
                "$set": {
                    "status": "error",
                    "error_message": failure_call.args[1]["$set"]["error_message"],
                }
            },
        )
    finally:
        os.unlink(path)
