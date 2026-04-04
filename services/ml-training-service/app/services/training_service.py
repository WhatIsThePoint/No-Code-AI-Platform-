"""
Orchestrates model selection, data loading, training, and evaluation.
"""
from __future__ import annotations

import os
from typing import Any

import pandas as pd

from ..models.base import BaseMLModel
from ..models.classification import (
    XGBoostClassifierModel,
    RandomForestModel,
    GBMClassifierModel,
    GLMClassifierModel,
)
from ..models.regression import (
    XGBoostRegressorModel,
    RandomForestRegressorModel,
    GBMRegressorModel,
    RidgeRegressorModel,
    LightGBMRegressorModel,
    CatBoostRegressorModel,
)
from ..models.clustering import KMeansModel
from ..models.forecasting import ProphetModel
from ..models.boosting import LightGBMModel, CatBoostModel

_REGISTRY: dict[str, type[BaseMLModel]] = {
    # Classification
    "xgboost": XGBoostClassifierModel,
    "random_forest": RandomForestModel,
    "gbm": GBMClassifierModel,
    "glm": GLMClassifierModel,
    "lightgbm": LightGBMModel,
    "catboost": CatBoostModel,
    # Regression
    "xgboost_reg": XGBoostRegressorModel,
    "random_forest_reg": RandomForestRegressorModel,
    "gbm_reg": GBMRegressorModel,
    "ridge": RidgeRegressorModel,
    "lightgbm_reg": LightGBMRegressorModel,
    "catboost_reg": CatBoostRegressorModel,
    # Clustering & Forecasting
    "kmeans": KMeansModel,
    "prophet": ProphetModel,
}

SUPPORTED_ALGORITHMS = list(_REGISTRY.keys())


def get_model(algorithm: str, hyperparams: dict) -> BaseMLModel:
    cls = _REGISTRY.get(algorithm)
    if not cls:
        raise ValueError(f"Unknown algorithm: {algorithm}. Supported: {SUPPORTED_ALGORITHMS}")
    return cls(hyperparams)


def load_split(dataset_dir: str, split: str) -> pd.DataFrame:
    """Load train / val / test parquet from the dataset directory."""
    path = os.path.join(dataset_dir, f"{split}.parquet")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Split file not found: {path}")
    return pd.read_parquet(path)


def prepare_xy(
    df: pd.DataFrame,
    target_column: str,
    task_type: str,
) -> tuple[pd.DataFrame, pd.Series | None]:
    """
    Split a loaded split DataFrame into features X and target y.
    For clustering / forecasting, y is None.
    For Prophet, X must retain 'ds' column.
    """
    if task_type == "clustering":
        return df, None

    if task_type == "regression":
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found")
        return df.drop(columns=[target_column]), df[target_column]

    if task_type == "forecasting":
        # Expect 'ds' and target column
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found for forecasting")
        prophet_df = df[[col for col in df.columns]].copy()
        prophet_df = prophet_df.rename(columns={target_column: "y"})
        return prophet_df, prophet_df["y"]

    if target_column not in df.columns:
        raise ValueError(f"Target column '{target_column}' not found")

    y = df[target_column]
    X = df.drop(columns=[target_column])
    return X, y
