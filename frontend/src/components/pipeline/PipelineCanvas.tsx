import { useCallback, useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Drawer,
  LinearProgress,
  Snackbar,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";

import { DatasetNode } from "./nodes/DatasetNode";
import { TrainNode } from "./nodes/TrainNode";
import { EvaluateNode } from "./nodes/EvaluateNode";
import { NodePanel } from "./NodePanel";
import { defaultHyperparams } from "./HyperparamControls";
import { pipelinesApi } from "../../api/pipelines";
import { modelsApi } from "../../api/models";
import { useTaskStatus } from "../../hooks/useTaskStatus";
import type { Pipeline, PipelineNode } from "../../types/pipeline";
import type { Dataset } from "../../types/dataset";
import type { ModelVersion } from "../../types/model";

const NODE_TYPES = {
  dataset: DatasetNode,
  train: TrainNode,
  evaluate: EvaluateNode,
};

interface Props {
  pipeline: Pipeline;
  datasets: Dataset[];
  onSaved: (updated: Pipeline) => void;
}

function toFlowNodes(nodes: PipelineNode[]): Node[] {
  return nodes.map((n) => ({
    id: n.node_id,
    type: n.type,
    position: n.position,
    data: n.data,
  }));
}

function toFlowEdges(edges: Pipeline["edges"]): Edge[] {
  return edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    animated: true,
  }));
}

export function PipelineCanvas({ pipeline, datasets, onSaved }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toFlowNodes(pipeline.nodes));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toFlowEdges(pipeline.edges));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [trainTaskId, setTrainTaskId] = useState<string | null>(pipeline.last_run_task_id ?? null);
  const [latestVersion, setLatestVersion] = useState<ModelVersion | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>({
    open: false, msg: "", severity: "success",
  });

  const { result: taskResult } = useTaskStatus(trainTaskId);

  // When training finishes, fetch the latest model version
  useEffect(() => {
    if (taskResult?.status === "success" && taskResult.version_id) {
      modelsApi.getVersion(taskResult.version_id).then(({ data }) => {
        setLatestVersion(data);
        // Update evaluate node with version_id
        setNodes((prev) =>
          prev.map((n) =>
            n.type === "evaluate" ? { ...n, data: { ...n.data, version_id: data.version_id } } : n
          )
        );
      });
    }
  }, [taskResult?.status]);

  // Load latest version on mount if pipeline already has one
  useEffect(() => {
    if (pipeline.last_version_id && !latestVersion) {
      modelsApi.getVersion(pipeline.last_version_id).then(({ data }) => setLatestVersion(data)).catch(() => {});
    }
  }, [pipeline.last_version_id]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    []
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => setSelectedNodeId(null), []);

  const handleNodeDataUpdate = (nodeId: string, patch: Partial<PipelineNode["data"]>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    );
  };

  const addNode = (type: PipelineNode["type"]) => {
    const id = `node-${Date.now()}`;
    const defaultData =
      type === "train"
        ? { algorithm: "xgboost", task_type: "classification", hyperparams: defaultHyperparams("xgboost"), target_column: "" }
        : type === "dataset"
        ? { dataset_id: "", dataset_name: "" }
        : {};
    setNodes((prev) => [
      ...prev,
      { id, type, position: { x: 50 + prev.length * 200, y: 150 }, data: defaultData },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const pipelineNodes: PipelineNode[] = nodes.map((n) => ({
        node_id: n.id,
        type: n.type as PipelineNode["type"],
        data: n.data as PipelineNode["data"],
        position: n.position,
      }));
      const pipelineEdges = edges.map((e) => ({ source: e.source, target: e.target }));
      const { data } = await pipelinesApi.update(pipeline.pipeline_id, {
        nodes: pipelineNodes,
        edges: pipelineEdges,
      });
      onSaved(data);
      setSnack({ open: true, msg: "Pipeline saved", severity: "success" });
    } catch {
      setSnack({ open: true, msg: "Save failed", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    // Collect train node config
    const trainNode = nodes.find((n) => n.type === "train");
    const datasetNode = nodes.find((n) => n.type === "dataset");
    if (!trainNode || !datasetNode) {
      setSnack({ open: true, msg: "Add both a Dataset and Train node first", severity: "error" });
      return;
    }
    const td = trainNode.data as any;
    const dd = datasetNode.data as any;

    try {
      await handleSave();
      const { data } = await pipelinesApi.startTraining(pipeline.pipeline_id, {
        algorithm: td.algorithm,
        task_type: td.task_type,
        hyperparams: td.hyperparams ?? {},
        dataset_id: dd.dataset_id,
        target_column: td.target_column ?? "",
      });
      setTrainTaskId(data.task_id);
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.error ?? "Failed to start training", severity: "error" });
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const isRunning = pipeline.status === "running" || taskResult?.status === "running";
  const progress = taskResult?.progress_pct ?? 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar */}
      <Box sx={{ display: "flex", gap: 1, p: 1, borderBottom: 1, borderColor: "divider", alignItems: "center" }}>
        <Button size="small" startIcon={<AddIcon />} onClick={() => addNode("dataset")} variant="outlined">
          Dataset
        </Button>
        <Button size="small" startIcon={<AddIcon />} onClick={() => addNode("train")} variant="outlined">
          Train
        </Button>
        <Button size="small" startIcon={<AddIcon />} onClick={() => addNode("evaluate")} variant="outlined">
          Evaluate
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />} onClick={handleSave} disabled={saving}>
          Save
        </Button>
        <Button
          size="small"
          startIcon={isRunning ? <CircularProgress size={14} /> : <PlayArrowIcon />}
          variant="contained"
          onClick={handleRun}
          disabled={isRunning}
          color="success"
        >
          {isRunning ? "Running…" : "Run"}
        </Button>
      </Box>

      {/* Progress bar */}
      {isRunning && (
        <Box sx={{ px: 2, py: 0.5 }}>
          <Typography variant="caption">Training… {progress}%</Typography>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}
      {taskResult?.status === "failure" && (
        <Alert severity="error" sx={{ mx: 2, my: 0.5 }}>
          Training failed: {taskResult.error_message}
        </Alert>
      )}
      {taskResult?.status === "success" && (
        <Alert severity="success" sx={{ mx: 2, my: 0.5 }}>
          Training complete! Click the Evaluate node to see metrics.
        </Alert>
      )}

      {/* Canvas + side panel */}
      <Box sx={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <Box sx={{ flex: 1 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={NODE_TYPES}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </Box>

        {/* Side panel drawer */}
        <Drawer
          variant="persistent"
          anchor="right"
          open={!!selectedNode}
          PaperProps={{ sx: { width: 340, position: "relative", height: "100%" } }}
        >
          {selectedNode && (
            <NodePanel
              node={{
                node_id: selectedNode.id,
                type: selectedNode.type as PipelineNode["type"],
                data: selectedNode.data as PipelineNode["data"],
                position: selectedNode.position,
              }}
              pipelineId={pipeline.pipeline_id}
              datasets={datasets}
              latestVersion={latestVersion}
              onUpdate={handleNodeDataUpdate}
            />
          )}
        </Drawer>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
