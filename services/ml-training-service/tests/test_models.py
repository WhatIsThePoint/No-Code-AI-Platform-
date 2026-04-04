"""
Unit tests for ML model classes — no external services needed.
"""

import numpy as np
import pandas as pd
import pytest
from app.models.classification import (
    GBMClassifierModel,
    GLMClassifierModel,
    RandomForestModel,
    XGBoostClassifierModel,
)
from app.models.clustering import KMeansModel
from app.services.training_service import SUPPORTED_ALGORITHMS, get_model

# ── Fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture
def binary_data():
    rng = np.random.default_rng(42)
    X = pd.DataFrame({"f1": rng.normal(0, 1, 100), "f2": rng.normal(1, 1, 100)})
    y = pd.Series((X["f1"] + X["f2"] > 1).astype(int))
    return X, y


@pytest.fixture
def cluster_data():
    rng = np.random.default_rng(42)
    return pd.DataFrame(
        {
            "x": rng.normal(0, 1, 60).tolist() + rng.normal(5, 1, 60).tolist(),
            "y": rng.normal(0, 1, 60).tolist() + rng.normal(5, 1, 60).tolist(),
        }
    )


# ── Classification model tests ────────────────────────────────────────────────


@pytest.mark.parametrize(
    "ModelCls",
    [
        XGBoostClassifierModel,
        RandomForestModel,
        GBMClassifierModel,
        GLMClassifierModel,
    ],
)
def test_classification_train_evaluate(ModelCls, binary_data):
    X, y = binary_data
    model = ModelCls({"n_estimators": 10, "max_depth": 3})
    model.train(X, y)
    assert model.estimator is not None
    metrics = model.evaluate(X, y)
    assert "accuracy" in metrics
    assert "f1" in metrics
    assert "confusion_matrix" in metrics
    assert 0.0 <= metrics["accuracy"] <= 1.0


def test_xgboost_feature_importance(binary_data):
    X, y = binary_data
    model = XGBoostClassifierModel({"n_estimators": 10})
    model.train(X, y)
    metrics = model.evaluate(X, y)
    assert "feature_importance" in metrics
    assert "f1" in metrics["feature_importance"]


# ── Clustering tests ──────────────────────────────────────────────────────────


def test_kmeans_train_evaluate(cluster_data):
    model = KMeansModel({"n_clusters": 2})
    model.train(cluster_data)
    assert model.estimator is not None
    metrics = model.evaluate(cluster_data)
    assert metrics["n_clusters"] == 2
    assert "inertia" in metrics
    assert "silhouette_score" in metrics


def test_kmeans_elbow(cluster_data):
    model = KMeansModel({"n_clusters": 2, "compute_elbow": True})
    model.train(cluster_data)
    metrics = model.evaluate(cluster_data)
    assert "elbow_data" in metrics
    assert len(metrics["elbow_data"]) > 0


# ── Training service tests ─────────────────────────────────────────────────────


def test_get_model_known_algorithm():
    model = get_model("xgboost", {"n_estimators": 10})
    assert isinstance(model, XGBoostClassifierModel)


def test_get_model_unknown_raises():
    with pytest.raises(ValueError, match="Unknown algorithm"):
        get_model("neural_net", {})


def test_supported_algorithms_list():
    expected = {
        "xgboost",
        "random_forest",
        "gbm",
        "glm",
        "kmeans",
        "prophet",
        "lightgbm",
        "catboost",
    }
    assert expected == set(SUPPORTED_ALGORITHMS)
