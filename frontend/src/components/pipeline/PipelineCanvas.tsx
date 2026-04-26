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
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  alpha,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrowRounded";
import SaveIcon from "@mui/icons-material/SaveRounded";
import StorageIcon from "@mui/icons-material/StorageRounded";
import ModelTrainingIcon from "@mui/icons-material/ModelTrainingRounded";
import AssessmentIcon from "@mui/icons-material/AssessmentRounded";
import ChatBubbleIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";

import { DatasetNode } from "./nodes/DatasetNode";
import { TrainNode } from "./nodes/TrainNode";
import { EvaluateNode } from "./nodes/EvaluateNode";
import { DocumentNode } from "./nodes/DocumentNode";
import { VectorStoreNode } from "./nodes/VectorStoreNode";
import { RAGConfigNode } from "./nodes/RAGConfigNode";
import { NodePanel } from "./NodePanel";
import { PipelineStepper, derivePipelineStep } from "./PipelineStepper";
import { PipelineTour } from "../onboarding/PipelineTour";
import { GenAITour } from "../tour/GenAITour";
import { ChatInterface } from "./ChatInterface";
import { ChatDrawer } from "./ChatDrawer";
import { MeetingButton } from "./MeetingButton";
import { UpgradeLockBadge } from "../common/UpgradeLockBadge";
import { useAuthStore } from "../../store/authSlice";
import { useCompanionStore } from "../../store/companionSlice";
import { defaultHyperparams } from "./HyperparamControls";
import { pipelinesApi } from "../../api/pipelines";
import { modelsApi } from "../../api/models";
import { ragApi } from "../../api/rag";
import { useTaskStatus } from "../../hooks/useTaskStatus";
import type {
  Pipeline,
  PipelineNode,
  PipelineType,
  TrainNodeData,
  DatasetNodeData,
} from "../../types/pipeline";
import type { Dataset } from "../../types/dataset";
import type { ModelVersion } from "../../types/model";

