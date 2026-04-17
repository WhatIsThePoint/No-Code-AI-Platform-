"""
Post-training explainability helpers.

`compute_shap_global` returns a dict of {feature: mean(|shap_value|)}
for any tree-based estimator SHAP's TreeExplainer understands. Non-tree
models (LogisticRegression, Ridge, KMeans, Prophet) return None so callers
can skip the chart gracefully.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

SHAP_SAMPLE_SIZE = 500
TOP_FEATURES = 20


def compute_shap_global(
    estimator: Any, X_sample: pd.DataFrame
) -> dict[str, float] | None:
    try:
        import shap  # heavy import, lazy
    except ImportError:
        return None

    if X_sample is None or len(X_sample) == 0:
        return None

    if len(X_sample) > SHAP_SAMPLE_SIZE:
        X_sample = X_sample.sample(n=SHAP_SAMPLE_SIZE, random_state=42)

    try:
        explainer = shap.TreeExplainer(estimator)
        shap_values = explainer.shap_values(X_sample)
    except Exception:
        return None

    # For multiclass, shap_values is a list of arrays — average across classes.
    if isinstance(shap_values, list):
        stacked = np.stack([np.abs(v) for v in shap_values], axis=0)
        mean_abs = stacked.mean(axis=0).mean(axis=0)
    else:
        arr = np.asarray(shap_values)
        if arr.ndim == 3:  # (samples, features, classes)
            arr = np.abs(arr).mean(axis=2)
        else:
            arr = np.abs(arr)
        mean_abs = arr.mean(axis=0)

    mean_abs = np.asarray(mean_abs).flatten()
    if mean_abs.shape[0] != len(X_sample.columns):
        return None

    pairs = sorted(
        zip(X_sample.columns, mean_abs), key=lambda kv: -float(kv[1])
    )[:TOP_FEATURES]
    return {str(name): round(float(val), 6) for name, val in pairs}


def residuals_sample(
    y_true: pd.Series, y_pred: np.ndarray, max_points: int = 500
) -> list[dict[str, float]]:
    n = min(len(y_true), max_points)
    if n == 0:
        return []
    rng = np.random.default_rng(42)
    idx = rng.choice(len(y_true), size=n, replace=False)
    yt = np.asarray(y_true, dtype=float)[idx]
    yp = np.asarray(y_pred, dtype=float)[idx]
    return [
        {"y_true": round(float(t), 4), "y_pred": round(float(p), 4)}
        for t, p in zip(yt, yp)
    ]
