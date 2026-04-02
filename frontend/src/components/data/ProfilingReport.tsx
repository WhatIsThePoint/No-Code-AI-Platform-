import {
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Paper,
  Typography,
} from "@mui/material";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { ProfilingSummary } from "../../types/dataset";

interface Props {
  summary: ProfilingSummary;
}

export function ProfilingReport({ summary }: Props) {
  return (
    <Box>
      {/* Overview */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="caption">Columns</Typography>
              <Typography variant="h4">{summary.columns.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="caption">Overall Missing %</Typography>
              <Typography variant="h4">{summary.total_missing_pct}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" variant="caption">Duplicate Rows</Typography>
              <Typography variant="h4">{summary.duplicate_rows}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Missing values bar chart */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Missing Values by Column</Typography>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart
            data={summary.columns.map((c) => ({ name: c.name, missing: c.missing_pct }))}
            margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
          >
            <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
            <YAxis unit="%" />
            <Tooltip formatter={(v) => `${v}%`} />
            <Bar dataKey="missing" fill="#f44336" />
          </BarChart>
        </ResponsiveContainer>
      </Paper>

      {/* Per-column cards */}
      <Typography variant="h6" gutterBottom>Column Details</Typography>
      <Grid container spacing={2}>
        {summary.columns.map((col) => (
          <Grid item xs={12} sm={6} md={4} key={col.name}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="subtitle2" noWrap>{col.name}</Typography>
                  <Chip label={col.dtype} size="small" />
                </Box>

                <Typography variant="caption" color="text.secondary">
                  Missing: {col.missing_pct}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={col.missing_pct}
                  color={col.missing_pct > 20 ? "error" : "success"}
                  sx={{ mb: 1 }}
                />

                {col.mean !== undefined && (
                  <Typography variant="caption" display="block">
                    Mean: {col.mean?.toFixed(2)} · Std: {col.std?.toFixed(2)}
                  </Typography>
                )}
                <Typography variant="caption" display="block">
                  Unique: {col.unique_count.toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
