import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import { usePipelineHistory } from "./usePipelineHistory";
import "@xyflow/react/dist/style.css";

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  LinearProgress,
  Menu,
  MenuItem,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
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
import AutoFixHighRoundedIcon from "@mui/icons-material/AutoFixHighRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import SmartToyRoundedIcon from "@mui/icons-material/SmartToyRounded";
import PsychologyRoundedIcon from "@mui/icons-material/PsychologyRounded";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LibraryAddRoundedIcon from "@mui/icons-material/LibraryAddRounded";
import MapRoundedIcon from "@mui/icons-material/MapRounded";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import RedoRoundedIcon from "@mui/icons-material/RedoRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";

import { DatasetNode } from "./nodes/DatasetNode";
import { TrainNode } from "./nodes/TrainNode";
import { EvaluateNode } from "./nodes/EvaluateNode";
import { DocumentNode } from "./nodes/DocumentNode";
import { VectorStoreNode } from "./nodes/VectorStoreNode";
import { RAGConfigNode } from "./nodes/RAGConfigNode";
import { ImageDatasetNode } from "./nodes/ImageDatasetNode";
import { CNNArchNode } from "./nodes/CNNArchNode";
import { DLTrainNode } from "./nodes/DLTrainNode";
import { validateNode } from "./nodes/validation";
import { autoLayoutNodes } from "../../lib/autoLayout";
import { createIdMinter, presetsForMode, type PipelinePreset } from "../../lib/pipelinePresets";
import { useNotifications } from "../../store/notificationsSlice";
import { NodePanel } from "./NodePanel";
import { PipelineStepper } from "./PipelineStepper";
import { derivePipelineStep } from "./derivePipelineStep";
import { PipelineTour } from "../onboarding/PipelineTour";
import { GenAITour } from "../tour/GenAITour";
import { ChatInterface } from "./ChatInterface";
import { ChatDrawer } from "./ChatDrawer";
import { MeetingButton } from "./MeetingButton";
import { DLPredictPanel } from "./DLPredictPanel";
import { UpgradeLockBadge } from "../common/UpgradeLockBadge";
import { useAuthStore } from "../../store/authSlice";
import { useCompanionStore } from "../../store/companionSlice";
import { defaultHyperparams } from "./HyperparamControls";
import { pipelinesApi } from "../../api/pipelines";
import { modelsApi } from "../../api/models";
import { ragApi } from "../../api/rag";
import { dlApi } from "../../api/dl";
import { useTaskStatus } from "../../hooks/useTaskStatus";
import type {
  Pipeline,
  PipelineNode,
  PipelineType,
  TrainNodeData,
  DatasetNodeData,
  ImageDatasetNodeData,
  CNNArchNodeData,
  DLTrainNodeData,
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
  image_dataset: ImageDatasetNode,
  cnn_arch: CNNArchNode,
  dl_train: DLTrainNode,
};

// Buckets used to lock the ML/RAG/DL mode toggle once the user has committed
// to one family. Switching modes mid-pipeline is intentionally blocked: the
// runtime shapes of the three graphs are incompatible (tabular training vs.
// vector index + chat vs. image classifier) and a partial mix would be
// unrunnable. The 3rd bucket lands in chat 6 alongside the canvas wiring.
const ML_NODE_TYPES = new Set(["dataset", "train", "evaluate"]);
const RAG_NODE_TYPES = new Set(["document", "vector_store", "rag_config"]);
const DL_NODE_TYPES = new Set(["image_dataset", "cnn_arch", "dl_train"]);

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

