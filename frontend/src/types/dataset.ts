export type DatasetStatus =
  | "uploaded"
  | "profiling"
  | "ready"
  | "preprocessing"
  | "preprocessed"
  | "error";

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
}

export interface ProfilingSummary {
  columns: ColumnProfile[];
  total_missing_pct: number;
  duplicate_rows: number;
  profiling_completed_at?: string;
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
}
