"""
Regression models: XGBoost, RandomForest, GBM, Ridge, LightGBM, CatBoost regressors.
"""
from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

from .base import BaseMLModel


def _regression_metrics(
    y_true: pd.Series,
    y_pred: np.ndarray,
    feature_names: list[str],
    importances: np.ndarray | None,
) -> dict[str, Any]:
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    metrics: dict[str, Any] = {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "r2": round(r2, 4),
    }
    if importances is not None:
        metrics["feature_importance"] = {
            name: round(float(imp), 4)
            for name, imp in sorted(
                zip(feature_names, importances), key=lambda x: -x[1]
            )
        }
    return metrics


class XGBoostRegressorModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        hp = self.hyperparams
        self._estimator = XGBRegressor(
            n_estimators=int(hp.get("n_estimators", 100)),
            max_depth=int(hp.get("max_depth", 6)),
            learning_rate=float(hp.get("learning_rate", 0.1)),
            subsample=float(hp.get("subsample", 0.8)),
            random_state=42,
            verbosity=0,
        )
        self._estimator.fit(X_train, y_train)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self._estimator.predict(X)

    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series | None = None) -> dict[str, Any]:
        y_pred = self.predict(X_test)
        return _regression_metrics(y_test, y_pred, list(X_test.columns), self._estimator.feature_importances_)


class RandomForestRegressorModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        hp = self.hyperparams
        max_depth = hp.get("max_depth")
        self._estimator = RandomForestRegressor(
            n_estimators=int(hp.get("n_estimators", 100)),
            max_depth=int(max_depth) if max_depth else None,
            min_samples_split=int(hp.get("min_samples_split", 2)),
            random_state=42,
            n_jobs=-1,
        )
        self._estimator.fit(X_train, y_train)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self._estimator.predict(X)

    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series | None = None) -> dict[str, Any]:
        y_pred = self.predict(X_test)
        return _regression_metrics(y_test, y_pred, list(X_test.columns), self._estimator.feature_importances_)


class GBMRegressorModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        hp = self.hyperparams
        self._estimator = GradientBoostingRegressor(
            n_estimators=int(hp.get("n_estimators", 100)),
            max_depth=int(hp.get("max_depth", 3)),
            learning_rate=float(hp.get("learning_rate", 0.1)),
            subsample=float(hp.get("subsample", 1.0)),
            random_state=42,
        )
        self._estimator.fit(X_train, y_train)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self._estimator.predict(X)

    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series | None = None) -> dict[str, Any]:
        y_pred = self.predict(X_test)
        return _regression_metrics(y_test, y_pred, list(X_test.columns), self._estimator.feature_importances_)


class RidgeRegressorModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        hp = self.hyperparams
        self._estimator = Ridge(alpha=float(hp.get("alpha", 1.0)))
        self._estimator.fit(X_train, y_train)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self._estimator.predict(X)

    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series | None = None) -> dict[str, Any]:
        y_pred = self.predict(X_test)
        return _regression_metrics(y_test, y_pred, list(X_test.columns), None)


class LightGBMRegressorModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        import lightgbm as lgb
        hp = self.hyperparams
        self._estimator = lgb.LGBMRegressor(
            n_estimators=int(hp.get("n_estimators", 100)),
            max_depth=int(hp.get("max_depth", -1)),
            learning_rate=float(hp.get("learning_rate", 0.1)),
            num_leaves=int(hp.get("num_leaves", 31)),
            random_state=42,
            verbose=-1,
            n_jobs=-1,
        )
        self._estimator.fit(X_train, y_train)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self._estimator.predict(X)

    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series | None = None) -> dict[str, Any]:
        y_pred = self.predict(X_test)
        return _regression_metrics(y_test, y_pred, list(X_test.columns), self._estimator.feature_importances_)


class CatBoostRegressorModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        from catboost import CatBoostRegressor
        hp = self.hyperparams
        self._estimator = CatBoostRegressor(
            iterations=int(hp.get("iterations", 100)),
            depth=int(hp.get("depth", 6)),
            learning_rate=float(hp.get("learning_rate", 0.1)),
            random_seed=42,
            verbose=False,
        )
        self._estimator.fit(X_train, y_train)

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        return self._estimator.predict(X)

    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series | None = None) -> dict[str, Any]:
        y_pred = self.predict(X_test)
        importances = self._estimator.get_feature_importance()
        return _regression_metrics(y_test, y_pred, list(X_test.columns), importances)
