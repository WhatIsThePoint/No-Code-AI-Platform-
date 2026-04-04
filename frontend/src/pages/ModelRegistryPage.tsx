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
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
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
  }, [activePipeline]);

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
      <Typography variant="h5" fontWeight={700} gutterBottom>Model Registry</Typography>

      {loading ? (
        <CircularProgress />
      ) : pipelines.length === 0 ? (
        <Alert severity="info">No trained models yet. Run a pipeline to create model versions.</Alert>
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
            <CircularProgress size={20} />
          ) : currentVersions.length === 0 ? (
            <Alert severity="info">No model versions for this pipeline yet.</Alert>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {currentVersions.map((v) => (
                <Card key={v.version_id} variant="outlined">
                  <CardContent>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                      <Box>
                        <Typography variant="h6">
                          {v.algorithm.toUpperCase()}
                          <Chip label={v.task_type} size="small" sx={{ ml: 1 }} />
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(v.created_at).toLocaleString()} · {v.training_duration_s}s
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
                        >
                          Delete
                        </Button>
                      </Box>
                    </Box>
                    <Divider sx={{ mb: 2 }} />
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
