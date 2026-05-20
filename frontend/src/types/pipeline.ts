export type PipelineStatus = "draft" | "running" | "done" | "error";
export type PipelineType = "ml" | "rag" | "dl";
export type NodeType =
  | "dataset"
  | "train"
  | "evaluate"
  | "document"
  | "vector_store"
  | "rag_config"
  | "image_dataset"
  | "cnn_arch"
  | "dl_train";
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

// ── Deep-learning workspace nodes (Sprint 8) ────────────────────────────────
// Mirrors the contract of the dl-training-service POST /dl/train payload.
// Keep field names identical to backend hparams so the canvas → API hop
// can flatten the merged node data without remapping.

export type CNNArch = "lenet" | "tiny_resnet" | "mobilenet_v3_small";
export type DLOptimizer = "sgd" | "adam";
/** Closed set — server enforces an identical ALLOWED_INPUT_SIZES. */
export type DLInputSize = 28 | 64 | 128 | 224;

// All fields are optional on the canvas — the node components apply
// sensible defaults inline, and `validation.ts` flags missing values
// rather than relying on TS to enforce them. Same convention as the
// other node-data interfaces above (DocumentNodeData, RAGConfigNodeData).
export interface ImageDatasetNodeData {
  dataset_id?: string;
  dataset_name?: string;
  /** Server-side `image_profile.num_classes` — surfaced in the node body. */
  num_classes?: number;
  /** Server-side `image_profile.total_images`. */
  total_images?: number;
  /** Cached thumbnail strip from /image-preview, populated lazily. */
  thumbnails?: { class: string; thumb_b64: string }[];
}

export interface CNNArchNodeData {
  arch?: CNNArch;
  pretrained?: boolean;
  input_size?: DLInputSize;
}

export interface DLTrainNodeData {
  epochs?: number;
  batch_size?: number;
  lr?: number;
  optimizer?: DLOptimizer;
  augment?: boolean;
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
    | RAGConfigNodeData
    | ImageDatasetNodeData
    | CNNArchNodeData
    | DLTrainNodeData;
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
