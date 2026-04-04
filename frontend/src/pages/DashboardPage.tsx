import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Snackbar,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DeleteIcon from "@mui/icons-material/Delete";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AnnouncementIcon from "@mui/icons-material/Announcement";
import { useAuthStore } from "../store/authSlice";
import { useDatasets } from "../hooks/useDatasets";
import { datasetsApi } from "../api/datasets";
import { pipelinesApi } from "../api/pipelines";
import { billingApi } from "../api/billing";
import type { Pipeline } from "../types/pipeline";
import type { Dataset } from "../types/dataset";
import type { Announcement } from "../types/billing";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { datasets, refetch: refetchDatasets } = useDatasets();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tab, setTab] = useState(0);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: "" });

  useEffect(() => {
    setPipelineLoading(true);
    pipelinesApi.list().then((r) => setPipelines(r.data.items)).finally(() => setPipelineLoading(false));
    billingApi.getAnnouncements().then((r) => setAnnouncements(r.data)).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = {
    datasets: datasets.length,
    pipelines: pipelines.length,
    ready: datasets.filter((d) => d.status === "ready" || d.status === "preprocessed").length,
    trained: pipelines.filter((p) => p.status === "done").length,
  };

  const handleDeleteDataset = async (id: string) => {
    try {
      await datasetsApi.delete(id);
      refetchDatasets();
      setSnack({ open: true, msg: "Dataset deleted" });
    } catch {
      setSnack({ open: true, msg: "Delete failed" });
    }
  };

  const handleDeletePipeline = async (id: string) => {
    try {
      await pipelinesApi.delete(id);
      setPipelines((prev) => prev.filter((p) => p.pipeline_id !== id));
      setSnack({ open: true, msg: "Pipeline deleted" });
    } catch {
      setSnack({ open: true, msg: "Delete failed" });
    }
  };

  const handleDuplicatePipeline = async (pipeline: Pipeline) => {
    try {
      const res = await pipelinesApi.create({
        name: `${pipeline.name} (copy)`,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
      });
      setPipelines((prev) => [res.data as unknown as Pipeline, ...prev]);
      setSnack({ open: true, msg: "Pipeline duplicated" });
    } catch {
      setSnack({ open: true, msg: "Duplicate failed" });
    }
  };

  return (
    <Box>
      {/* Announcements banner */}
      {announcements.map((a) => (
        <Alert key={a.id} icon={<AnnouncementIcon />} severity="info" sx={{ mb: 2 }}>
          <strong>{a.title}</strong> — {a.body}
        </Alert>
      ))}

      <Typography variant="h4" gutterBottom>
        Welcome, {user?.full_name ?? user?.email}
      </Typography>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {[
          { label: "Datasets", value: stats.datasets, color: undefined },
          { label: "Ready", value: stats.ready, color: "success.main" },
          { label: "Pipelines", value: stats.pipelines, color: undefined },
          { label: "Trained", value: stats.trained, color: "primary.main" },
        ].map(({ label, value, color }) => (
          <Grid item xs={6} sm={3} key={label}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" variant="body2">{label}</Typography>
                <Typography variant="h3" color={color}>{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Datasets (${datasets.length})`} />
        <Tab label={`Pipelines (${pipelines.length})`} />
      </Tabs>

      {/* Datasets tab */}
      {tab === 0 && (
        <Box>
          <Button
            variant="contained"
            size="small"
            sx={{ mb: 2 }}
            onClick={() => navigate("/data")}
          >
            + New Dataset
          </Button>
          <Grid container spacing={2}>
            {datasets.map((d: Dataset) => (
              <Grid item xs={12} sm={6} md={4} key={d.dataset_id}>
                <Card variant="outlined">
                  <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Typography variant="subtitle1" noWrap title={d.name}>{d.name}</Typography>
                      <Chip
                        label={d.status}
                        size="small"
                        color={d.status === "preprocessed" || d.status === "ready" ? "success" : d.status === "error" ? "error" : "default"}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {d.source_type.toUpperCase()} · {d.row_count?.toLocaleString() ?? "?"} rows
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {new Date(d.created_at).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Tooltip title="Open">
                      <IconButton size="small" onClick={() => navigate(`/data/${d.dataset_id}`)}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDeleteDataset(d.dataset_id)}>
                        <DeleteIcon fontSize="small" color="error" />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Pipelines tab */}
      {tab === 1 && (
        <Box>
          <Button
            variant="contained"
            size="small"
            sx={{ mb: 2 }}
            onClick={() => navigate("/pipelines")}
          >
            + New Pipeline
          </Button>
          {pipelineLoading ? (
            <CircularProgress />
          ) : (
            <Grid container spacing={2}>
              {pipelines.map((p: Pipeline) => (
                <Grid item xs={12} sm={6} md={4} key={p.pipeline_id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <Typography variant="subtitle1" noWrap title={p.name}>{p.name}</Typography>
                        <Chip
                          label={p.status}
                          size="small"
                          color={p.status === "done" ? "success" : p.status === "error" ? "error" : p.status === "running" ? "warning" : "default"}
                        />
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {p.nodes.length} nodes
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {new Date(p.updated_at).toLocaleDateString()}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Tooltip title="Open">
                        <IconButton size="small" onClick={() => navigate(`/pipelines/${p.pipeline_id}`)}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicate">
                        <IconButton size="small" onClick={() => handleDuplicatePipeline(p)}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDeletePipeline(p.pipeline_id)}>
                          <DeleteIcon fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        message={snack.msg}
      />
    </Box>
  );
}
