import type { Edge, Node } from "@xyflow/react";
import type { NodeType } from "../../../types/pipeline";

export type NodeValidationStatus = "valid" | "warning" | "error";

export interface NodeValidation {
  status: NodeValidationStatus;
  message: string;
}

export const VALIDATION_COLORS: Record<NodeValidationStatus, string> = {
  valid: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
};

export function getValidationBorderColor(
  validation: NodeValidation | undefined,
  fallback: string,
): string {
  if (!validation || validation.status === "valid") return fallback;
  return validation.status === "error" ? VALIDATION_COLORS.error : VALIDATION_COLORS.warning;
}

const OK: NodeValidation = { status: "valid", message: "Ready" };

function incomingFrom(node: Node, edges: Edge[], allNodes: Node[], type: NodeType): Node | null {
  const inbound = edges.filter((e) => e.target === node.id);
  for (const e of inbound) {
    const src = allNodes.find((n) => n.id === e.source);
    if (src && src.type === type) return src;
  }
  return null;
}

function hasAnyIncoming(node: Node, edges: Edge[], allNodes: Node[], types: NodeType[]): boolean {
  const inbound = edges.filter((e) => e.target === node.id);
  return inbound.some((e) => {
    const src = allNodes.find((n) => n.id === e.source);
    return !!src && types.includes(src.type as NodeType);
  });
}

export function validateNode(node: Node, edges: Edge[], allNodes: Node[]): NodeValidation {
  const data = (node.data ?? {}) as Record<string, unknown>;
  switch (node.type as NodeType) {
    case "dataset": {
      const datasetId = data.dataset_id as string | undefined;
      if (!datasetId) return { status: "error", message: "Pick a dataset" };
      return OK;
    }
    case "train": {
      const algorithm = data.algorithm as string | undefined;
      const target = (data.target_column as string | undefined) ?? "";
      if (!incomingFrom(node, edges, allNodes, "dataset")) {
        return { status: "error", message: "Connect a Dataset node" };
      }
      if (!algorithm) return { status: "error", message: "Choose an algorithm" };
      if (!target.trim()) return { status: "error", message: "Set the target column" };
      return OK;
    }
    case "evaluate": {
      if (!incomingFrom(node, edges, allNodes, "train")) {
        return { status: "error", message: "Connect a Train node" };
      }
      const versionId = data.version_id as string | undefined;
      if (!versionId) return { status: "warning", message: "Awaiting training run" };
      return OK;
    }
    case "document": {
      const status = data.status as string | undefined;
      const documentId = data.document_id as string | undefined;
      if (status === "error") return { status: "error", message: "Ingestion failed — re-upload" };
      if (!documentId) return { status: "error", message: "Upload a PDF / TXT / MD" };
      if (status === "queued" || status === "running") {
        return { status: "warning", message: "Indexing in progress…" };
      }
      return OK;
    }
    case "vector_store": {
      if (!hasAnyIncoming(node, edges, allNodes, ["document"])) {
        return { status: "error", message: "Connect a Document node" };
      }
      const total = (data.total_chunks as number | undefined) ?? 0;
      if (total === 0) return { status: "warning", message: "No chunks indexed yet" };
      return OK;
    }
    case "rag_config": {
      if (!hasAnyIncoming(node, edges, allNodes, ["vector_store"])) {
        return { status: "error", message: "Connect a Vector Store node" };
      }
      const engine = data.llm_engine as string | undefined;
      if (!engine) return { status: "error", message: "Pick a local LLM engine" };
      return OK;
    }
    // ── Deep-learning family ─────────────────────────────────────────────
    case "image_dataset": {
      const datasetId = data.dataset_id as string | undefined;
      if (!datasetId) return { status: "error", message: "Pick an image dataset" };
      const numClasses = data.num_classes as number | undefined;
      if (numClasses !== undefined && numClasses < 2) {
        return { status: "error", message: "Need at least 2 classes" };
      }
      return OK;
    }
    case "cnn_arch": {
      if (!incomingFrom(node, edges, allNodes, "image_dataset")) {
        return { status: "error", message: "Connect an Image Dataset node" };
      }
      if (!(data.arch as string | undefined)) {
        return { status: "error", message: "Pick a CNN architecture" };
      }
      return OK;
    }
    case "dl_train": {
      if (!incomingFrom(node, edges, allNodes, "cnn_arch")) {
        return { status: "error", message: "Connect a CNN Arch node" };
      }
      const epochs = data.epochs as number | undefined;
      if (!epochs || epochs < 1) return { status: "error", message: "Set epochs ≥ 1" };
      const batch = data.batch_size as number | undefined;
      if (!batch || batch < 1) return { status: "error", message: "Set batch size ≥ 1" };
      return OK;
    }
    default:
      return OK;
  }
}
