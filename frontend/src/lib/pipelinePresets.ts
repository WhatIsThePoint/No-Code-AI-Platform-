import type { Edge, Node } from "@xyflow/react";
import { defaultHyperparams } from "../components/pipeline/HyperparamControls";
import type { PipelineType } from "../types/pipeline";

export interface PipelinePreset {
  id: string;
  i18nKey: "mlStarter" | "ragStarter" | "dlStarter";
  mode: PipelineType;
  /**
   * Build the (nodes, edges) the preset should append to the canvas.
   * Receives a fresh-ID minter so each invocation produces unique node IDs
   * even when the same preset is dropped multiple times.
   */
  build: (mintId: () => string, ctx: PresetContext) => { nodes: Node[]; edges: Edge[] };
}

export interface PresetContext {
  pipelineId: string;
  /** Stamped onto DocumentNodes so they can upload immediately. */
  onIngestStart?: (
    nodeId: string,
    taskId: string,
    documentId: string,
    sourceName: string,
  ) => void;
}

/**
 * `crypto.randomUUID` is available everywhere we run (modern Chromium,
 * Firefox, Safari 15+). Falls back to a Math.random base36 string for the
 * vanishingly unlikely case it's missing — collisions inside a single
 * canvas session are still functionally impossible.
 */
function safeRandomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createIdMinter(): () => string {
  return () => `node-${safeRandomId()}`;
}

export const PIPELINE_PRESETS: PipelinePreset[] = [
  {
    id: "ml-starter",
    i18nKey: "mlStarter",
    mode: "ml",
    build: (mintId) => {
      const datasetId = mintId();
      const trainId = mintId();
      const evaluateId = mintId();
      // Initial positions are placeholders — the canvas runs auto-layout
      // immediately after appending, so these only matter if dagre fails.
      return {
        nodes: [
          {
            id: datasetId,
            type: "dataset",
            position: { x: 60, y: 120 },
            data: { dataset_id: "", dataset_name: "" },
          },
          {
            id: trainId,
            type: "train",
            position: { x: 320, y: 120 },
            data: {
              algorithm: "xgboost",
              task_type: "classification",
              hyperparams: defaultHyperparams("xgboost"),
              target_column: "",
            },
          },
          {
            id: evaluateId,
            type: "evaluate",
            position: { x: 580, y: 120 },
            data: {},
          },
        ],
        edges: [
          { id: `e-${datasetId}-${trainId}`, source: datasetId, target: trainId, animated: true },
          { id: `e-${trainId}-${evaluateId}`, source: trainId, target: evaluateId, animated: true },
        ],
      };
    },
  },
  {
    id: "rag-starter",
    i18nKey: "ragStarter",
    mode: "rag",
    build: (mintId, ctx) => {
      const documentId = mintId();
      const vectorStoreId = mintId();
      const ragConfigId = mintId();
      return {
        nodes: [
          {
            id: documentId,
            type: "document",
            position: { x: 60, y: 120 },
            data: {
              pipelineId: ctx.pipelineId,
              onIngestStart: ctx.onIngestStart,
            },
          },
          {
            id: vectorStoreId,
            type: "vector_store",
            position: { x: 320, y: 120 },
            data: { total_chunks: 0 },
          },
          {
            id: ragConfigId,
            type: "rag_config",
            position: { x: 580, y: 120 },
            data: { llm_engine: "llama3.2:3b", top_k: 3 },
          },
        ],
        edges: [
          {
            id: `e-${documentId}-${vectorStoreId}`,
            source: documentId,
            target: vectorStoreId,
            animated: true,
          },
          {
            id: `e-${vectorStoreId}-${ragConfigId}`,
            source: vectorStoreId,
            target: ragConfigId,
            animated: true,
          },
        ],
      };
    },
  },
];

// DL starter — image-classification path. The defaults match the
// `tiny_resnet @ 64 px, 5 epochs, batch=32, lr=1e-3` recommendation that
// fits comfortably on the 1660 Super demo GPU. Pretrained is left off
// because tiny_resnet has no canonical ImageNet checkpoint; mobilenet is
// available for users who want transfer-learning.
PIPELINE_PRESETS.push({
  id: "dl-starter",
  i18nKey: "dlStarter",
  mode: "dl",
  build: (mintId) => {
    const imgId = mintId();
    const archId = mintId();
    const trainId = mintId();
    return {
      nodes: [
        {
          id: imgId,
          type: "image_dataset",
          position: { x: 60, y: 120 },
          data: { dataset_id: "" },
        },
        {
          id: archId,
          type: "cnn_arch",
          position: { x: 320, y: 120 },
          data: { arch: "tiny_resnet", pretrained: false, input_size: 64 },
        },
        {
          id: trainId,
          type: "dl_train",
          position: { x: 580, y: 120 },
          data: {
            epochs: 5,
            batch_size: 32,
            lr: 1e-3,
            optimizer: "adam",
            augment: false,
          },
        },
      ],
      edges: [
        { id: `e-${imgId}-${archId}`, source: imgId, target: archId, animated: true },
        { id: `e-${archId}-${trainId}`, source: archId, target: trainId, animated: true },
      ],
    };
  },
});

export function presetsForMode(mode: PipelineType): PipelinePreset[] {
  return PIPELINE_PRESETS.filter((p) => p.mode === mode);
}
