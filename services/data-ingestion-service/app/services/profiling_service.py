"""
Compute a lightweight profiling summary for a DataFrame.
Uses pandas native statistics (fast) with optional ydata-profiling for rich reports.

Sprint 7 Module 2 additions:
- Per-column z-score outlier counts + sample box-plot stats (q1/q3/min/max/median).
- Per-column skewness with a `needs_log_transform` flag for heavily skewed data.
- Target-aware imbalance detection when a target column is supplied: emits
  `target_imbalance` block with class ratios + a `needs_balancing` boolean for
  the UI to surface a SMOTE recommendation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

HIST_BINS = 30
MAX_CORR_COLUMNS = 25

# Outliers: anything beyond ±OUTLIER_Z standard deviations from the mean.
OUTLIER_Z = 3.0
# Skewness above this absolute threshold suggests a log-transform.
SKEW_LOG_THRESHOLD = 1.5
# Target imbalance: minority class smaller than this fraction triggers a warning.
IMBALANCE_MINORITY_THRESHOLD = 0.20


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


def _box_stats(clean: pd.Series) -> dict[str, float] | None:
    """Five-number summary for a Plotly box/violin plot (no per-row payload)."""
    if clean.empty:
        return None
    arr = clean.to_numpy(dtype=float)
    q1, median, q3 = np.percentile(arr, [25, 50, 75])
    iqr = q3 - q1
    lower_fence = float(q1 - 1.5 * iqr)
    upper_fence = float(q3 + 1.5 * iqr)
    return {
        "min": float(arr.min()),
        "q1": float(q1),
        "median": float(median),
        "q3": float(q3),
        "max": float(arr.max()),
        "lower_fence": lower_fence,
        "upper_fence": upper_fence,
    }


def _outlier_summary(clean: pd.Series, std: float | None, mean: float | None) -> dict[str, Any] | None:
    """Z-score outlier counts. Skipped when std == 0 (constant series)."""
    if clean.empty or not std:
        return None
    z = (clean - mean) / std
    extreme_mask = z.abs() > OUTLIER_Z
    extreme_count = int(extreme_mask.sum())
    if extreme_count == 0:
        return {"count": 0, "pct": 0.0, "threshold_z": OUTLIER_Z}
    return {
        "count": extreme_count,
        "pct": round(float(extreme_count / len(clean) * 100), 2),
        "threshold_z": OUTLIER_Z,
    }


def _target_imbalance(target_series: pd.Series) -> dict[str, Any]:
    """Class-ratio summary + actionable `needs_balancing` flag for SMOTE."""
    counts = target_series.dropna().value_counts()
    total = int(counts.sum())
    if total == 0:
        return {"total": 0, "classes": [], "needs_balancing": False}

    classes = [
        {
            "label": (str(label) if not isinstance(label, (int, float, bool)) else label),
            "count": int(c),
            "pct": round(float(c / total * 100), 2),
        }
        for label, c in counts.items()
    ]
    minority_pct = min(c["pct"] for c in classes) if classes else 100.0
    is_classification = len(counts) <= 50  # heuristic, matches UI assumption
    return {
        "total": total,
        "n_classes": len(counts),
        "classes": classes[:20],  # cap UI payload
        "minority_pct": minority_pct,
        "majority_pct": max(c["pct"] for c in classes) if classes else 0.0,
        "needs_balancing": bool(
            is_classification and minority_pct < IMBALANCE_MINORITY_THRESHOLD * 100
        ),
        "is_classification_like": is_classification,
    }


def compute_profile_summary(
    df: pd.DataFrame,
    target_column: str | None = None,
) -> dict[str, Any]:
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
            clean = series.dropna()
            desc = series.describe()
            mean_val = round(float(desc.get("mean", 0)), 4)
            std_val = round(float(desc.get("std", 0)), 4)
            info["mean"] = mean_val
            info["std"] = std_val
            info["min"] = float(desc.get("min", 0))
            info["max"] = float(desc.get("max", 0))
            info["sample_values"] = series.dropna().head(5).tolist()
            hist = _column_histogram(series)
            if hist is not None:
                info["histogram"] = hist

            box = _box_stats(clean)
            if box is not None:
                info["box_stats"] = box

            outliers = _outlier_summary(clean, std_val, mean_val)
            if outliers is not None:
                info["outliers"] = outliers

            # Skewness — only meaningful with at least a handful of values.
            if len(clean) >= 8:
                skew = float(clean.skew())
                if np.isfinite(skew):
                    info["skewness"] = round(skew, 3)
                    info["needs_log_transform"] = bool(
                        abs(skew) >= SKEW_LOG_THRESHOLD and (clean.min() >= 0)
                    )
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

    if target_column and target_column in df.columns:
        summary["target_column"] = target_column
        summary["target_imbalance"] = _target_imbalance(df[target_column])

    # Top-level rollup so the UI can render a single banner without scanning columns.
    skewed_columns = [
        c["name"] for c in columns if c.get("needs_log_transform")
    ]
    if skewed_columns:
        summary["skewed_columns"] = skewed_columns

    return summary
