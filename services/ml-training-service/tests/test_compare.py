"""
Unit tests for the model comparison endpoint.
"""

from unittest.mock import patch

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


def _make_version(version_id, algorithm, task_type, metrics):
    return {
        "version_id": version_id,
        "pipeline_id": "p-1",
        "user_id": "user-123",
        "algorithm": algorithm,
        "task_type": task_type,
        "hyperparams": {},
        "metrics": metrics,
        "training_duration_s": 1.5,
        "created_at": "2026-04-04T00:00:00",
    }


# ── Access control ─────────────────────────────────────────────────────────────


def test_compare_requires_auth(client):
    resp = client.post("/models/compare")
    assert resp.status_code == 401


def test_compare_tier_limit(client):
    resp = client.post(
        "/models/compare", json={"version_ids": ["a", "b"]}, headers=FREE_HEADERS
    )
    assert resp.status_code == 402
    assert resp.get_json()["error"] == "feature_not_available"


# ── Input validation ──────────────────────────────────────────────────────────


def test_compare_requires_two_versions(client):
    resp = client.post(
        "/models/compare", json={"version_ids": ["only-one"]}, headers=USER_HEADERS
    )
    assert resp.status_code == 400


def test_compare_not_found(client):
    resp = client.post(
        "/models/compare",
        json={"version_ids": ["nonexistent-1", "nonexistent-2"]},
        headers=USER_HEADERS,
    )
    assert resp.status_code == 404


# ── Success cases ─────────────────────────────────────────────────────────────


@patch("app.routes.compare.get_model_version")
def test_compare_classification_success(mock_get_version, client):
    mock_get_version.side_effect = [
        _make_version(
            "v1",
            "xgboost",
            "classification",
            {"accuracy": 0.95, "f1": 0.94, "precision": 0.93, "recall": 0.92},
        ),
        _make_version(
            "v2",
            "random_forest",
            "classification",
            {"accuracy": 0.88, "f1": 0.87, "precision": 0.86, "recall": 0.85},
        ),
    ]
    resp = client.post(
        "/models/compare",
        json={"version_ids": ["v1", "v2"]},
        headers=USER_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["task_type"] == "classification"
    assert len(body["versions"]) == 2
    assert "best_by_metric" in body
    # XGBoost has higher accuracy → it should be best
    assert body["best_by_metric"]["accuracy"] == "v1"


@patch("app.routes.compare.get_model_version")
def test_compare_regression_best_by_rmse(mock_get_version, client):
    mock_get_version.side_effect = [
        _make_version(
            "r1", "xgboost_reg", "regression", {"mae": 0.3, "rmse": 0.5, "r2": 0.88}
        ),
        _make_version(
            "r2", "ridge", "regression", {"mae": 0.4, "rmse": 0.7, "r2": 0.82}
        ),
    ]
    resp = client.post(
        "/models/compare",
        json={"version_ids": ["r1", "r2"]},
        headers=USER_HEADERS,
    )
    assert resp.status_code == 200
    body = resp.get_json()
    # Lower RMSE is better → r1 should win
    assert body["best_by_metric"]["rmse"] == "r1"
    # Higher R2 is better → r1 should win
    assert body["best_by_metric"]["r2"] == "r1"


@patch("app.routes.compare.get_model_version")
def test_compare_mixed_task_types_error(mock_get_version, client):
    mock_get_version.side_effect = [
        _make_version("v1", "xgboost", "classification", {"accuracy": 0.9, "f1": 0.88}),
        _make_version(
            "v2", "xgboost_reg", "regression", {"mae": 0.3, "rmse": 0.5, "r2": 0.88}
        ),
    ]
    resp = client.post(
        "/models/compare",
        json={"version_ids": ["v1", "v2"]},
        headers=USER_HEADERS,
    )
    assert resp.status_code == 400
    assert resp.get_json()["error"] == "mixed_task_types"


@patch("app.routes.compare.get_model_version")
def test_compare_forbidden_version(mock_get_version, client):
    mock_get_version.side_effect = [
        _make_version("v1", "xgboost", "classification", {}),
        {
            "version_id": "v2",
            "pipeline_id": "p-2",
            "user_id": "other-user",  # different owner
            "algorithm": "random_forest",
            "task_type": "classification",
            "hyperparams": {},
            "metrics": {},
            "training_duration_s": 1.0,
            "created_at": "2026-04-04T00:00:00",
        },
    ]
    resp = client.post(
        "/models/compare",
        json={"version_ids": ["v1", "v2"]},
        headers=USER_HEADERS,
    )
    assert resp.status_code == 403
