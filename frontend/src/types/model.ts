import type { Algorithm, TaskType } from "./pipeline";

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc?: number;
  confusion_matrix: number[][];
  feature_importance?: Record<string, number>;
}

export interface ClusteringMetrics {
  n_clusters: number;
  inertia: number;
  silhouette_score?: number;
  elbow_data?: Array<{ k: number; inertia: number }>;
}

export interface ForecastMetrics {
  periods_forecasted: number;
  freq: string;
  mae?: number;
  mape?: number;
  forecast_data: Array<{
    ds: string;
    yhat: number;
    yhat_lower: number;
    yhat_upper: number;
  }>;
}

export interface RegressionMetrics {
  mae: number;
  rmse: number;
  r2: number;
  feature_importance?: Record<string, number>;
}

export type ModelMetrics = ClassificationMetrics | RegressionMetrics | ClusteringMetrics | ForecastMetrics;

export interface ModelVersion {
  version_id: string;
  pipeline_id: string;
  user_id: string;
  algorithm: Algorithm;
  task_type: TaskType;
  hyperparams: Record<string, number | string>;
  metrics: ModelMetrics;
  artifact_path: string;
  training_duration_s: number;
  created_at: string;
}
