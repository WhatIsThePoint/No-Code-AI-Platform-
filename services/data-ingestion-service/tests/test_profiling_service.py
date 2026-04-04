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
