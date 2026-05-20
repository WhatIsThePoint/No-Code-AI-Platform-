import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBackRounded";
import AccountTreeIcon from "@mui/icons-material/AccountTreeRounded";
import CloudDownloadIcon from "@mui/icons-material/CloudDownloadRounded";
import CloseIcon from "@mui/icons-material/CloseRounded";
import { pipelinesApi } from "../api/pipelines";
import { datasetsApi } from "../api/datasets";
import { projectsApi } from "../api/projects";
import { useAuthStore } from "../store/authSlice";
import type { Pipeline } from "../types/pipeline";
import type { Dataset } from "../types/dataset";
import { PipelineCanvas } from "../components/pipeline/PipelineCanvas";
import { ManageAccessTab } from "../components/ManageAccessTab";
import { ExportModelCard } from "../components/results/ExportModelCard";
import { LiveTrainingChart } from "../components/pipeline/LiveTrainingChart";
import { useReportCompanionContext } from "../components/companion/useCompanionContext";

export function PipelineEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"canvas" | "access">("canvas");
  const [canManage, setCanManage] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      pipelinesApi.get(id),
      datasetsApi.list({ limit: 100 }),
    ])
      .then(([pRes, dRes]) => {
        setPipeline(pRes.data);
        setDatasets(dRes.data.items);
      })
      .catch(() => setError("Failed to load pipeline"))
      .finally(() => setLoading(false));
  }, [id]);

  // Decide whether to show the Manage Access tab. Owner of the pipeline,
  // super_admin, or any user listed as admin in project_members can see it.
  useEffect(() => {
    if (!pipeline || !user) return;
    if (user.role === "super_admin" || pipeline.user_id === user.id) {
      setCanManage(pipeline.owner_type === "company" || !!pipeline.company_id);
      return;
    }
    if (!pipeline.company_id) return;
    projectsApi
      .listMembers(pipeline.pipeline_id)
      .then((r) => {
        const me = r.data.members.find((m) => m.user_id === user.id);
        setCanManage(me?.role === "admin");
      })
      .catch(() => setCanManage(false));
  }, [pipeline, user]);

  useReportCompanionContext({
    active_view: "PipelineEditorPage",
    pipeline: pipeline
      ? { name: pipeline.name, type: pipeline.type, status: pipeline.status }
      : null,
  });

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !pipeline) {
    return <Alert severity="error">{error ?? "Pipeline not found"}</Alert>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: alpha("#f8fafc", 0.6),
          backdropFilter: "blur(8px)",
        }}
      >
        <Tooltip title="Back to pipelines">
          <IconButton
            size="small"
            onClick={() => navigate("/pipelines")}
            aria-label="Back to pipelines"
            sx={{
              bgcolor: alpha("#d2541c", 0.08),
              "&:hover": { bgcolor: alpha("#d2541c", 0.15) },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "10px",
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AccountTreeIcon sx={{ fontSize: 18, color: "#fff" }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem" }}>{pipeline.name}</Typography>
        <Chip
          label={pipeline.status}
          size="small"
          sx={{
            fontSize: "0.65rem",
            height: 22,
            bgcolor: alpha("#8b5cf6", 0.08),
            color: "#7c3aed",
            fontWeight: 600,
          }}
        />
        {pipeline.owner_type === "company" && (
          <Chip
            label="Company"
            size="small"
            sx={{
              fontSize: "0.65rem",
              height: 22,
              bgcolor: alpha("#10b981", 0.08),
              color: "#059669",
              fontWeight: 600,
            }}
          />
        )}
        <Box sx={{ flex: 1 }} />
        {(pipeline.type === "rag" || pipeline.last_version_id) && (
          <Tooltip
            title={
              pipeline.type === "rag"
                ? "Download Ollama Modelfile + RAG bundle"
                : "Download trained model bundle"
            }
          >
            <Button
              variant="outlined"
              size="small"
              startIcon={<CloudDownloadIcon sx={{ fontSize: 16 }} />}
              onClick={() => setExportOpen(true)}
              sx={{
                fontSize: "0.75rem",
                fontWeight: 600,
                borderColor: alpha(pipeline.type === "rag" ? "#8b5cf6" : "#10b981", 0.4),
                color: pipeline.type === "rag" ? "#7c3aed" : "#059669",
                "&:hover": {
                  borderColor: pipeline.type === "rag" ? "#7c3aed" : "#059669",
                  bgcolor: alpha(pipeline.type === "rag" ? "#8b5cf6" : "#10b981", 0.05),
                },
              }}
            >
              Export
            </Button>
          </Tooltip>
        )}
        {canManage && (
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{ minHeight: 32, "& .MuiTab-root": { minHeight: 32, py: 0 } }}
          >
            <Tab value="canvas" label="Canvas" />
            <Tab value="access" label="Manage Access" />
          </Tabs>
        )}
      </Box>

      <Dialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, pb: 1 }}>
          <CloudDownloadIcon sx={{ color: pipeline.type === "rag" ? "#7c3aed" : "#059669" }} />
          <Box sx={{ flex: 1, fontWeight: 700 }}>Export pipeline</Box>
          <IconButton size="small" onClick={() => setExportOpen(false)} aria-label="Close export dialog">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <ExportModelCard
            pipelineId={pipeline.pipeline_id}
            pipelineType={pipeline.type ?? "ml"}
            pipelineName={pipeline.name}
          />
        </DialogContent>
      </Dialog>
      {pipeline.type !== "rag" && pipeline.status === "running" && (
        <Box sx={{ px: 2.5, pt: 2 }}>
          <LiveTrainingChart pipelineId={pipeline.pipeline_id} />
        </Box>
      )}

      <Box sx={{ flex: 1, overflow: "hidden" }}>
        {tab === "canvas" ? (
          <PipelineCanvas
            pipeline={pipeline}
            datasets={datasets}
            onSaved={setPipeline}
          />
        ) : (
          <Box sx={{ height: "100%", overflow: "auto" }}>
            <ManageAccessTab pipeline={pipeline} />
          </Box>
        )}
      </Box>
    </Box>
  );
}
