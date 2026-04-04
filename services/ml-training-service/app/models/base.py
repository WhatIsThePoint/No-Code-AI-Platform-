"""
Abstract base class for all ML models in the platform.
Every model must implement train(), predict(), and evaluate().
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

import pandas as pd


class BaseMLModel(ABC):
    """
    Unified interface for all supported algorithms.

    Subclasses receive hyperparams as a dict at construction time and
    persist the trained estimator so evaluate() can be called after train().
    """

    def __init__(self, hyperparams: dict[str, Any]):
        self.hyperparams = hyperparams
        self._estimator = None  # set by train()

    @abstractmethod
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        """Fit the model. y_train is None for unsupervised tasks."""

    @abstractmethod
    def predict(self, X: pd.DataFrame) -> Any:
        """Return predictions for X."""

    @abstractmethod
    def evaluate(self, X_test: pd.DataFrame, y_test: pd.Series | None = None) -> dict[str, Any]:
        """Compute and return a metrics dict."""

    @property
    def estimator(self):
        return self._estimator
