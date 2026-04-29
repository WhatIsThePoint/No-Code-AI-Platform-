export type PipelineStatus = "draft" | "running" | "done" | "error";
export type PipelineType = "ml" | "rag";
export type NodeType =
  | "dataset"
  | "train"
  | "evaluate"
  | "document"
  | "vector_store"
  | "rag_config";
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

// ── RAG / GenAI workspace nodes (Sprint 5 Module 2) ─────────────────────────
export interface DocumentNodeData {
  document_id?: string;
  source_name?: string;
  chunk_count?: number;
  status?: "queued" | "running" | "ready" | "error";
}

export interface VectorStoreNodeData {
  // Visual representation only — pgvector is the backing store.
  total_chunks?: number;
}

export type RAGLlmEngine =
  | "llama3.2:3b"
  | "llama3.2:1b"
  | "phi3:mini"
  | "gemma2:2b";

export interface RAGConfigNodeData {
  llm_engine?: RAGLlmEngine;
  top_k?: number;
}

export interface PipelineNode {
  node_id: string;
  type: NodeType;
  data:
    | DatasetNodeData
    | TrainNodeData
    | EvaluateNodeData
    | DocumentNodeData
    | VectorStoreNodeData
    | RAGConfigNodeData;
  position: { x: number; y: number };
}

export interface PipelineEdge {
  source: string;
  target: string;
}

export type OwnerType = "personal" | "company";

export interface Pipeline {
  pipeline_id: string;
  user_id: string;
  owner_type?: OwnerType;
  company_id: string | null;
  name: string;
  type?: PipelineType; // "ml" (default) | "rag"
  nodes: PipelineNode[];
  edges: PipelineEdge[];
  status: PipelineStatus;
  last_run_task_id: string | null;
  last_version_id: string | null;
  created_at: string;
  updated_at: string;
  last_edited_by?: string;
  last_edited_at?: string;
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
