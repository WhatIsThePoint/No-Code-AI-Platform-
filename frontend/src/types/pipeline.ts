export type PipelineStatus = "draft" | "running" | "done" | "error";
export type NodeType = "dataset" | "train" | "evaluate";
export type TaskType = "classification" | "regression" | "clustering" | "forecasting";
export type Algorithm =
  | "xgboost"
  | "random_forest"
  | "gbm"
  | "glm"
  | "lightgbm"
  | "catboost"
  | "xgboost_reg"
  | "random_forest_reg"
  | "gbm_reg"
  | "ridge"
  | "lightgbm_reg"
  | "catboost_reg"
  | "kmeans"
  | "prophet";

export interface DatasetNodeData {
  dataset_id: string;
  dataset_name?: string;
}

export interface TrainNodeData {
  algorithm: Algorithm;
  task_type: TaskType;
  hyperparams: Record<string, number | string | boolean>;
  target_column?: string;
}

export interface EvaluateNodeData {
  version_id?: string;
}

export interface PipelineNode {
  node_id: string;
  type: NodeType;
  data: DatasetNodeData | TrainNodeData | EvaluateNodeData;
  position: { x: number; y: number };
}

export interface PipelineEdge {
  source: string;
  target: string;
}

export interface Pipeline {
  pipeline_id: string;
  user_id: string;
  company_id: string | null;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  status: PipelineStatus;
  last_run_task_id: string | null;
  last_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface StepNote {
  note_id: string;
  pipeline_id: string;
  node_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}