const NODE_TYPES = {
  dataset: DatasetNode,
  train: TrainNode,
  evaluate: EvaluateNode,
  document: DocumentNode,
  vector_store: VectorStoreNode,
  rag_config: RAGConfigNode,
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
    data: n.data as unknown as Record<string, unknown>,
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
  const [canvasMode, setCanvasMode] = useState<PipelineType>(pipeline.type ?? "ml");
  const userTier = useAuthStore((s) => s.user?.tier);
  const isCompanyTier = userTier === "company" || userTier === "super_admin";
  const mergePipelineExtras = useCompanionStore((s) => s.mergePipelineExtras);
  const setRecentErrors = useCompanionStore((s) => s.setRecentErrors);

  const pushCompanionError = useCallback(
    (msg: string) => {
      const { recent_errors } = useCompanionStore.getState().context;
      const next = [msg, ...(recent_errors ?? [])].slice(0, 5);
      setRecentErrors(next);
    },
    [setRecentErrors],
  );

  // Publish canvas node summary + selection to the Companion so its answers
  // reference the actual graph the user has built, not just the pipeline name.
  useEffect(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) {
      const k = n.type ?? "unknown";
      counts[k] = (counts[k] ?? 0) + 1;
    }
    const node_summary = Object.entries(counts)
      .map(([t, c]) => `${t}×${c}`)
      .join(", ");
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    const selected_nodes = selectedNode
      ? [`${selectedNode.type ?? "node"}:${(selectedNode.data as { label?: string })?.label ?? selectedNode.id}`]
      : [];
    mergePipelineExtras({ node_summary, selected_nodes });
  }, [nodes, selectedNodeId, mergePipelineExtras]);

  // Poll RAG document statuses (for DocumentNode chunk-count badges).
  useEffect(() => {
    if (canvasMode !== "rag") return;
    let cancelled = false;
    const fetchDocs = async () => {
      try {
        const { data } = await ragApi.listDocuments(pipeline.pipeline_id);
        if (cancelled) return;
        setNodes((prev) =>
          prev.map((n) => {
            if (n.type !== "document") return n;
            const d = n.data as { document_id?: string };
            const match = data.items.find((it) => it.document_id === d.document_id);
            if (!match) return n;
            return {
              ...n,
              data: {
                ...n.data,
                source_name: match.source_name,
                status: match.status,
                chunk_count: match.chunk_count,
              },
            };
          })
        );
        // Update VectorStoreNode badge with total indexed chunks
        const total = data.items.reduce((acc, it) => acc + (it.chunk_count || 0), 0);
        setNodes((prev) =>
          prev.map((n) =>
            n.type === "vector_store" ? { ...n, data: { ...n.data, total_chunks: total } } : n
          )
        );
      } catch {
        /* swallow polling errors */
      }
    };
    fetchDocs();
    const handle = window.setInterval(fetchDocs, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [canvasMode, pipeline.pipeline_id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Re-stamp runtime-only props on every Document node whenever the pipeline
  // loads. `toFlowNodes` only brings serialized fields back from the server,
  // so without this step a reloaded DocumentNode has no `pipelineId` and its
  // upload handler early-returns silently.
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) =>
        n.type === "document"
          ? {
              ...n,
              data: {
                ...n.data,
                pipelineId: pipeline.pipeline_id,
                onIngestStart: handleDocumentIngestStart,
              },
            }
          : n
      )
    );
  }, [pipeline.pipeline_id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    let defaultData: Record<string, unknown> = {};
    if (type === "train") {
      defaultData = {
        algorithm: "xgboost",
        task_type: "classification",
        hyperparams: defaultHyperparams("xgboost"),
        target_column: "",
      };
    } else if (type === "dataset") {
      defaultData = { dataset_id: "", dataset_name: "" };
    } else if (type === "document") {
      // Pass pipelineId + ingest callback into node.data so DocumentNode can
      // upload directly. We stamp these on every render via the canvasMode effect.
      defaultData = {
        pipelineId: pipeline.pipeline_id,
        onIngestStart: handleDocumentIngestStart,
      };
    } else if (type === "rag_config") {
      defaultData = { llm_engine: "llama3.2:3b", top_k: 3 };
    } else if (type === "vector_store") {
      defaultData = { total_chunks: 0 };
    }
    setNodes((prev) => [
      ...prev,
      { id, type, position: { x: 50 + prev.length * 200, y: 150 }, data: defaultData },
    ]);
  };

  const handleDocumentIngestStart = (
    nodeId: string,
    _taskId: string,
    documentId: string,
    sourceName: string,
  ) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                document_id: documentId,
                source_name: sourceName,
                status: "queued",
              },
            }
          : n
      )
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const pipelineNodes: PipelineNode[] = nodes.map((n) => {
        // Strip runtime-only props (function callbacks, transient IDs) before
        // persisting — they aren't serializable and would bloat the payload.
        const rawData = n.data as Record<string, unknown>;
        const { pipelineId: _pid, onIngestStart: _ois, ...cleanData } = rawData;
        void _pid;
        void _ois;
        return {
          node_id: n.id,
          type: n.type as PipelineNode["type"],
          data: cleanData as PipelineNode["data"],
          position: n.position,
        };
      });
      const pipelineEdges = edges.map((e) => ({ source: e.source, target: e.target }));
      const { data } = await pipelinesApi.update(pipeline.pipeline_id, {
        nodes: pipelineNodes,
        edges: pipelineEdges,
        type: canvasMode,
      });
      onSaved(data);
      setSnack({ open: true, msg: "Pipeline saved", severity: "success" });
    } catch {
      setSnack({ open: true, msg: "Save failed", severity: "error" });
      pushCompanionError("Pipeline save failed");
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
      pushCompanionError("Tried to Run without both a Dataset and a Train node");
      return;
    }
    const td = trainNode.data as unknown as TrainNodeData;
    const dd = datasetNode.data as unknown as DatasetNodeData;

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
      pushCompanionError("Training failed to start (backend rejected the request)");
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
      {canvasMode === "ml" && (
        <PipelineTour shouldStart={pipeline.nodes.length === 0} />
      )}
      {canvasMode === "rag" && <GenAITour shouldStart={true} />}
      {canvasMode === "ml" && (
        <PipelineStepper activeStep={activeStep} completedSteps={completedSteps} />
      )}
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
          flexWrap: "wrap",
        }}
      >
        <ToggleButtonGroup
          size="small"
          exclusive
          value={canvasMode}
          onChange={(_, v) => v && setCanvasMode(v as PipelineType)}
          sx={{ mr: 1 }}
          data-tour="canvas-mode"
        >
          <ToggleButton value="ml" sx={{ textTransform: "none", fontWeight: 600 }}>
            <ScienceRoundedIcon sx={{ fontSize: 15, mr: 0.75 }} />
            Traditional ML
          </ToggleButton>
          <ToggleButton value="rag" sx={{ textTransform: "none", fontWeight: 600 }}>
            <SmartToyRoundedIcon sx={{ fontSize: 15, mr: 0.75 }} />
            Generative AI
          </ToggleButton>
        </ToggleButtonGroup>

        {canvasMode === "ml" && (
          <>
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
          </>
        )}

        {canvasMode === "rag" && (
          <>
            <Button
              data-tour="add-document"
              size="small"
              startIcon={<DescriptionRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("document")}
              variant="outlined"
              sx={{ borderColor: alpha("#0ea5e9", 0.3), color: "#0284c7", "&:hover": { borderColor: "#0ea5e9", bgcolor: alpha("#0ea5e9", 0.04) } }}
            >
              Document
            </Button>
            <Button
              data-tour="add-vector-store"
              size="small"
              startIcon={<StorageRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("vector_store")}
              variant="outlined"
              sx={{ borderColor: alpha("#a855f7", 0.3), color: "#7e22ce", "&:hover": { borderColor: "#a855f7", bgcolor: alpha("#a855f7", 0.04) } }}
            >
              Vector Store
            </Button>
            <Button
              data-tour="add-rag-config"
              size="small"
              startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("rag_config")}
              variant="outlined"
              sx={{ borderColor: alpha("#f59e0b", 0.3), color: "#d97706", "&:hover": { borderColor: "#f59e0b", bgcolor: alpha("#f59e0b", 0.04) } }}
            >
              RAG Config
            </Button>
          </>
        )}

        <Box sx={{ flex: 1 }} />
        {isCompanyTier ? (
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
        ) : (
          <>
            <UpgradeLockBadge
              label="Chat"
              icon={ChatBubbleIcon}
              featureTitle="Team chat for this pipeline"
              featureDescription="Stream messages with your teammates right next to the canvas — history is persisted so nobody misses context."
            />
            <UpgradeLockBadge
              label="Start Meet"
              featureTitle="One-click video meetings"
              featureDescription="Spin up a Google Meet tied to this pipeline and ping everyone on the team — links are broadcast live to collaborators."
            />
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
        {canvasMode === "ml" && (
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
        )}
      </Box>

      {/* Progress bar */}
      {canvasMode === "ml" && isRunning && (
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
      {canvasMode === "ml" && taskResult?.status === "failure" && (
        <Alert severity="error" sx={{ mx: 2, my: 0.5 }}>
          Training failed: {taskResult.error_message}
        </Alert>
      )}
      {canvasMode === "ml" && taskResult?.status === "success" && (
        <Alert severity="success" sx={{ mx: 2, my: 0.5 }}>
          Training complete! Click the Evaluate node to see metrics.
        </Alert>
      )}

      {/* Canvas + side panel (or RAG split: canvas on top, ChatInterface below) */}
      <Box
        sx={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          flexDirection: canvasMode === "rag" ? "column" : "row",
        }}
      >
        <Box sx={{ flex: 1, minHeight: canvasMode === "rag" ? 280 : undefined }}>
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

        {/* Side panel drawer — only for ML nodes (RAG nodes self-edit on the canvas) */}
        {canvasMode === "ml" && (
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
        )}

        {/* RAG mode: chat sits below the canvas as the live testing surface */}
        {canvasMode === "rag" && (
          <Box sx={{ flex: 1, minHeight: 380, p: 2 }}>
            <ChatInterface pipelineId={pipeline.pipeline_id} />
          </Box>
        )}
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
