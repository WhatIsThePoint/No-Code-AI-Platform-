"""
Time-series forecasting: Facebook Prophet.
"""

from __future__ import annotations

from typing import Any

import pandas as pd

from .base import BaseMLModel


class ProphetModel(BaseMLModel):
    def train(self, X_train: pd.DataFrame, y_train: pd.Series | None = None) -> None:
        """
        X_train must have columns 'ds' (datetime) and 'y' (numeric target).
        Prophet is trained directly on this DataFrame.
        """
        from prophet import Prophet  # lazy import — heavy startup cost

        hp = self.hyperparams
        self._estimator = Prophet(
            seasonality_mode=hp.get("seasonality_mode", "additive"),
            yearly_seasonality="auto",
            weekly_seasonality="auto",
            daily_seasonality=False,
        )
        # Silence noisy Stan output
        import logging

        logging.getLogger("prophet").setLevel(logging.WARNING)
        logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

        self._estimator.fit(X_train[["ds", "y"]])

    def predict(self, X: pd.DataFrame) -> pd.DataFrame:
        """X must have a 'ds' column. Returns forecast DataFrame."""
        future = X[["ds"]]
        return self._estimator.predict(future)

    def evaluate(
        self, X_test: pd.DataFrame, y_test: pd.Series | None = None
    ) -> dict[str, Any]:
        """
        X_test is a future DataFrame with 'ds' column.
        Optionally: if X_test also has 'y' column we compute MAE / MAPE.
        """
        hp = self.hyperparams
        periods = int(hp.get("periods", 30))
        freq = hp.get("freq", "D")

        future = self._estimator.make_future_dataframe(periods=periods, freq=freq)
        forecast = self._estimator.predict(future)

        forecast_records = (
            forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(periods).copy()
        )
        forecast_records["ds"] = forecast_records["ds"].dt.strftime("%Y-%m-%d")
        forecast_data = forecast_records.to_dict(orient="records")

        metrics: dict[str, Any] = {
            "periods_forecasted": periods,
            "freq": freq,
            "forecast_data": forecast_data,
        }

        # Compute MAE/MAPE on holdout if 'y' available in X_test
        if y_test is not None and not y_test.empty:
            holdout = forecast[
                forecast["ds"].isin(X_test.get("ds", pd.Series()))
            ].copy()
            if not holdout.empty:
                y_true = y_test.values[: len(holdout)]
                y_hat = holdout["yhat"].values[: len(y_true)]
                mae = float(abs(y_true - y_hat).mean())
                mape = float((abs(y_true - y_hat) / (abs(y_true) + 1e-8)).mean()) * 100
                metrics["mae"] = round(mae, 4)
                metrics["mape"] = round(mape, 4)

        return metrics
