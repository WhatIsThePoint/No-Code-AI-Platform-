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
  alpha,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrowRounded";
import SaveIcon from "@mui/icons-material/SaveRounded";
import StorageIcon from "@mui/icons-material/StorageRounded";
import ModelTrainingIcon from "@mui/icons-material/ModelTrainingRounded";
import AssessmentIcon from "@mui/icons-material/AssessmentRounded";
import ChatBubbleIcon from "@mui/icons-material/ChatBubbleOutlineRounded";

import { DatasetNode } from "./nodes/DatasetNode";
import { TrainNode } from "./nodes/TrainNode";
import { EvaluateNode } from "./nodes/EvaluateNode";
import { NodePanel } from "./NodePanel";
import { PipelineStepper, derivePipelineStep } from "./PipelineStepper";
import { PipelineTour } from "../onboarding/PipelineTour";
import { ChatDrawer } from "./ChatDrawer";
import { MeetingButton } from "./MeetingButton";
import { useAuthStore } from "../../store/authSlice";
import { defaultHyperparams } from "./HyperparamControls";
import { pipelinesApi } from "../../api/pipelines";
import { modelsApi } from "../../api/models";
import { useTaskStatus } from "../../hooks/useTaskStatus";
import type { Pipeline, PipelineNode, TrainNodeData, DatasetNodeData } from "../../types/pipeline";
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
  const [chatOpen, setChatOpen] = useState(false);
  const userTier = useAuthStore((s) => s.user?.tier);
  const isCompanyTier = userTier === "company" || userTier === "super_admin";

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
  }, [taskResult?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load latest version on mount if pipeline already has one
  useEffect(() => {
    if (pipeline.last_version_id && !latestVersion) {
      modelsApi.getVersion(pipeline.last_version_id).then(({ data }) => setLatestVersion(data)).catch(() => {});
    }
  }, [pipeline.last_version_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge({ ...connection, animated: true }, eds)),
    [] // eslint-disable-line react-hooks/exhaustive-deps
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
    const td = trainNode.data as TrainNodeData;
    const dd = datasetNode.data as DatasetNodeData;

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
    } catch {
      setSnack({ open: true, msg: "Failed to start training", severity: "error" });
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const isRunning = pipeline.status === "running" || taskResult?.status === "running";
  const progress = taskResult?.progress_pct ?? 0;

  const { activeStep, completedSteps } = derivePipelineStep({
    nodes,
    edges,
    datasets,
    pipelineStatus: pipeline.status,
    taskStatus: taskResult?.status,
    hasLatestVersion: !!latestVersion,
  });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PipelineTour shouldStart={pipeline.nodes.length === 0} />
      <PipelineStepper activeStep={activeStep} completedSteps={completedSteps} />
      {/* Toolbar */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: "divider",
          alignItems: "center",
          bgcolor: alpha("#f8fafc", 0.6),
          backdropFilter: "blur(8px)",
        }}
      >
        <Button
          data-tour="add-dataset"
          size="small"
          startIcon={<StorageIcon sx={{ fontSize: 15 }} />}
          onClick={() => addNode("dataset")}
          variant="outlined"
          sx={{ borderColor: alpha("#6366f1", 0.25), color: "#4f46e5", "&:hover": { borderColor: "#6366f1", bgcolor: alpha("#6366f1", 0.04) } }}
        >
          Dataset
        </Button>
        <Button
          data-tour="add-train"
          size="small"
          startIcon={<ModelTrainingIcon sx={{ fontSize: 15 }} />}
          onClick={() => addNode("train")}
          variant="outlined"
          sx={{ borderColor: alpha("#8b5cf6", 0.25), color: "#7c3aed", "&:hover": { borderColor: "#8b5cf6", bgcolor: alpha("#8b5cf6", 0.04) } }}
        >
          Train
        </Button>
        <Button
          data-tour="add-evaluate"
          size="small"
          startIcon={<AssessmentIcon sx={{ fontSize: 15 }} />}
          onClick={() => addNode("evaluate")}
          variant="outlined"
          sx={{ borderColor: alpha("#10b981", 0.25), color: "#059669", "&:hover": { borderColor: "#10b981", bgcolor: alpha("#10b981", 0.04) } }}
        >
          Evaluate
        </Button>
        <Box sx={{ flex: 1 }} />
        {isCompanyTier && (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ChatBubbleIcon sx={{ fontSize: 15 }} />}
              onClick={() => setChatOpen((o) => !o)}
              sx={{
                borderColor: alpha("#6366f1", 0.25),
                color: "#4f46e5",
                "&:hover": {
                  borderColor: "#6366f1",
                  bgcolor: alpha("#6366f1", 0.04),
                },
              }}
            >
              Chat
            </Button>
            <MeetingButton pipelineId={pipeline.pipeline_id} />
          </>
        )}
        <Button
          size="small"
          startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{ color: "text.secondary" }}
        >
          Save
        </Button>
        <Button
          data-tour="run-pipeline"
          size="small"
          startIcon={isRunning ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : <PlayArrowIcon />}
          variant="contained"
          onClick={handleRun}
          disabled={isRunning}
          sx={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            "&:hover": { background: "linear-gradient(135deg, #059669, #047857)" },
          }}
        >
          {isRunning ? "Running..." : "Run"}
        </Button>
      </Box>

      {/* Progress bar */}
      {isRunning && (
        <Box sx={{ px: 2.5, py: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "#8b5cf6" }}>Training... {progress}%</Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              mt: 0.5,
              height: 6,
              borderRadius: 3,
              bgcolor: alpha("#8b5cf6", 0.1),
              "& .MuiLinearProgress-bar": {
                borderRadius: 3,
                background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
              },
            }}
          />
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
          PaperProps={{
            sx: {
              width: 360,
              position: "relative",
              height: "100%",
              borderLeft: 1,
              borderColor: "divider",
              boxShadow: `-4px 0 24px -8px ${alpha("#0f172a", 0.06)}`,
            },
          }}
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

      {isCompanyTier && (
        <ChatDrawer
          pipelineId={pipeline.pipeline_id}
          open={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      )}
    </Box>
  );
}
