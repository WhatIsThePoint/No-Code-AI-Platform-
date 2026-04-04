"""
Batch prediction endpoint.
POST /models/<version_id>/predict — upload a CSV, get predictions back as CSV.
Available on solo and company tiers only.
"""

from __future__ import annotations

import joblib
import pandas as pd
from flask import Blueprint, jsonify, make_response, request

from ..extensions import mongo
from ..limits import check_feature
from ..services.model_registry import get_model_version

predict_bp = Blueprint("predict", __name__)


@predict_bp.post("/models/<version_id>/predict")
def batch_predict(version_id: str):
    user_id = request.headers.get("X-User-Id")
    tier = request.headers.get("X-User-Tier", "free")
    if not user_id:
        return jsonify({"error": "unauthorized"}), 401

    err = check_feature("batch_predictions", tier)
    if err:
        return err

    doc = get_model_version(mongo.db, version_id)
    if not doc:
        return jsonify({"error": "not_found"}), 404
    if doc["user_id"] != user_id:
        return jsonify({"error": "forbidden"}), 403

    artifact_path = doc.get("artifact_path")
    if not artifact_path:
        return jsonify({"error": "artifact_missing"}), 404

    if "file" not in request.files:
        return jsonify({"error": "no_file_provided"}), 400

    file = request.files["file"]
    if not file.filename or not file.filename.endswith(".csv"):
        return jsonify({"error": "csv_required"}), 400

    try:
        df = pd.read_csv(file)
    except Exception:
        return jsonify({"error": "invalid_csv"}), 400

    try:
        estimator = joblib.load(artifact_path)
    except Exception:
        return jsonify({"error": "model_load_failed"}), 500

    task_type = doc.get("task_type", "classification")

    try:
        if task_type == "forecasting":
            # Prophet expects a 'ds' column
            if "ds" not in df.columns:
                return jsonify({"error": "forecast_requires_ds_column"}), 400
            forecast = estimator.predict(df[["ds"]])
            out = df.copy()
            out["yhat"] = forecast["yhat"].values
            if "yhat_lower" in forecast.columns:
                out["yhat_lower"] = forecast["yhat_lower"].values
                out["yhat_upper"] = forecast["yhat_upper"].values
        elif task_type == "clustering":
            labels = estimator.predict(df.values)
            out = df.copy()
            out["cluster"] = labels
        else:
            # classification / regression — drop target column if present
            target = doc.get("hyperparams", {}).get("target_column", "")
            X = df.drop(columns=[target], errors="ignore") if target else df
            preds = estimator.predict(X)
            out = df.copy()
            col = "prediction" if task_type == "regression" else "predicted_class"
            out[col] = preds
    except Exception as exc:
        return jsonify({"error": "prediction_failed", "detail": str(exc)}), 422

    csv_bytes = out.to_csv(index=False).encode()
    response = make_response(csv_bytes)
    response.headers["Content-Type"] = "text/csv"
    response.headers["Content-Disposition"] = (
        f'attachment; filename="predictions_{version_id[:8]}.csv"'
    )
    return response
