"""
Preprocessing pipeline: imputation → encoding → scaling → train/val/test split.
"""

from __future__ import annotations

import os

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import (
    LabelEncoder,
    MinMaxScaler,
    OneHotEncoder,
    OrdinalEncoder,
    RobustScaler,
    StandardScaler,
)

from .storage_service import load_dataframe


def preprocess_dataset(
    file_path: str,
    config: dict,
    output_dir: str,
    task_id: str,
    db,
) -> None:
    df = load_dataframe(file_path)

    target = config.get("target_column")
    included = config.get("included_columns") or list(df.columns)
    excluded = set(config.get("excluded_columns") or [])
    feature_cols = [c for c in included if c != target and c not in excluded]

    df_features = df[feature_cols].copy()
    df_target = df[target].copy() if target else None

    numeric_cols = df_features.select_dtypes(include="number").columns.tolist()
    cat_cols = df_features.select_dtypes(exclude="number").columns.tolist()

    # Imputation strategy
    imputation = config.get("imputation_strategy", "mean")
    num_imputer = SimpleImputer(
        strategy=imputation if imputation != "mode" else "most_frequent"
    )
    cat_imputer = SimpleImputer(strategy="most_frequent")

    # Encoding
    encoding = config.get("encoding_strategy", "onehot")
    if encoding == "onehot":
        encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
    else:
        # "label" and "ordinal" both use OrdinalEncoder
        # (LabelEncoder is 1D-only, incompatible with ColumnTransformer)
        encoder = OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)

    # Scaling
    scaling = config.get("scaling_strategy", "standard")
    scalers = {
        "standard": StandardScaler(),
        "minmax": MinMaxScaler(),
        "robust": RobustScaler(),
    }
    scaler = scalers.get(scaling)

    # Build ColumnTransformer
    transformers = []
    if numeric_cols:
        num_pipe_steps = [("imputer", num_imputer)]
        if scaler:
            num_pipe_steps.append(("scaler", scaler))
        transformers.append(("numeric", Pipeline(num_pipe_steps), numeric_cols))
    if cat_cols:
        cat_pipe_steps = [("imputer", cat_imputer), ("encoder", encoder)]
        transformers.append(("categorical", Pipeline(cat_pipe_steps), cat_cols))

    if not transformers:
        raise ValueError("No features to preprocess")

    # Guard: one-hot on a high-cardinality column produces a dense matrix of
    # `n_rows × sum(unique_values)`. A single ID-like column with 100k+ uniques
    # silently asks numpy for tens of GiB and OOM-crashes the worker (which
    # then leaves the task unacked, wedging the queue for everything behind
    # it). Refuse cleanly before we get there so the user sees a real error.
    if encoding == "onehot" and cat_cols:
        MAX_OHE_OUTPUT_COLS = 2000
        per_col_unique = {c: int(df_features[c].nunique(dropna=True)) for c in cat_cols}
        total_ohe_cols = sum(per_col_unique.values())
        if total_ohe_cols > MAX_OHE_OUTPUT_COLS:
            offenders = sorted(
                ((c, n) for c, n in per_col_unique.items() if n > 50),
                key=lambda kv: -kv[1],
            )[:5]
            offender_str = ", ".join(f"{c}={n}" for c, n in offenders) or "(none)"
            raise ValueError(
                "onehot_too_wide: total one-hot output would be "
                f"{total_ohe_cols} columns (max {MAX_OHE_OUTPUT_COLS}). "
                "Drop or label-encode the high-cardinality columns first. "
                f"Top offenders: {offender_str}."
            )

    ct = ColumnTransformer(transformers=transformers, remainder="drop")

    # Update progress
    db["task_results"].update_one({"task_id": task_id}, {"$set": {"progress_pct": 50}})

    X = ct.fit_transform(df_features)

    # Get output column names
    output_cols = []
    for name, transformer, cols in ct.transformers_:
        if name == "numeric":
            output_cols.extend(cols)
        elif name == "categorical":
            encoder_step = transformer.named_steps.get("encoder")
            if hasattr(encoder_step, "get_feature_names_out"):
                output_cols.extend(encoder_step.get_feature_names_out(cols).tolist())
            else:
                output_cols.extend(cols)

    df_processed = pd.DataFrame(X, columns=output_cols)
    if df_target is not None:
        # Encode target if categorical
        if df_target.dtype == object:
            le = LabelEncoder()
            df_target = pd.Series(le.fit_transform(df_target), name=target)
        df_processed[target] = df_target.values

    # Train / val / test split
    ratios = config.get("split_ratios", {"train": 0.7, "val": 0.15, "test": 0.15})
    train_ratio = ratios.get("train", 0.7)
    val_ratio = ratios.get("val", 0.15)

    train_df, temp_df = train_test_split(
        df_processed, test_size=1 - train_ratio, random_state=42
    )
    relative_val = val_ratio / (1 - train_ratio)
    val_df, test_df = train_test_split(
        temp_df, test_size=1 - relative_val, random_state=42
    )

    db["task_results"].update_one({"task_id": task_id}, {"$set": {"progress_pct": 90}})

    train_df.to_parquet(os.path.join(output_dir, "train.parquet"), index=False)
    val_df.to_parquet(os.path.join(output_dir, "val.parquet"), index=False)
    test_df.to_parquet(os.path.join(output_dir, "test.parquet"), index=False)
