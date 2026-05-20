import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Typography,
  alpha,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import CompareIcon from "@mui/icons-material/Compare";
import ArrowBackIcon from "@mui/icons-material/ArrowBackRounded";
import AssessmentIcon from "@mui/icons-material/AssessmentRounded";
import { modelsApi } from "../api/models";
import { pipelinesApi } from "../api/pipelines";
import { MetricsChart } from "../components/pipeline/MetricsChart";
import { ResidualPlot } from "../components/pipeline/ResidualPlot";
import { ConfusionMatrixHeatmap } from "../components/pipeline/ConfusionMatrixHeatmap";
import { ExportModelCard } from "../components/results/ExportModelCard";
import type {
  ClassificationMetrics,
  ModelMetrics,
  ModelVersion,
  RegressionMetrics,
  ResidualPoint,
} from "../types/model";
import type { Pipeline } from "../types/pipeline";

export function ResultsPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const [version, setVersion] = useState<ModelVersion | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!versionId) return;
    modelsApi
      .getVersion(versionId)
      .then((res) => {
        setVersion(res.data);
        return pipelinesApi.get(res.data.pipeline_id);
      })
      .then((p) => setPipeline(p.data))
      .catch(() => setError("Failed to load model version"))
      .finally(() => setLoading(false));
  }, [versionId]);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (error || !version) return <Typography color="error" sx={{ mt: 4 }}>{error || "Not found"}</Typography>;

  // `version.metrics` is now optional on the type because DL versions may
  // arrive before metrics are stamped. Treat absent metrics as empty so
  // downstream `"key" in metrics` checks are sound.
  const metrics = (version.metrics ?? {}) as unknown as Record<string, unknown>;

  return (
    <Box className="animate-fade-in">
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2, color: "text.secondary" }}
      >
        Back
      </Button>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <AssessmentIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography variant="h4">Results</Typography>
        <Chip
          label={version.algorithm ?? version.arch ?? "—"}
          sx={{
            fontWeight: 600,
            bgcolor: alpha("#d2541c", 0.1),
            color: "#a8401a",
          }}
        />
        <Chip label={version.task_type ?? version.framework ?? "—"} variant="outlined" />
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    bgcolor: alpha("#d2541c", 0.1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AssessmentIcon sx={{ fontSize: 15, color: "#d2541c" }} />
                </Box>
                <Typography variant="subtitle2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                  Model Info
                </Typography>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                <Typography variant="body2"><strong>Version ID:</strong> {version.version_id.slice(0, 8)}...</Typography>
                <Typography variant="body2">
                  <strong>{version.framework === "pytorch" ? "Architecture" : "Algorithm"}:</strong>{" "}
                  {version.algorithm ?? version.arch ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Task Type:</strong> {version.task_type ?? version.framework ?? "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>Training Time:</strong>{" "}
                  {(version.training_duration_s ?? version.duration_s ?? 0).toFixed(1)}s
                </Typography>
                <Typography variant="body2">
                  <strong>Created:</strong> {new Date(version.created_at).toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2.5 }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "8px",
                    bgcolor: alpha("#8b5cf6", 0.1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography sx={{ fontSize: 13, fontWeight: 800, color: "#8b5cf6" }}>H</Typography>
                </Box>
                <Typography variant="subtitle2" sx={{ color: "text.secondary", fontWeight: 600 }}>
                  Hyperparameters
                </Typography>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                {Object.entries(version.hyperparams ?? {}).map(([k, v]) => (
                  <Typography key={k} variant="body2">
                    <strong>{k}:</strong> {String(v)}
                  </Typography>
                ))}
              </Box>
            </CardContent>
          </Card>

          <Box sx={{ mt: 2.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => modelsApi.downloadModel(version.version_id)}
              size="small"
            >
              .joblib only
            </Button>
            <Button
              variant="outlined"
              startIcon={<CompareIcon />}
              onClick={() => navigate(`/pipelines/${version.pipeline_id}/compare`)}
              size="small"
            >
              Compare Models
            </Button>
          </Box>

          {pipeline && (
            <Box sx={{ mt: 2.5 }}>
              <ExportModelCard
                pipelineId={pipeline.pipeline_id}
                pipelineType={pipeline.type ?? "ml"}
                pipelineName={pipeline.name}
              />
            </Box>
          )}
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, borderRadius: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Metrics</Typography>
            {/* `metrics` is the (?? {}) narrowing above; cast through it so
                MetricsChart's tabular-only types remain happy on legacy rows. */}
            {version.task_type && version.metrics ? (
              <MetricsChart
                metrics={version.metrics as ModelMetrics}
                taskType={version.task_type}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Metrics aren't tabular for this version.
              </Typography>
            )}
          </Paper>

          {"confusion_matrix" in metrics && Array.isArray(metrics.confusion_matrix) && (
            <Box sx={{ mt: 2.5 }}>
              <ConfusionMatrixHeatmap
                matrix={metrics.confusion_matrix as number[][]}
              />
            </Box>
          )}

          {"residuals_sample" in metrics && Array.isArray(metrics.residuals_sample) && (metrics.residuals_sample as ResidualPoint[]).length > 0 && (
            <Paper sx={{ p: 3, mt: 2.5, borderRadius: 4 }}>
              <ResidualPlot points={(version.metrics as RegressionMetrics).residuals_sample!} />
            </Paper>
          )}

          {"roc_auc" in metrics && metrics.roc_auc != null && (
            <Paper sx={{ p: 3, mt: 2.5, borderRadius: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>ROC-AUC</Typography>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #d2541c, #8b5cf6)",
                  backgroundClip: "text",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                {((version.metrics as unknown as ClassificationMetrics).roc_auc! * 100).toFixed(2)}%
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
