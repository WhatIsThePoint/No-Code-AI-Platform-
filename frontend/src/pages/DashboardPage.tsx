import { Box, Card, CardContent, Grid, Typography, Chip } from "@mui/material";
import { useAuthStore } from "../store/authSlice";
import { useDatasets } from "../hooks/useDatasets";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { datasets } = useDatasets();

  const stats = {
    total: datasets.length,
    ready: datasets.filter((d) => d.status === "ready" || d.status === "preprocessed").length,
    processing: datasets.filter((d) =>
      ["uploaded", "profiling", "preprocessing"].includes(d.status)
    ).length,
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.full_name ?? user?.email}
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Total Datasets</Typography>
              <Typography variant="h3">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Ready</Typography>
              <Typography variant="h3" color="success.main">{stats.ready}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary">Processing</Typography>
              <Typography variant="h3" color="warning.main">{stats.processing}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Typography variant="h5" gutterBottom>
        Recent Datasets
      </Typography>
      {datasets.slice(0, 5).map((d) => (
        <Card key={d.dataset_id} sx={{ mb: 1 }}>
          <CardContent sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <Typography variant="body1">{d.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {d.source_type.toUpperCase()} · {d.row_count?.toLocaleString() ?? "?"} rows
              </Typography>
            </Box>
            <Chip
              label={d.status}
              color={
                d.status === "preprocessed" || d.status === "ready"
                  ? "success"
                  : d.status === "error"
                  ? "error"
                  : "default"
              }
              size="small"
            />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
