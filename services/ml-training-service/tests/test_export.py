"""Sprint 7 Module 1 — model export endpoints."""

from __future__ import annotations

import io
import json
import os
import tempfile
import zipfile
from unittest.mock import MagicMock, patch

import joblib
import pytest
from sklearn.linear_model import LogisticRegression

USER_HEADERS = {
    "X-User-Id": "owner-1",
    "X-User-Role": "data_scientist",
    "X-Company-Id": "",
}
OTHER_HEADERS = {
    "X-User-Id": "stranger-9",
    "X-User-Role": "data_scientist",
    "X-Company-Id": "",
}


@pytest.fixture
def trained_artifact_path():
    """Drop a tiny fitted estimator on disk so the export packager has something
    real to read. We bind it to /tmp via tempfile and clean up after."""
    tmpdir = tempfile.mkdtemp(prefix="export-test-")
    pid = "pipe-1"
    pipe_dir = os.path.join(tmpdir, pid)
    os.makedirs(pipe_dir, exist_ok=True)
    artifact = os.path.join(pipe_dir, "v1.joblib")

    est = LogisticRegression()
    est.fit([[0, 0], [1, 1], [2, 2], [0, 1]], [0, 1, 1, 0])
    joblib.dump(est, artifact)

    yield artifact

    import shutil

    shutil.rmtree(tmpdir, ignore_errors=True)


# ─────────────────────────────────────────────────────────────────────────────
# Tabular
# ─────────────────────────────────────────────────────────────────────────────


def test_tabular_export_returns_valid_zip(client, trained_artifact_path):
    pipeline_doc = {
        "pipeline_id": "pipe-1",
        "user_id": "owner-1",
        "owner_type": "personal",
        "company_id": None,
        "type": "ml",
        "name": "Churn",
    }
    version_doc = {
        "version_id": "v1",
        "pipeline_id": "pipe-1",
        "user_id": "owner-1",
        "algorithm": "xgboost",
        "task_type": "classification",
        "hyperparams": {"target_column": "y"},
        "metrics": {"accuracy": 0.91},
        "feature_columns": ["a", "b"],
        "artifact_path": trained_artifact_path,
        "created_at": "2026-04-18T00:00:00+00:00",
    }

    with patch("app.routes.export.mongo") as m_mongo, patch(
        "app.routes.export.list_model_versions", return_value=[version_doc]
    ):
        m_mongo.db = MagicMock()
        m_mongo.db.__getitem__.return_value.find_one.return_value = pipeline_doc

        resp = client.get("/pipelines/pipe-1/export/tabular", headers=USER_HEADERS)

    assert resp.status_code == 200
    assert resp.mimetype == "application/zip"
    assert "Churn" in resp.headers["Content-Disposition"]

    zf = zipfile.ZipFile(io.BytesIO(resp.data))
    names = set(zf.namelist())
    assert "model.joblib" in names
    assert "metadata.json" in names
    assert "README.md" in names
    assert "load_example.py" in names

    meta = json.loads(zf.read("metadata.json"))
    assert meta["algorithm"] == "xgboost"
    assert meta["feature_columns"] == ["a", "b"]
    assert meta["target_column"] == "y"


def test_tabular_export_404_without_trained_model(client):
    pipeline_doc = {
        "pipeline_id": "pipe-empty",
        "user_id": "owner-1",
        "owner_type": "personal",
        "company_id": None,
        "type": "ml",
        "name": "Empty",
    }
    with patch("app.routes.export.mongo") as m_mongo, patch(
        "app.routes.export.list_model_versions", return_value=[]
    ):
        m_mongo.db = MagicMock()
        m_mongo.db.__getitem__.return_value.find_one.return_value = pipeline_doc

        resp = client.get("/pipelines/pipe-empty/export/tabular", headers=USER_HEADERS)

    assert resp.status_code == 404
    assert resp.get_json()["error"] == "no_trained_model"


