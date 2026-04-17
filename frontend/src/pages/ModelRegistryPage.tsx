import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Tab,
  Tabs,
  Typography,
  alpha,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import ModelTrainingIcon from "@mui/icons-material/ModelTrainingRounded";
import { useEffect, useState } from "react";
import { modelsApi } from "../api/models";
import { pipelinesApi } from "../api/pipelines";
import { MetricsChart } from "../components/pipeline/MetricsChart";
import type { ModelVersion } from "../types/model";
import type { Pipeline } from "../types/pipeline";

export function ModelRegistryPage() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [versions, setVersions] = useState<Record<string, ModelVersion[]>>({});
  const [activePipeline, setActivePipeline] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pipelinesApi.list().then(({ data }) => {
      const ps = data.items.filter((p) => p.status === "done" || p.last_version_id);
      setPipelines(ps);
      if (ps.length > 0) setActivePipeline(ps[0].pipeline_id);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!activePipeline || versions[activePipeline]) return;
    modelsApi.listVersions(activePipeline).then(({ data }) => {
      setVersions((prev) => ({ ...prev, [activePipeline]: data.items }));
    });
  }, [activePipeline]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (versionId: string, pipelineId: string) => {
    if (!confirm("Delete this model version?")) return;
    await modelsApi.deleteVersion(versionId);
    setVersions((prev) => ({
      ...prev,
      [pipelineId]: (prev[pipelineId] ?? []).filter((v) => v.version_id !== versionId),
    }));
  };

  const handleDownload = (versionId: string) => {
    modelsApi.downloadModel(versionId);
  };

  const currentVersions = activePipeline ? (versions[activePipeline] ?? []) : [];

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <ModelTrainingIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography variant="h4">Model Registry</Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>
      ) : pipelines.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            mt: 8,
            py: 6,
            px: 3,
            borderRadius: 4,
            border: "2px dashed",
            borderColor: "divider",
            bgcolor: alpha("#f8fafc", 0.5),
          }}
        >
          <ModelTrainingIcon sx={{ fontSize: 48, color: "text.secondary", mb: 1, opacity: 0.4 }} />
          <Typography variant="h6" sx={{ color: "text.secondary", mb: 0.5 }}>No trained models yet</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Run a pipeline to create model versions.
          </Typography>
        </Box>
      ) : (
        <>
          <Tabs
            value={activePipeline}
            onChange={(_, v) => setActivePipeline(v)}
            variant="scrollable"
            sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}
          >
            {pipelines.map((p) => (
              <Tab key={p.pipeline_id} label={p.name} value={p.pipeline_id} />
            ))}
          </Tabs>

          {currentVersions.length === 0 && activePipeline && !(versions[activePipeline]) ? (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}><CircularProgress size={24} /></Box>
          ) : currentVersions.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>No model versions for this pipeline yet.</Alert>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }} className="stagger-children">
              {currentVersions.map((v) => (
                <Card key={v.version_id}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                      <Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {v.algorithm.toUpperCase()}
                          </Typography>
                          <Chip
                            label={v.task_type}
                            size="small"
                            sx={{
                              fontSize: "0.65rem",
                              height: 22,
                              bgcolor: alpha("#8b5cf6", 0.08),
                              color: "#7c3aed",
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(v.created_at).toLocaleString()} · {v.training_duration_s}s training
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<DownloadIcon />}
                          variant="outlined"
                          onClick={() => handleDownload(v.version_id)}
                        >
                          Download .joblib
                        </Button>
                        <Button
                          size="small"
                          startIcon={<DeleteIcon />}
                          color="error"
                          onClick={() => handleDelete(v.version_id, v.pipeline_id)}
                          sx={{ "&:hover": { transform: "none" } }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 2.5 }} />
                    <MetricsChart metrics={v.metrics} taskType={v.task_type} />
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
