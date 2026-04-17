"""
Additional boosting algorithms: LightGBM and CatBoost (classification).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from .base import BaseMLModel
from .classification import _classification_metrics


class LightGBMModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        import lightgbm as lgb

        hp = self.hyperparams
        self._estimator = lgb.LGBMClassifier(
            n_estimators=int(hp.get("n_estimators", 100)),
            max_depth=int(hp.get("max_depth", -1)),  # -1 = no limit
            learning_rate=float(hp.get("learning_rate", 0.1)),
            num_leaves=int(hp.get("num_leaves", 31)),
            random_state=42,
            verbose=-1,
            n_jobs=-1,
        )
        self._estimator.fit(X_train, y_train)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self._estimator.predict(X)

    def evaluate(
        self, X_test: pd.DataFrame, y_test: pd.Series | None = None
    ) -> dict[str, Any]:
        y_pred = self.predict(X_test)
        y_prob = self._estimator.predict_proba(X_test)
        return _classification_metrics(
            y_test,
            y_pred,
            y_prob,
            list(X_test.columns),
            self._estimator.feature_importances_,
            estimator=self._estimator,
            X_test=X_test,
        )


class CatBoostModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        from catboost import CatBoostClassifier

        hp = self.hyperparams
        self._estimator = CatBoostClassifier(
            iterations=int(hp.get("iterations", 100)),
            depth=int(hp.get("depth", 6)),
            learning_rate=float(hp.get("learning_rate", 0.1)),
            random_seed=42,
            verbose=False,
        )
        self._estimator.fit(X_train, y_train)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self._estimator.predict(X)

    def evaluate(
        self, X_test: pd.DataFrame, y_test: pd.Series | None = None
    ) -> dict[str, Any]:
        y_pred = self.predict(X_test)
        y_prob = self._estimator.predict_proba(X_test)
        importances = self._estimator.get_feature_importance()
        return _classification_metrics(
            y_test,
            y_pred,
            y_prob,
            list(X_test.columns),
            importances,
            estimator=self._estimator,
            X_test=X_test,
        )
