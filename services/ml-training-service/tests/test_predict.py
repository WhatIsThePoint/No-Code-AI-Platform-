"""
Unit tests for batch prediction and model comparison endpoints.
Both endpoints mock MongoDB to avoid requiring a real database.
"""

import io
from unittest.mock import MagicMock, patch

USER_HEADERS = {
    "X-User-Id": "user-123",
    "X-User-Role": "data_scientist",
    "X-User-Tier": "solo",
}
FREE_HEADERS = {
    "X-User-Id": "user-123",
    "X-User-Role": "data_scientist",
    "X-User-Tier": "free",
}


# ── /models/<id>/predict ──────────────────────────────────────────────────────


def test_predict_requires_auth(client):
    resp = client.post("/models/some-id/predict")
    assert resp.status_code == 401


def test_predict_tier_limit(client):
    """Free tier users cannot use batch predictions."""
    resp = client.post("/models/some-id/predict", headers=FREE_HEADERS)
    assert resp.status_code == 402
    assert resp.get_json()["error"] == "feature_not_available"


def test_predict_model_not_found(client):
    resp = client.post("/models/nonexistent/predict", headers=USER_HEADERS)
    assert resp.status_code == 404


@patch("app.routes.predict.get_model_version")
@patch("app.routes.predict.joblib")
def test_predict_csv_success(mock_joblib, mock_get_version, client):
    import numpy as np

    mock_get_version.return_value = {
        "version_id": "v-1",
        "pipeline_id": "p-1",
        "user_id": "user-123",
        "algorithm": "xgboost",
        "task_type": "classification",
        "hyperparams": {"target_column": "label"},
        "artifact_path": "/models/test.joblib",
    }
    mock_estimator = MagicMock()
    mock_estimator.predict.return_value = np.array([0, 1, 0])
    mock_joblib.load.return_value = mock_estimator

    csv_content = b"feature1,feature2\n1.0,2.0\n3.0,4.0\n5.0,6.0\n"
    data = {"file": (io.BytesIO(csv_content), "test.csv", "text/csv")}
    resp = client.post(
        "/models/v-1/predict",
        data=data,
        content_type="multipart/form-data",
        headers=USER_HEADERS,
    )
    assert resp.status_code == 200
    assert resp.content_type == "text/csv"
    body = resp.data.decode()
    assert "predicted_class" in body


@patch("app.routes.predict.get_model_version")
def test_predict_forbidden(mock_get_version, client):
    mock_get_version.return_value = {
        "version_id": "v-other",
        "pipeline_id": "p-1",
        "user_id": "other-user",
        "algorithm": "xgboost",
        "task_type": "classification",
        "hyperparams": {},
        "artifact_path": "/models/test.joblib",
    }
    csv_content = b"a,b\n1,2\n"
    data = {"file": (io.BytesIO(csv_content), "test.csv", "text/csv")}
    resp = client.post(
        "/models/v-other/predict",
        data=data,
        content_type="multipart/form-data",
        headers=USER_HEADERS,
    )
    assert resp.status_code == 403


def test_predict_no_file(client):
    resp = client.post("/models/v-1/predict", headers=USER_HEADERS)
    assert resp.status_code == 404  # model not found before file check
