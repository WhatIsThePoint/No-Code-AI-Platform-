import type { Node, Edge } from "@xyflow/react";
import type { Dataset } from "../../types/dataset";
import type { PipelineStatus } from "../../types/pipeline";

export type PipelineStep = 0 | 1 | 2 | 3 | 4;

interface DeriveArgs {
  nodes: Node[];
  edges: Edge[];
  datasets: Dataset[];
  pipelineStatus: PipelineStatus;
  taskStatus?: "running" | "success" | "failure" | "pending";
  hasLatestVersion: boolean;
}

export function derivePipelineStep({
  nodes,
  edges,
  datasets,
  pipelineStatus,
  taskStatus,
  hasLatestVersion,
}: DeriveArgs): { activeStep: PipelineStep; completedSteps: Set<number> } {
  const completed = new Set<number>();

  const datasetNode = nodes.find((n) => n.type === "dataset");
  const trainNode = nodes.find((n) => n.type === "train");
  const selectedDatasetId = (datasetNode?.data as { dataset_id?: string } | undefined)?.dataset_id;
  const selectedDataset = selectedDatasetId
    ? datasets.find((d) => d.dataset_id === selectedDatasetId)
    : undefined;
  const hasDataset = !!selectedDataset;
  const isPreprocessed = selectedDataset?.status === "preprocessed";
  const hasTrain = !!trainNode;
  const hasEdge =
    hasDataset &&
    hasTrain &&
    edges.some((e) => e.source === datasetNode?.id && e.target === trainNode?.id);
  const isRunning = pipelineStatus === "running" || taskStatus === "running";
  const hasResult = hasLatestVersion || taskStatus === "success";

  if (hasDataset) completed.add(0);
  if (isPreprocessed) completed.add(1);
  if (hasEdge) completed.add(2);
  if (hasResult) completed.add(3);

  let active: PipelineStep = 0;
  if (hasResult) active = 4;
  else if (isRunning) active = 3;
  else if (hasEdge) active = 3;
  else if (hasTrain || isPreprocessed) active = 2;
  else if (hasDataset) active = 1;

  return { activeStep: active, completedSteps: completed };
}
