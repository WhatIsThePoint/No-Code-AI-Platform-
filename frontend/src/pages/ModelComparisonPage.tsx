import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import ArrowBackIcon from "@mui/icons-material/ArrowBackRounded";
import CompareArrowsIcon from "@mui/icons-material/CompareArrowsRounded";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import api from "../api/axios";
import { modelsApi } from "../api/models";
import type { ModelVersion } from "../types/model";

interface CompareResult {
  task_type: string;
  versions: Array<Record<string, unknown>>;
  best_by_metric: Record<string, string | null>;
  metric_keys: string[];
}

const CHART_COLORS = ["#d2541c", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"];

export function ModelComparisonPage() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const navigate = useNavigate();
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [compareError, setCompareError] = useState("");

  useEffect(() => {
    if (!pipelineId) return;
    modelsApi
      .listVersions(pipelineId)
      .then((res) => setVersions(res.data.items))
      .catch(() => setFetchError("Failed to load models"));
  }, [pipelineId]);

  const toggle = (vid: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(vid) ? next.delete(vid) : next.add(vid);
      return next;
    });

  const handleCompare = async () => {
    if (selected.size < 2) return;
    setLoading(true);
    setCompareError("");
    setResult(null);
    try {
      const res = await api.post<CompareResult>("/models/compare", {
        version_ids: Array.from(selected),
      });
      setResult(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg === "feature_not_available") {
        setCompareError("Model comparison requires a Solo or Company plan. Please upgrade.");
      } else {
        setCompareError(msg || "Comparison failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const metricLabel = (k: string) => k.replace(/_/g, " ").toUpperCase();

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
            background: "linear-gradient(135deg, #d2541c, #a8401a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <CompareArrowsIcon sx={{ fontSize: 22 }} />
        </Box>
        <Typography variant="h4">Compare Models</Typography>
      </Box>

      {fetchError && <Alert severity="error" sx={{ mb: 2 }}>{fetchError}</Alert>}

      <Paper sx={{ mb: 3, borderRadius: 4, overflow: "hidden" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Algorithm</TableCell>
              <TableCell>Task Type</TableCell>
              <TableCell>Created</TableCell>
              <TableCell>Duration</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {versions.map((v) => (
              <TableRow
                key={v.version_id}
                hover
                selected={selected.has(v.version_id)}
                sx={{
                  cursor: "pointer",
                  "&.Mui-selected": { bgcolor: alpha("#d2541c", 0.06) },
                  "&.Mui-selected:hover": { bgcolor: alpha("#d2541c", 0.1) },
                }}
                onClick={() => toggle(v.version_id)}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selected.has(v.version_id)}
                    sx={{ "&.Mui-checked": { color: "#d2541c" } }}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={v.algorithm}
                    size="small"
                    sx={{ bgcolor: alpha("#8b5cf6", 0.08), color: "#7c3aed", fontWeight: 600, fontSize: "0.7rem" }}
                  />
                </TableCell>
                <TableCell>{v.task_type ?? v.framework ?? "—"}</TableCell>
                <TableCell>{new Date(v.created_at).toLocaleString()}</TableCell>
                <TableCell>{(v.training_duration_s ?? v.duration_s ?? 0).toFixed(1)}s</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Button
        variant="contained"
        disabled={selected.size < 2 || loading}
        onClick={handleCompare}
        sx={{ mb: 3 }}
      >
        {loading ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
        Compare {selected.size} Models
      </Button>

      {compareError && <Alert severity="error" sx={{ mb: 2 }}>{compareError}</Alert>}

      {result && (
        <Box className="animate-fade-in-up">
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 700 }}>Comparison Table</Typography>
          <Paper sx={{ mb: 3, overflowX: "auto", borderRadius: 4 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Algorithm</TableCell>
                  <TableCell>Duration</TableCell>
                  {result.metric_keys.map((k) => (
                    <TableCell key={k} align="right">{metricLabel(k)}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {result.versions.map((row) => (
                  <TableRow key={String(row.version_id)}>
                    <TableCell>
                      <Chip
                        label={String(row.algorithm)}
                        size="small"
                        sx={{ bgcolor: alpha("#d2541c", 0.08), color: "#a8401a", fontWeight: 600 }}
                      />
                    </TableCell>
                    <TableCell>
                      {row.training_duration_s != null
                        ? `${Number(row.training_duration_s).toFixed(1)}s`
                        : "\u2014"}
                    </TableCell>
                    {result.metric_keys.map((k) => {
                      const val = row[k];
                      const isBest = result.best_by_metric[k] === row.version_id;
                      return (
                        <TableCell key={k} align="right">
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 0.5 }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: isBest ? 700 : 400, color: isBest ? "#059669" : "text.primary" }}
                            >
                              {val != null ? Number(val).toFixed(4) : "\u2014"}
                            </Typography>
                            {isBest && (
                              <Tooltip title="Best">
                                <StarIcon sx={{ fontSize: 14, color: "#f59e0b" }} />
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          {result.metric_keys.length > 0 && (
            <Card>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Metric Comparison Chart</Typography>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart
                    data={result.metric_keys.map((k) => ({
                      metric: metricLabel(k),
                      ...Object.fromEntries(
                        result.versions.map((v) => [
                          String(v.algorithm),
                          v[k] != null ? Number(v[k]) : 0,
                        ])
                      ),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <RechartsTooltip
                      formatter={(v: number) => v.toFixed(4)}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
                    />
                    <Legend />
                    {result.versions.map((v, i) => (
                      <Bar
                        key={String(v.version_id)}
                        dataKey={String(v.algorithm)}
                        fill={CHART_COLORS[i % CHART_COLORS.length]}
                        radius={[4, 4, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
}