def test_tabular_export_rejects_rag_pipeline(client):
    pipeline_doc = {
        "pipeline_id": "pipe-rag",
        "user_id": "owner-1",
        "owner_type": "personal",
        "company_id": None,
        "type": "rag",
        "name": "Docs",
    }
    with patch("app.routes.export.mongo") as m_mongo:
        m_mongo.db = MagicMock()
        m_mongo.db.__getitem__.return_value.find_one.return_value = pipeline_doc

        resp = client.get("/pipelines/pipe-rag/export/tabular", headers=USER_HEADERS)

    assert resp.status_code == 400
    assert resp.get_json()["error"] == "wrong_pipeline_type"


def test_tabular_export_403_when_not_owner(client):
    pipeline_doc = {
        "pipeline_id": "pipe-priv",
        "user_id": "owner-1",
        "owner_type": "personal",
        "company_id": None,
        "type": "ml",
        "name": "Private",
    }
    with patch("app.routes.export.mongo") as m_mongo:
        m_mongo.db = MagicMock()
        m_mongo.db.__getitem__.return_value.find_one.return_value = pipeline_doc

        resp = client.get("/pipelines/pipe-priv/export/tabular", headers=OTHER_HEADERS)

    assert resp.status_code == 403


def test_tabular_export_requires_user_header(client):
    resp = client.get("/pipelines/pipe-1/export/tabular")
    assert resp.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# GenAI / RAG
# ─────────────────────────────────────────────────────────────────────────────


def test_genai_export_bundles_modelfile_and_docs(client):
    pipeline_doc = {
        "pipeline_id": "rag-1",
        "user_id": "owner-1",
        "owner_type": "personal",
        "company_id": None,
        "type": "rag",
        "name": "Support Bot",
    }
    docs = [
        {
            "document_id": "d1",
            "filename": "faq.pdf",
            "chunk_count": 7,
            "status": "ready",
            "uploaded_at": "2026-04-18T00:00:00+00:00",
        },
        {
            "document_id": "d2",
            "filename": "policies.md",
            "chunk_count": 3,
            "status": "ready",
            "uploaded_at": "2026-04-18T00:00:00+00:00",
        },
    ]

    def mongo_collection(name):
        col = MagicMock()
        if name == "pipelines":
            col.find_one.return_value = pipeline_doc
        elif name == "rag_documents":
            cursor = MagicMock()
            cursor.sort.return_value = docs
            col.find.return_value = cursor
        return col

    with patch("app.routes.export.mongo") as m_mongo:
        m_mongo.db = MagicMock()
        m_mongo.db.__getitem__.side_effect = mongo_collection

        resp = client.get("/pipelines/rag-1/export/genai", headers=USER_HEADERS)

    assert resp.status_code == 200
    assert resp.mimetype == "application/zip"

    zf = zipfile.ZipFile(io.BytesIO(resp.data))
    names = set(zf.namelist())
    assert "Modelfile" in names
    assert "documents.json" in names
    assert "README.md" in names
    assert "system_prompt.txt" in names

    modelfile = zf.read("Modelfile").decode()
    assert "FROM " in modelfile
    assert "SYSTEM" in modelfile

    manifest = json.loads(zf.read("documents.json"))
    assert manifest["pipeline_id"] == "rag-1"
    assert len(manifest["documents"]) == 2
    assert manifest["documents"][0]["filename"] == "faq.pdf"


def test_genai_export_rejects_ml_pipeline(client):
    pipeline_doc = {
        "pipeline_id": "pipe-ml",
        "user_id": "owner-1",
        "owner_type": "personal",
        "company_id": None,
        "type": "ml",
        "name": "Tabular",
    }
    with patch("app.routes.export.mongo") as m_mongo:
        m_mongo.db = MagicMock()
        m_mongo.db.__getitem__.return_value.find_one.return_value = pipeline_doc

        resp = client.get("/pipelines/pipe-ml/export/genai", headers=USER_HEADERS)

    assert resp.status_code == 400
    assert resp.get_json()["error"] == "wrong_pipeline_type"
