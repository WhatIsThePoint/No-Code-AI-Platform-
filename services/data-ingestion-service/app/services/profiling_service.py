"""
Compute a lightweight profiling summary for a DataFrame.
Uses pandas native statistics (fast) with optional ydata-profiling for rich reports.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

HIST_BINS = 30
MAX_CORR_COLUMNS = 25


def _column_histogram(series: pd.Series) -> dict[str, list[float]] | None:
    clean = series.dropna()
    if clean.empty:
        return None
    try:
        counts, bins = np.histogram(clean.to_numpy(dtype=float), bins=HIST_BINS)
    except (ValueError, TypeError):
        return None
    return {
        "bins": [round(float(b), 4) for b in bins],
        "counts": [int(c) for c in counts],
    }


def _correlation_matrix(df: pd.DataFrame) -> dict[str, Any] | None:
    numeric = df.select_dtypes(include="number")
    if numeric.shape[1] < 2:
        return None
    truncated = False
    if numeric.shape[1] > MAX_CORR_COLUMNS:
        numeric = numeric.iloc[:, :MAX_CORR_COLUMNS]
        truncated = True
    corr = numeric.corr(method="pearson").round(4)
    corr = corr.replace({np.nan: 0.0})
    return {
        "columns": [str(c) for c in corr.columns],
        "values": [[float(v) for v in row] for row in corr.to_numpy()],
        "truncated": truncated,
    }


def compute_profile_summary(df: pd.DataFrame) -> dict[str, Any]:
    columns = []
    for col in df.columns:
        series = df[col]
        info: dict[str, Any] = {
            "name": col,
            "dtype": str(series.dtype),
            "missing_count": int(series.isna().sum()),
            "missing_pct": round(float(series.isna().mean() * 100), 2),
            "unique_count": int(series.nunique()),
        }

        if pd.api.types.is_numeric_dtype(series):
            desc = series.describe()
            info["mean"] = round(float(desc.get("mean", 0)), 4)
            info["std"] = round(float(desc.get("std", 0)), 4)
            info["min"] = float(desc.get("min", 0))
            info["max"] = float(desc.get("max", 0))
            info["sample_values"] = series.dropna().head(5).tolist()
            hist = _column_histogram(series)
            if hist is not None:
                info["histogram"] = hist
        else:
            info["sample_values"] = series.dropna().head(5).tolist()
            info["top_values"] = series.value_counts().head(5).to_dict()

        columns.append(info)

    summary: dict[str, Any] = {
        "columns": columns,
        "total_missing_pct": round(float(df.isna().mean().mean() * 100), 2),
        "duplicate_rows": int(df.duplicated().sum()),
        "profiling_completed_at": datetime.now(timezone.utc).isoformat(),
    }

    corr = _correlation_matrix(df)
    if corr is not None:
        summary["correlation_matrix"] = {
            "columns": corr["columns"],
            "values": corr["values"],
        }
        if corr["truncated"]:
            summary["correlation_truncated"] = True

    return summary
