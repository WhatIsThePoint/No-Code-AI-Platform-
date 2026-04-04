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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import CompareIcon from "@mui/icons-material/Compare";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { modelsApi } from "../api/models";
import { MetricsChart } from "../components/pipeline/MetricsChart";
import type { ModelVersion } from "../types/model";
import type { ClassificationMetrics } from "../types/model";

export function ResultsPage() {
  const { versionId } = useParams<{ versionId: string }>();
  const navigate = useNavigate();
  const [version, setVersion] = useState<ModelVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!versionId) return;
    modelsApi
      .getVersion(versionId)
      .then((res) => setVersion(res.data))
      .catch(() => setError("Failed to load model version"))
      .finally(() => setLoading(false));
  }, [versionId]);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (error || !version) return <Typography color="error" sx={{ mt: 4 }}>{error || "Not found"}</Typography>;

  const metrics = version.metrics as unknown as Record<string, unknown>;

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
        Back
      </Button>

      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Typography variant="h4">Results</Typography>
        <Chip label={version.algorithm} color="primary" />
        <Chip label={version.task_type} variant="outlined" />
      </Box>

      <Grid container spacing={3}>
        {/* Summary card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Model Info
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="body2"><strong>Version ID:</strong> {version.version_id.slice(0, 8)}…</Typography>
              <Typography variant="body2"><strong>Algorithm:</strong> {version.algorithm}</Typography>
              <Typography variant="body2"><strong>Task Type:</strong> {version.task_type}</Typography>
              <Typography variant="body2">
                <strong>Training Time:</strong> {version.training_duration_s.toFixed(1)}s
              </Typography>
              <Typography variant="body2">
                <strong>Created:</strong> {new Date(version.created_at).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Hyperparameters
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {Object.entries(version.hyperparams).map(([k, v]) => (
                <Typography key={k} variant="body2">
                  <strong>{k}:</strong> {String(v)}
                </Typography>
              ))}
            </CardContent>
          </Card>

          <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => modelsApi.downloadModel(version.version_id)}
              size="small"
            >
              Download Model
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
        </Grid>

        {/* Metrics charts */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Metrics</Typography>
            <MetricsChart metrics={version.metrics} taskType={version.task_type} />
          </Paper>

          {/* Confusion matrix */}
          {"confusion_matrix" in metrics && Array.isArray(metrics.confusion_matrix) && (
            <Paper sx={{ p: 3, mt: 2 }}>
              <Typography variant="h6" gutterBottom>Confusion Matrix</Typography>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ width: "auto" }}>
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      {(metrics.confusion_matrix as number[][])[0].map((_, j) => (
                        <TableCell key={j} align="center"><strong>Pred {j}</strong></TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(metrics.confusion_matrix as number[][]).map((row, i) => (
                      <TableRow key={i}>
                        <TableCell><strong>Act {i}</strong></TableCell>
                        {row.map((val, j) => (
                          <TableCell
                            key={j}
                            align="center"
                            sx={{
                              bgcolor: i === j ? "success.light" : val > 0 ? "error.light" : "inherit",
                              fontWeight: i === j ? 700 : 400,
                            }}
                          >
                            {val}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            </Paper>
          )}

          {/* ROC AUC */}
          {"roc_auc" in metrics && metrics.roc_auc != null && (
            <Paper sx={{ p: 3, mt: 2 }}>
              <Typography variant="h6" gutterBottom>ROC-AUC</Typography>
              <Typography variant="h3" color="primary">
                {((version.metrics as unknown as ClassificationMetrics).roc_auc! * 100).toFixed(2)}%
              </Typography>
            </Paper>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
