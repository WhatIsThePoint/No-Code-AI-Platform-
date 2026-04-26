import numpy as np
import pandas as pd
from app.services.profiling_service import compute_profile_summary


def test_profile_summary_numeric():
    df = pd.DataFrame(
        {"age": [25, 30, None, 40], "income": [50000, 60000, 70000, 80000]}
    )
    summary = compute_profile_summary(df)

    assert len(summary["columns"]) == 2
    age_col = next(c for c in summary["columns"] if c["name"] == "age")
    assert age_col["missing_count"] == 1
    assert age_col["missing_pct"] == 25.0
    assert age_col["mean"] is not None


def test_profile_summary_categorical():
    df = pd.DataFrame({"color": ["red", "blue", "red", None]})
    summary = compute_profile_summary(df)
    color_col = summary["columns"][0]
    assert color_col["unique_count"] == 2
    assert color_col["missing_count"] == 1


def test_duplicate_row_detection():
    df = pd.DataFrame({"x": [1, 1, 2, 3]})
    summary = compute_profile_summary(df)
    assert summary["duplicate_rows"] == 1


# ---------------------------------------------------------------------------
# Sprint 7 Module 2 — box stats / outliers / skewness / target imbalance
# ---------------------------------------------------------------------------


def test_box_stats_and_outliers_flagged_for_numeric():
    rng = np.random.default_rng(42)
    base = rng.normal(loc=50, scale=5, size=200).tolist()
    # Plant a handful of obvious z>3 outliers so we get a non-zero count.
    base += [200.0, 210.0, 220.0]
    df = pd.DataFrame({"price": base})

    summary = compute_profile_summary(df)
    col = summary["columns"][0]

    box = col["box_stats"]
    assert box["q1"] < box["median"] < box["q3"]
    assert box["lower_fence"] <= box["min"] or box["lower_fence"] <= box["q1"]
    assert box["upper_fence"] >= box["q3"]

    outliers = col["outliers"]
    assert outliers["count"] >= 3
    assert outliers["threshold_z"] == 3.0


def test_skewness_triggers_log_transform_suggestion():
    # Exponentially distributed → strongly right-skewed and non-negative.
    rng = np.random.default_rng(0)
    df = pd.DataFrame({"amount": rng.exponential(scale=2.0, size=400)})

    summary = compute_profile_summary(df)
    col = summary["columns"][0]

    assert col["skewness"] > 1.0
    assert col["needs_log_transform"] is True
    assert "amount" in summary["skewed_columns"]


def test_target_imbalance_flags_minority_class():
    # 95 / 5 split → minority well below the 20% threshold.
    df = pd.DataFrame(
        {
            "feat": list(range(100)),
            "label": ["yes"] * 95 + ["no"] * 5,
        }
    )

    summary = compute_profile_summary(df, target_column="label")

    assert summary["target_column"] == "label"
    imb = summary["target_imbalance"]
    assert imb["n_classes"] == 2
    assert imb["needs_balancing"] is True
    assert imb["minority_pct"] == 5.0
    assert imb["is_classification_like"] is True


def test_target_imbalance_balanced_does_not_warn():
    df = pd.DataFrame(
        {
            "feat": list(range(100)),
            "label": ["a"] * 50 + ["b"] * 50,
        }
    )
    summary = compute_profile_summary(df, target_column="label")
    imb = summary["target_imbalance"]
    assert imb["needs_balancing"] is False
    assert imb["minority_pct"] == 50.0
