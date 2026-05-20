import api from "./axios";
import type { CNNArch, DLInputSize, DLOptimizer } from "../types/pipeline";

// ── Types ────────────────────────────────────────────────────────────────────
// Mirrors the dl-training-service contract verbatim. Keeping it 1:1 means
// the canvas can flatten merged node data into a single POST body without
// adapter logic — see `useDLPipelineRun` (chat 6) for the orchestration
// that walks ImageDataset → CNNArch → DLTrain and submits the union.

export interface DLTrainPayload {
  pipeline_id: string;
  dataset_id: string;
  arch: CNNArch;
  pretrained: boolean;
  input_size: DLInputSize;
  epochs: number;
  batch_size: number;
  lr: number;
  optimizer: DLOptimizer;
  augment: boolean;
}

export interface DLVRAMEstimate {
  weights_mb: number;
  optimizer_mb: number;
  activations_mb: number;
  runtime_mb: number;
  total_mb: number;
}

export interface DLTrainStartResponse {
  task_id: string;
  version_id: string;
  estimate: DLVRAMEstimate;
  budget_mb: number;
}

export interface DLEpochPoint {
  epoch: number;
  train_loss: number;
  val_loss: number;
  val_acc: number;
}

export interface DLTaskStatus {
  task_id: string;
  status: "pending" | "running" | "success" | "failure";
  progress_pct: number;
  stage?: string;
  live_metrics?: DLEpochPoint[];
  metrics?: { val_acc: number; final_train_loss: number; final_val_loss: number };
  version_id?: string;
  error_message?: string;
}

export interface ImagePreviewSample {
  class: string;
  thumb_b64: string;
}

export interface ImagePreviewResponse {
  dataset_id: string;
  samples: ImagePreviewSample[];
}

export interface ImageUploadResponse {
  dataset_id: string;
  task_id: string;
  status: "extracting";
}

export interface DLPredictResponse {
  class: string;
  /** Top-k softmax probabilities; ordered by descending probability. */
  probs: { class: string; probability: number }[];
}

export interface DLGpuStatus {
  available: boolean;
  device_count?: number;
  device_name?: string;
  total_memory_mb?: number;
  compute_capability?: string;
  torch_version?: string;
  cuda_version?: string | null;
  error?: string;
}

// ── Endpoints ────────────────────────────────────────────────────────────────

export const dlApi = {
  /** Kick off a DL training run. 400 if VRAM budget exceeded. */
  startTraining: (payload: DLTrainPayload) =>
    api.post<DLTrainStartResponse>("/dl/train", payload),

  /** Poll the task_results doc; same shape as ml-training's status route. */
  getTaskStatus: (taskId: string) =>
    api.get<DLTaskStatus>(`/dl/train/${taskId}`),

  /** Single-image inference against a finished version. */
  predict: (versionId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api.post<DLPredictResponse>(`/dl/predict/${versionId}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  /** Reports CUDA visibility from inside the dl-training container. */
  gpuStatus: () => api.get<DLGpuStatus>("/dl/gpu"),

  // ── Image-dataset endpoints (proxied through data-ingestion-service) ─────
  uploadImageZip: (file: File, opts?: { description?: string; companyId?: string }) => {
    const fd = new FormData();
    fd.append("file", file);
    if (opts?.description) fd.append("description", opts.description);
    if (opts?.companyId) fd.append("company_id", opts.companyId);
    return api.post<ImageUploadResponse>("/datasets/image-upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  imagePreview: (datasetId: string, perClass: number = 3) =>
    api.get<ImagePreviewResponse>(`/datasets/${datasetId}/image-preview`, {
      params: { per_class: perClass },
    }),
};
