export type DatasetStatus =
  | "uploaded"
  | "profiling"
  | "ready"
  | "preprocessing"
  | "preprocessed"
  | "error";

export interface ColumnHistogram {
  bins: number[];
  counts: number[];
}

export interface ColumnBoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  lower_fence: number;
  upper_fence: number;
}

export interface ColumnOutliers {
  count: number;
  pct: number;
  threshold_z: number;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  missing_count: number;
  missing_pct: number;
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  unique_count: number;
  sample_values: unknown[];
  histogram?: ColumnHistogram;
  // Sprint 7 Module 2 additions
  box_stats?: ColumnBoxStats;
  outliers?: ColumnOutliers;
  skewness?: number;
  needs_log_transform?: boolean;
  top_values?: Record<string, number>;
}

export interface CorrelationMatrix {
  columns: string[];
  values: number[][];
}

export interface TargetClass {
  label: string | number | boolean;
  count: number;
  pct: number;
}

export interface TargetImbalance {
  total: number;
  n_classes: number;
  classes: TargetClass[];
  minority_pct: number;
  majority_pct: number;
  needs_balancing: boolean;
  is_classification_like: boolean;
}

export interface ProfilingSummary {
  columns: ColumnProfile[];
  total_missing_pct: number;
  duplicate_rows: number;
  profiling_completed_at?: string;
  correlation_matrix?: CorrelationMatrix;
  correlation_truncated?: boolean;
  // Sprint 7 Module 2 additions
  target_column?: string;
  target_imbalance?: TargetImbalance;
  skewed_columns?: string[];
}

export interface PreprocessingConfig {
  target_column: string;
  included_columns: string[];
  excluded_columns: string[];
  imputation_strategy: "mean" | "median" | "mode" | "constant";
  encoding_strategy: "onehot" | "label" | "ordinal";
  scaling_strategy: "standard" | "minmax" | "robust" | "none";
  split_ratios: { train: number; val: number; test: number };
}

export interface Dataset {
  dataset_id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  description?: string | null;
  source_type: "csv" | "excel" | "postgres" | "mysql";
  status: DatasetStatus;
  row_count?: number;
  column_count?: number;
  size_bytes?: number;
  profiling_summary?: ProfilingSummary;
  preprocessing_config?: PreprocessingConfig;
  task_id?: string;
  created_at: string;
  updated_at: string;
  last_edited_by?: string;
  last_edited_at?: string;
}
