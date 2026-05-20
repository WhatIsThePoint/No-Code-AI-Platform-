import type { Algorithm, CNNArch, TaskType } from "./pipeline";

export interface ClassificationMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc?: number;
  confusion_matrix: number[][];
  feature_importance?: Record<string, number>;
  shap_importance?: Record<string, number>;
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

export interface ResidualPoint {
  y_true: number;
  y_pred: number;
}

export interface RegressionMetrics {
  mae: number;
  rmse: number;
  r2: number;
  feature_importance?: Record<string, number>;
  shap_importance?: Record<string, number>;
  residuals_sample?: ResidualPoint[];
}

export type ModelMetrics = ClassificationMetrics | RegressionMetrics | ClusteringMetrics | ForecastMetrics;

/** Image-classification metrics surfaced by dl-training-service. Kept
 *  separate from ModelMetrics so the H2O-tabular pages don't have to
 *  defensive-cast — DL versions are rendered through their own predict
 *  panel + registry row variant. */
export interface DLClassificationMetrics {
  val_acc: number;
  final_train_loss: number;
  final_val_loss: number;
}

export interface ModelVersion {
  version_id: string;
  pipeline_id: string;
  user_id: string;
  /** "h2o" (default, omitted on legacy rows) or "pytorch". DL rows from
   *  dl-training-service stamp this so the registry page can branch. */
  framework?: "h2o" | "pytorch";
  // Tabular rows always carry these; DL rows omit them.
  algorithm?: Algorithm;
  task_type?: TaskType;
  // DL rows carry `arch` instead of `algorithm`.
  arch?: CNNArch;
  hyperparams?: Record<string, number | string>;
  metrics?: ModelMetrics | DLClassificationMetrics;
  artifact_path: string;
  /** Directory holding the .pt + class_index.json + training_meta.json
   *  (DL only). H2O rows store the artefact as a single file. */
  artifact_dir?: string;
  /** Tabular rows use `training_duration_s`; DL rows ship `duration_s`. */
  training_duration_s?: number;
  duration_s?: number;
  created_at: string;
}
