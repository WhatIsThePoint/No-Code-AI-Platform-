"""
Compute a lightweight profiling summary for a DataFrame.
Uses pandas native statistics (fast) with optional ydata-profiling for rich reports.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd


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
        else:
            info["sample_values"] = series.dropna().head(5).tolist()
            info["top_values"] = series.value_counts().head(5).to_dict()

        columns.append(info)

    return {
        "columns": columns,
        "total_missing_pct": round(float(df.isna().mean().mean() * 100), 2),
        "duplicate_rows": int(df.duplicated().sum()),
        "profiling_completed_at": datetime.now(timezone.utc).isoformat(),
    }