export function PipelineCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <PipelineCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function PipelineCanvasInner({ pipeline, datasets, onSaved }: Props) {
  const { t } = useTranslation();
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    onNodesChange,
    onEdgesChange,
    undo,
    redo,
    canUndo,
    canRedo,
  } = usePipelineHistory({
    initialNodes: toFlowNodes(pipeline.nodes),
    initialEdges: toFlowEdges(pipeline.edges),
  });
  const rf = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [trainTaskId, setTrainTaskId] = useState<string | null>(pipeline.last_run_task_id ?? null);
  const [latestVersion, setLatestVersion] = useState<ModelVersion | null>(null);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: "success" | "error" }>({
    open: false, msg: "", severity: "success",
  });
  const [chatOpen, setChatOpen] = useState(false);
  const [canvasMode, setCanvasMode] = useState<PipelineType>(pipeline.type ?? "ml");
  const [showMinimap, setShowMinimap] = useState(true);
  const [presetMenuAnchor, setPresetMenuAnchor] = useState<null | HTMLElement>(null);
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
    // Track previously-seen statuses so we only notify on transitions
    // (queued/running -> ready), not on every poll cycle.
    const lastStatus = new Map<string, string>();
    const fetchDocs = async () => {
      try {
        const { data } = await ragApi.listDocuments(pipeline.pipeline_id);
        if (cancelled) return;
        for (const item of data.items) {
          const prev = lastStatus.get(item.document_id);
          if (prev && prev !== "ready" && item.status === "ready") {
            useNotifications.getState().push({
              kind: "document_indexed",
              title: "Document indexed",
              body: `${item.source_name ?? "Document"} · ${item.chunk_count} chunks`,
              href: `/pipelines/${pipeline.pipeline_id}`,
              ref_id: pipeline.pipeline_id,
            });
          }
          lastStatus.set(item.document_id, item.status);
        }
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

  // Inject live validation into each node's `data` so individual node
  // components can render their own status badge without re-deriving the
  // graph context. Position/type are preserved unchanged so React Flow's
  // drag handling and node typing both still operate on the underlying
  // state managed by `useNodesState`.
  // Block tab switching once the canvas commits to a family — see ML_NODE_TYPES
  // / RAG_NODE_TYPES. A mode is "locked-in" the moment any node of its family
  // exists; until the user clears the canvas (or undoes back to empty) they
  // cannot switch to the other family.
  const hasMLNodes = useMemo(
    () => nodes.some((n) => n.type !== undefined && ML_NODE_TYPES.has(n.type)),
    [nodes],
  );
  const hasRAGNodes = useMemo(
    () => nodes.some((n) => n.type !== undefined && RAG_NODE_TYPES.has(n.type)),
    [nodes],
  );
  const hasDLNodes = useMemo(
    () => nodes.some((n) => n.type !== undefined && DL_NODE_TYPES.has(n.type)),
    [nodes],
  );
  const lockMode = hasMLNodes || hasRAGNodes || hasDLNodes;

  const decoratedNodes = useMemo<Node[]>(
    () =>
      nodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          __validation: validateNode(n, edges, nodes),
        },
      })),
    [nodes, edges],
  );

  // Cmd/Ctrl+Z = undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) = redo. We listen on
  // document because React Flow steals focus on canvas interactions and a
  // ref-bound listener wouldn't catch the keystroke after a click.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Don't hijack typing in inputs/textareas/contenteditable surfaces.
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        redo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const handleAutoLayout = useCallback(() => {
    if (nodes.length === 0) return;
    const arranged = autoLayoutNodes(nodes, edges, { direction: "LR" });
    setNodes(arranged);
    // Defer fitView until React Flow has measured the new positions on the
    // next frame; otherwise the viewport snaps to stale dimensions.
    requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 400 }));
  }, [nodes, edges, setNodes, rf]);

  const handleInsertPreset = useCallback(
    (preset: PipelinePreset) => {
      const mintId = createIdMinter();
      const built = preset.build(mintId, {
        pipelineId: pipeline.pipeline_id,
        onIngestStart: handleDocumentIngestStart,
      });
      // Append (never overwrite) — combine with existing graph and let dagre
      // sort the layout. Disconnected sub-graphs are stacked vertically by
      // autoLayoutNodes, so the new preset lives below whatever is already
      // on the canvas instead of overlapping it.
      const mergedNodes = [...nodes, ...built.nodes];
      const mergedEdges = [...edges, ...built.edges];
      const arranged = autoLayoutNodes(mergedNodes, mergedEdges, { direction: "LR" });
      setNodes(arranged);
      setEdges(mergedEdges);
      setPresetMenuAnchor(null);
      requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 400 }));
      setSnack({ open: true, msg: t("pipelineCanvas.presets.inserted"), severity: "success" });
    },
    // handleDocumentIngestStart is stable for the canvas instance — `setNodes`
    // and `setEdges` from useNodesState/useEdgesState are also stable.
    [nodes, edges, pipeline.pipeline_id, setNodes, setEdges, rf, t], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Toolbar delete button — drops the selected node and any incident edges.
  // Goes through `setNodes`/`setEdges` so usePipelineHistory snapshots first,
  // making the deletion undo-able.
  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setEdges((prev) => prev.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges]);

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
    } else if (type === "image_dataset") {
      defaultData = { dataset_id: "" };
    } else if (type === "cnn_arch") {
      // Defaults match the recommended starter for the demo budget — see
      // dlStarter preset (lib/pipelinePresets.ts) for the same values.
      defaultData = { arch: "tiny_resnet", pretrained: false, input_size: 64 };
    } else if (type === "dl_train") {
      defaultData = { epochs: 5, batch_size: 32, lr: 1e-3, optimizer: "adam", augment: false };
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
        // Strip runtime-only props (function callbacks, transient IDs,
        // derived validation) before persisting — they aren't serializable
        // and would bloat the payload.
        const rawData = n.data as Record<string, unknown>;
        const {
          pipelineId: _pid,
          onIngestStart: _ois,
          __validation: _val,
          ...cleanData
        } = rawData;
        void _pid;
        void _ois;
        void _val;
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
      setSnack({ open: true, msg: t("pipelineCanvas.status.saved"), severity: "success" });
    } catch {
      setSnack({ open: true, msg: t("pipelineCanvas.status.saveFailed"), severity: "error" });
      pushCompanionError("Pipeline save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    // DL mode runs through dl-training-service, which expects the merged
    // ImageDataset + CNNArch + DLTrain config flattened into a single
    // POST body. The route returns 400 with a structured estimate when a
    // tier's VRAM budget is exceeded; we surface that detail in the snack
    // bar rather than a generic "Run failed".
    if (canvasMode === "dl") {
      const imgNode = nodes.find((n) => n.type === "image_dataset");
      const archNode = nodes.find((n) => n.type === "cnn_arch");
      const trainNode = nodes.find((n) => n.type === "dl_train");
      if (!imgNode || !archNode || !trainNode) {
        setSnack({ open: true, msg: t("pipelineCanvas.status.missingDLNodes"), severity: "error" });
        pushCompanionError("DL run needs Image Dataset + CNN Arch + DL Train nodes");
        return;
      }
      const id = imgNode.data as unknown as ImageDatasetNodeData;
      const ar = archNode.data as unknown as CNNArchNodeData;
      const tr = trainNode.data as unknown as DLTrainNodeData;
      if (!id.dataset_id) {
        setSnack({ open: true, msg: t("pipelineCanvas.status.dlMissingDataset"), severity: "error" });
        return;
      }
      try {
        await handleSave();
        const { data } = await dlApi.startTraining({
          pipeline_id: pipeline.pipeline_id,
          dataset_id: id.dataset_id,
          arch: ar.arch ?? "tiny_resnet",
          pretrained: ar.pretrained ?? false,
          input_size: ar.input_size ?? 64,
          epochs: tr.epochs ?? 5,
          batch_size: tr.batch_size ?? 32,
          lr: tr.lr ?? 1e-3,
          optimizer: tr.optimizer ?? "adam",
          augment: tr.augment ?? false,
        });
        setTrainTaskId(data.task_id);
      } catch (err) {
        const e = err as { response?: { status?: number; data?: { detail?: string; error?: string } } };
        const detail = e.response?.data?.detail || e.response?.data?.error;
        const msg = detail
          ? `${t("pipelineCanvas.status.runFailed")}: ${detail}`
          : t("pipelineCanvas.status.runFailed");
        setSnack({ open: true, msg, severity: "error" });
        pushCompanionError(detail ?? "DL training failed to start");
      }
      return;
    }

    // ── ML path (unchanged) ────────────────────────────────────────────
    const trainNode = nodes.find((n) => n.type === "train");
    const datasetNode = nodes.find((n) => n.type === "dataset");
    if (!trainNode || !datasetNode) {
      setSnack({ open: true, msg: t("pipelineCanvas.status.missingNodes"), severity: "error" });
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
      setSnack({ open: true, msg: t("pipelineCanvas.status.runFailed"), severity: "error" });
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
        <Tooltip
          title={lockMode ? t("pipelineCanvas.mode.lockedHint") : ""}
          arrow
          disableHoverListener={!lockMode}
        >
          <ToggleButtonGroup
            size="small"
            exclusive
            value={canvasMode}
            onChange={(_, v) => v && setCanvasMode(v as PipelineType)}
            sx={{ mr: 1 }}
            data-tour="canvas-mode"
          >
            <ToggleButton
              value="ml"
              disabled={hasRAGNodes || hasDLNodes}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              <ScienceRoundedIcon sx={{ fontSize: 15, mr: 0.75 }} />
              {t("pipelineCanvas.mode.ml")}
            </ToggleButton>
            <ToggleButton
              value="rag"
              disabled={hasMLNodes || hasDLNodes}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              <SmartToyRoundedIcon sx={{ fontSize: 15, mr: 0.75 }} />
              {t("pipelineCanvas.mode.rag")}
            </ToggleButton>
            <ToggleButton
              value="dl"
              disabled={hasMLNodes || hasRAGNodes}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              <PsychologyRoundedIcon sx={{ fontSize: 15, mr: 0.75 }} />
              {t("pipelineCanvas.mode.dl")}
            </ToggleButton>
          </ToggleButtonGroup>
        </Tooltip>

        {canvasMode === "ml" && (
          <>
            <Button
              data-tour="add-dataset"
              size="small"
              startIcon={<StorageIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("dataset")}
              variant="outlined"
              sx={{ borderColor: alpha("#d2541c", 0.25), color: "#a8401a", "&:hover": { borderColor: "#d2541c", bgcolor: alpha("#d2541c", 0.04) } }}
            >
              {t("pipelineCanvas.addNode.dataset")}
            </Button>
            <Button
              data-tour="add-train"
              size="small"
              startIcon={<ModelTrainingIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("train")}
              variant="outlined"
              sx={{ borderColor: alpha("#8b5cf6", 0.25), color: "#7c3aed", "&:hover": { borderColor: "#8b5cf6", bgcolor: alpha("#8b5cf6", 0.04) } }}
            >
              {t("pipelineCanvas.addNode.train")}
            </Button>
            <Button
              data-tour="add-evaluate"
              size="small"
              startIcon={<AssessmentIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("evaluate")}
              variant="outlined"
              sx={{ borderColor: alpha("#10b981", 0.25), color: "#059669", "&:hover": { borderColor: "#10b981", bgcolor: alpha("#10b981", 0.04) } }}
            >
              {t("pipelineCanvas.addNode.evaluate")}
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
              {t("pipelineCanvas.addNode.document")}
            </Button>
            <Button
              data-tour="add-vector-store"
              size="small"
              startIcon={<StorageRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("vector_store")}
              variant="outlined"
              sx={{ borderColor: alpha("#a855f7", 0.3), color: "#7e22ce", "&:hover": { borderColor: "#a855f7", bgcolor: alpha("#a855f7", 0.04) } }}
            >
              {t("pipelineCanvas.addNode.vectorStore")}
            </Button>
            <Button
              data-tour="add-rag-config"
              size="small"
              startIcon={<AutoAwesomeRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("rag_config")}
              variant="outlined"
              sx={{ borderColor: alpha("#f59e0b", 0.3), color: "#d97706", "&:hover": { borderColor: "#f59e0b", bgcolor: alpha("#f59e0b", 0.04) } }}
            >
              {t("pipelineCanvas.addNode.ragConfig")}
            </Button>
          </>
        )}

        {canvasMode === "dl" && (
          <>
            <Button
              data-tour="add-image-dataset"
              size="small"
              startIcon={<ImageRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("image_dataset")}
              variant="outlined"
              sx={{ borderColor: alpha("#0ea5e9", 0.25), color: "#0284c7", "&:hover": { borderColor: "#0ea5e9", bgcolor: alpha("#0ea5e9", 0.04) } }}
            >
              {t("pipelineCanvas.addNode.imageDataset")}
            </Button>
            <Button
              data-tour="add-cnn-arch"
              size="small"
              startIcon={<HubRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("cnn_arch")}
              variant="outlined"
              sx={{ borderColor: alpha("#a855f7", 0.25), color: "#7e22ce", "&:hover": { borderColor: "#a855f7", bgcolor: alpha("#a855f7", 0.04) } }}
            >
              {t("pipelineCanvas.addNode.cnnArch")}
            </Button>
            <Button
              data-tour="add-dl-train"
              size="small"
              startIcon={<ModelTrainingIcon sx={{ fontSize: 15 }} />}
              onClick={() => addNode("dl_train")}
              variant="outlined"
              sx={{ borderColor: alpha("#10b981", 0.25), color: "#059669", "&:hover": { borderColor: "#10b981", bgcolor: alpha("#10b981", 0.04) } }}
            >
              {t("pipelineCanvas.addNode.dlTrain")}
            </Button>
          </>
        )}

        <Tooltip title={t("pipelineCanvas.actions.templatesAria")} arrow>
          <Button
            size="small"
            startIcon={<LibraryAddRoundedIcon sx={{ fontSize: 15 }} />}
            endIcon={<ArrowDropDownRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={(e) => setPresetMenuAnchor(e.currentTarget)}
            aria-label={t("pipelineCanvas.actions.templatesAria")}
            sx={{
              color: "#0284c7",
              borderColor: alpha("#0ea5e9", 0.3),
              "&:hover": { bgcolor: alpha("#0ea5e9", 0.06) },
            }}
            variant="outlined"
          >
            {t("pipelineCanvas.actions.templates")}
          </Button>
        </Tooltip>

        <Menu
          anchorEl={presetMenuAnchor}
          open={!!presetMenuAnchor}
          onClose={() => setPresetMenuAnchor(null)}
          slotProps={{ paper: { sx: { mt: 0.5, minWidth: 280 } } }}
        >
          {presetsForMode(canvasMode).map((preset) => (
            <MenuItem
              key={preset.id}
              onClick={() => handleInsertPreset(preset)}
              sx={{ py: 1.25, alignItems: "flex-start" }}
            >
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t(`pipelineCanvas.presets.${preset.i18nKey}.label`)}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ color: "text.secondary", display: "block", whiteSpace: "normal" }}
                >
                  {t(`pipelineCanvas.presets.${preset.i18nKey}.description`)}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Menu>

        <Tooltip title={t("pipelineCanvas.actions.undo")} arrow>
          <span>
            <IconButton
              size="small"
              onClick={undo}
              disabled={!canUndo}
              aria-label={t("pipelineCanvas.actions.undo")}
              sx={{ border: 1, borderColor: "divider", borderRadius: 1.5 }}
            >
              <UndoRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("pipelineCanvas.actions.redo")} arrow>
          <span>
            <IconButton
              size="small"
              onClick={redo}
              disabled={!canRedo}
              aria-label={t("pipelineCanvas.actions.redo")}
              sx={{ border: 1, borderColor: "divider", borderRadius: 1.5 }}
            >
              <RedoRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t("pipelineCanvas.actions.deleteNode")} arrow>
          <span>
            <IconButton
              size="small"
              onClick={handleDeleteSelected}
              disabled={!selectedNodeId}
              aria-label={t("pipelineCanvas.actions.deleteNode")}
              sx={{
                border: 1,
                borderColor: "divider",
                borderRadius: 1.5,
                color: selectedNodeId ? "#dc2626" : undefined,
              }}
            >
              <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={t("pipelineCanvas.actions.autoLayoutTooltip")} arrow>
          <span>
            <Button
              size="small"
              startIcon={<AutoFixHighRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={handleAutoLayout}
              disabled={nodes.length === 0}
              aria-label={t("pipelineCanvas.actions.autoLayoutAria")}
              sx={{
                color: "#7c3aed",
                borderColor: alpha("#8b5cf6", 0.25),
                "&:hover": { bgcolor: alpha("#8b5cf6", 0.06) },
              }}
              variant="outlined"
            >
              {t("pipelineCanvas.actions.autoLayout")}
            </Button>
          </span>
        </Tooltip>

        <Tooltip
          title={
            showMinimap
              ? t("pipelineCanvas.actions.minimapHide")
              : t("pipelineCanvas.actions.minimapShow")
          }
          arrow
        >
          <IconButton
            size="small"
            onClick={() => setShowMinimap((v) => !v)}
            aria-label={t("pipelineCanvas.actions.minimapAria")}
            aria-pressed={showMinimap}
            sx={{
              color: showMinimap ? "#0f172a" : "text.secondary",
              border: 1,
              borderColor: "divider",
              borderRadius: 1.5,
            }}
          >
            {showMinimap ? (
              <MapRoundedIcon sx={{ fontSize: 16 }} />
            ) : (
              <MapOutlinedIcon sx={{ fontSize: 16 }} />
            )}
          </IconButton>
        </Tooltip>

        <Box sx={{ flex: 1 }} />
        {isCompanyTier ? (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ChatBubbleIcon sx={{ fontSize: 15 }} />}
              onClick={() => setChatOpen((o) => !o)}
              sx={{
                borderColor: alpha("#d2541c", 0.25),
                color: "#a8401a",
                "&:hover": {
                  borderColor: "#d2541c",
                  bgcolor: alpha("#d2541c", 0.04),
                },
              }}
            >
              {t("pipelineCanvas.actions.chat")}
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
          {t("pipelineCanvas.actions.save")}
        </Button>
        {(canvasMode === "ml" || canvasMode === "dl") && (
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
            {isRunning ? t("pipelineCanvas.actions.running") : t("pipelineCanvas.actions.run")}
          </Button>
        )}
      </Box>

      {/* Progress bar */}
      {(canvasMode === "ml" || canvasMode === "dl") && isRunning && (
        <Box sx={{ px: 2.5, py: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "#8b5cf6" }}>
            {t("pipelineCanvas.progress.training", { pct: progress })}
          </Typography>
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
                background: "linear-gradient(90deg, #d2541c, #8b5cf6)",
              },
            }}
          />
        </Box>
      )}
      {(canvasMode === "ml" || canvasMode === "dl") && taskResult?.status === "failure" && (
        <Alert severity="error" sx={{ mx: 2, my: 0.5 }}>
          {t("pipelineCanvas.status.trainFailed", { error: taskResult.error_message })}
        </Alert>
      )}
      {(canvasMode === "ml" || canvasMode === "dl") && taskResult?.status === "success" && (
        <Alert severity="success" sx={{ mx: 2, my: 0.5 }}>
          {t("pipelineCanvas.status.trainSuccess")}
        </Alert>
      )}

      {/* DL "Try it" panel — only renders after a DL run produces a version.
          Sits above the canvas so the user sees inference as the natural
          next step from the success alert without scrolling. */}
      {canvasMode === "dl" && taskResult?.status === "success" && taskResult.version_id && (
        <Box sx={{ mx: 2, my: 1 }}>
          <DLPredictPanel
            versionId={taskResult.version_id}
            arch={(nodes.find((n) => n.type === "cnn_arch")?.data as CNNArchNodeData | undefined)?.arch}
          />
        </Box>
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
            nodes={decoratedNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            onPaneClick={handlePaneClick}
            nodeTypes={NODE_TYPES}
            // Accept both Delete (Windows/Linux) and Backspace (macOS muscle
            // memory) so users can drop unwanted/duplicate nodes from the
            // keyboard. React Flow already ignores these inside text inputs.
            deleteKeyCode={["Delete", "Backspace"]}
            fitView
          >
            <Background />
            <Controls />
            {showMinimap && <MiniMap />}
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
