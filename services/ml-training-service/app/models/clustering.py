"""
Unsupervised clustering: K-Means with silhouette score and elbow data.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

from .base import BaseMLModel


class KMeansModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        hp = self.hyperparams
        n_clusters = int(hp.get("n_clusters", 3))
        self._estimator = KMeans(
            n_clusters=n_clusters,
            random_state=42,
            n_init="auto",
        )
        self._estimator.fit(X_train)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self._estimator.predict(X)

    def evaluate(
        self, X_test: pd.DataFrame, y_test: pd.Series | None = None
    ) -> dict[str, Any]:
        labels = self._estimator.labels_
        X_arr = X_test.values if hasattr(X_test, "values") else X_test

        metrics: dict[str, Any] = {
            "n_clusters": int(self._estimator.n_clusters),
            "inertia": round(float(self._estimator.inertia_), 4),
        }

        if len(np.unique(labels)) > 1:
            metrics["silhouette_score"] = round(
                float(
                    silhouette_score(X_arr, labels, sample_size=min(5000, len(X_arr)))
                ),
                4,
            )

        # Elbow data: refit for k=2..10 if requested
        if self.hyperparams.get("compute_elbow", False):
            elbow = []
            max_k = min(10, len(X_arr) - 1)
            for k in range(2, max_k + 1):
                km = KMeans(n_clusters=k, random_state=42, n_init="auto")
                km.fit(X_arr)
                elbow.append({"k": k, "inertia": round(float(km.inertia_), 4)})
            metrics["elbow_data"] = elbow

        return metrics
