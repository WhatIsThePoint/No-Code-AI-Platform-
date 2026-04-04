"""
Supervised classification models: XGBoost, RandomForest, GBM, Logistic (GLM).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from xgboost import XGBClassifier

from .base import BaseMLModel


def _classification_metrics(
    y_true: pd.Series,
    y_pred: np.ndarray,
    y_prob: np.ndarray | None,
    feature_names: list[str],
    importances: np.ndarray | None,
) -> dict[str, Any]:
    n_classes = len(np.unique(y_true))
    avg = "binary" if n_classes == 2 else "macro"

    metrics: dict[str, Any] = {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision": round(
            float(precision_score(y_true, y_pred, average=avg, zero_division=0)), 4
        ),
        "recall": round(
            float(recall_score(y_true, y_pred, average=avg, zero_division=0)), 4
        ),
        "f1": round(float(f1_score(y_true, y_pred, average=avg, zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
    }

    if y_prob is not None:
        try:
            if n_classes == 2:
                metrics["roc_auc"] = round(
                    float(roc_auc_score(y_true, y_prob[:, 1])), 4
                )
            else:
                metrics["roc_auc"] = round(
                    float(
                        roc_auc_score(
                            y_true, y_prob, multi_class="ovr", average="macro"
                        )
                    ),
                    4,
                )
        except Exception:
            pass

    if importances is not None:
        metrics["feature_importance"] = {
            name: round(float(imp), 4)
            for name, imp in sorted(
                zip(feature_names, importances), key=lambda x: -x[1]
            )
        }

    return metrics


class XGBoostClassifierModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        hp = self.hyperparams
        self._estimator = XGBClassifier(
            n_estimators=int(hp.get("n_estimators", 100)),
            max_depth=int(hp.get("max_depth", 6)),
            learning_rate=float(hp.get("learning_rate", 0.1)),
            subsample=float(hp.get("subsample", 0.8)),
            use_label_encoder=False,
            eval_metric="logloss",
            random_state=42,
            verbosity=0,
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
        )


class RandomForestModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        hp = self.hyperparams
        max_depth = hp.get("max_depth")
        self._estimator = RandomForestClassifier(
            n_estimators=int(hp.get("n_estimators", 100)),
            max_depth=int(max_depth) if max_depth else None,
            min_samples_split=int(hp.get("min_samples_split", 2)),
            random_state=42,
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
        )


class GBMClassifierModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        hp = self.hyperparams
        self._estimator = GradientBoostingClassifier(
            n_estimators=int(hp.get("n_estimators", 100)),
            max_depth=int(hp.get("max_depth", 3)),
            learning_rate=float(hp.get("learning_rate", 0.1)),
            subsample=float(hp.get("subsample", 1.0)),
            random_state=42,
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
        )


class GLMClassifierModel(BaseMLModel):
    """Binary/multinomial logistic regression (GLM with logit link)."""

    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        hp = self.hyperparams
        self._estimator = LogisticRegression(
            C=float(hp.get("C", 1.0)),
            max_iter=int(hp.get("max_iter", 200)),
            solver=hp.get("solver", "lbfgs"),
            random_state=42,
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
            y_test, y_pred, y_prob, list(X_test.columns), None
        )
