import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Paper,
  Typography,
  alpha,
} from "@mui/material";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import ViewColumnIcon from "@mui/icons-material/ViewColumnRounded";
import ReportProblemIcon from "@mui/icons-material/ReportProblemRounded";
import ContentCopyIcon from "@mui/icons-material/ContentCopyRounded";
import type { ProfilingSummary, ColumnProfile } from "../../types/dataset";
import { CorrelationHeatmap } from "./CorrelationHeatmap";
import { DistributionChart } from "./DistributionChart";

interface Props {
  summary: ProfilingSummary;
  rowCount?: number;
}

const OVERVIEW_CARDS = [
  { key: "columns", label: "Columns", icon: ViewColumnIcon, gradient: "linear-gradient(135deg, #6366f1, #4f46e5)" },
  { key: "missing", label: "Overall Missing %", icon: ReportProblemIcon, gradient: "linear-gradient(135deg, #f59e0b, #d97706)" },
  { key: "duplicates", label: "Duplicate Rows", icon: ContentCopyIcon, gradient: "linear-gradient(135deg, #ef4444, #dc2626)" },
];

type InsightColor = "success" | "warning" | "error" | "default";

interface ColumnInsight {
  label: string;
  color: InsightColor;
}

const NUMERIC_HINTS = ["int", "float", "number", "double"];
const isNumericDtype = (dtype: string) =>
  NUMERIC_HINTS.some((h) => dtype.toLowerCase().includes(h));

function getColumnInsights(col: ColumnProfile, rowCount?: number): ColumnInsight[] {
  const insights: ColumnInsight[] = [];

  if (col.unique_count === 1) {
    insights.push({ label: "Constant column", color: "error" });
    return insights;
  }

  if (col.missing_pct > 50) {
    insights.push({ label: "Very high missing", color: "error" });
  } else if (col.missing_pct > 30) {
    insights.push({ label: "High missing", color: "warning" });
  }

  if (rowCount && col.unique_count === rowCount) {
    insights.push({ label: "Likely an ID", color: "default" });
    return insights;
  }

  if (!isNumericDtype(col.dtype) && col.unique_count > 50) {
    insights.push({ label: "High cardinality", color: "warning" });
  }

  if (!isNumericDtype(col.dtype) && col.unique_count >= 2 && col.unique_count <= 10) {
    insights.push({ label: "Good classification target", color: "success" });
  }

  if (isNumericDtype(col.dtype) && col.unique_count > 10 && col.missing_pct < 30) {
    insights.push({ label: "Possible regression target", color: "success" });
  }

  return insights;
}

const INSIGHT_STYLES: Record<InsightColor, { bg: string; fg: string }> = {
  success: { bg: alpha("#10b981", 0.12), fg: "#059669" },
  warning: { bg: alpha("#f59e0b", 0.12), fg: "#b45309" },
  error: { bg: alpha("#ef4444", 0.12), fg: "#b91c1c" },
  default: { bg: alpha("#64748b", 0.12), fg: "#475569" },
};

export function ProfilingReport({ summary, rowCount }: Props) {
  const overviewValues: Record<string, string | number> = {
    columns: summary.columns.length,
    missing: `${summary.total_missing_pct}%`,
    duplicates: summary.duplicate_rows,
  };

  return (
    <Box className="animate-fade-in">
      {/* Overview */}
      <Grid container spacing={2.5} sx={{ mb: 3 }} className="stagger-children">
        {OVERVIEW_CARDS.map(({ key, label, icon: Icon, gradient }) => (
          <Grid item xs={12} sm={4} key={key}>
            <Card>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: "10px",
                      background: gradient,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon sx={{ fontSize: 18, color: "#fff" }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500, lineHeight: 1 }}>{label}</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{overviewValues[key]}</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Missing values bar chart */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 4 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Missing Values by Column</Typography>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={summary.columns.map((c) => ({ name: c.name, missing: c.missing_pct }))}
            margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
          >
            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
            <YAxis unit="%" />
            <Tooltip formatter={(v) => `${v}%`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
            <Bar dataKey="missing" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {summary.correlation_matrix && (
        <CorrelationHeatmap
          matrix={summary.correlation_matrix}
          truncated={summary.correlation_truncated}
        />
      )}

      {/* Per-column cards */}
      <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Column Details</Typography>
      <Grid container spacing={2} className="stagger-children">
        {summary.columns.map((col) => (
          <Grid item xs={12} sm={6} md={4} key={col.name}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600 }}>{col.name}</Typography>
                  <Chip
                    label={col.dtype}
                    size="small"
                    sx={{
                      fontSize: "0.6rem",
                      height: 20,
                      bgcolor: alpha("#6366f1", 0.08),
                      color: "#4f46e5",
                      fontWeight: 600,
                    }}
                  />
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Missing: {col.missing_pct}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={col.missing_pct}
                  sx={{
                    mb: 1,
                    height: 5,
                    borderRadius: 3,
                    bgcolor: col.missing_pct > 20 ? alpha("#ef4444", 0.1) : alpha("#10b981", 0.1),
                    "& .MuiLinearProgress-bar": {
                      borderRadius: 3,
                      bgcolor: col.missing_pct > 20 ? "#ef4444" : "#10b981",
                    },
                  }}
                />

                {col.mean !== undefined && (
                  <Typography variant="caption" display="block" sx={{ color: "text.secondary" }}>
                    Mean: {col.mean?.toFixed(2)} · Std: {col.std?.toFixed(2)}
                  </Typography>
                )}
                <Typography variant="caption" display="block" sx={{ color: "text.secondary" }}>
                  Unique: {col.unique_count.toLocaleString()}
                </Typography>

                {col.histogram && isNumericDtype(col.dtype) && (
                  <DistributionChart histogram={col.histogram} />
                )}

                {(() => {
                  const insights = getColumnInsights(col, rowCount);
                  if (insights.length === 0) return null;
                  return (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                      {insights.map((ins) => {
                        const style = INSIGHT_STYLES[ins.color];
                        return (
                          <Chip
                            key={ins.label}
                            label={ins.label}
                            size="small"
                            sx={{
                              fontSize: "0.6rem",
                              height: 18,
                              bgcolor: style.bg,
                              color: style.fg,
                              fontWeight: 600,
                            }}
                          />
                        );
                      })}
                    </Box>
                  );
                })()}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
