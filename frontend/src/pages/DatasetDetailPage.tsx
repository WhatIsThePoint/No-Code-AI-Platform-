import {
  Box,
  Chip,
  Tab,
  Tabs,
  Typography,
  CircularProgress,
  Alert,
  alpha,
} from "@mui/material";
import StorageIcon from "@mui/icons-material/StorageRounded";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { datasetsApi } from "../api/datasets";
import type { Dataset } from "../types/dataset";
import { DatasetPreview } from "../components/data/DatasetPreview";
import { ProfilingReport } from "../components/data/ProfilingReport";
import { PreprocessingPanel } from "../components/data/PreprocessingPanel";
import { DataInsights } from "../components/data/DataInsights";

export function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!id) return;
    datasetsApi.get(id).then(({ data }) => {
      setDataset(data);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (!dataset) return <Alert severity="error">Dataset not found</Alert>;

  const isReady = dataset.status === "ready" || dataset.status === "preprocessed";

  const statusColor = dataset.status === "preprocessed" || dataset.status === "ready"
    ? "success" : dataset.status === "error" ? "error" : "default";

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "14px",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <StorageIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" noWrap>{dataset.name}</Typography>
        </Box>
        <Chip label={dataset.status} color={statusColor} />
      </Box>

      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3, ml: 7 }}>
        {dataset.source_type.toUpperCase()} · {dataset.row_count?.toLocaleString() ?? "?"} rows ·{" "}
        {dataset.column_count ?? "?"} columns
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Preview" disabled={!isReady} />
        <Tab label="Profile" disabled={!dataset.profiling_summary} />
        <Tab label="Insights" disabled={!dataset.profiling_summary} />
        <Tab label="Preprocessing" disabled={!isReady} />
      </Tabs>

      <Box className="animate-fade-in" key={tab}>
        {tab === 0 && isReady && <DatasetPreview datasetId={dataset.dataset_id} />}
        {tab === 1 && dataset.profiling_summary && (
          <ProfilingReport summary={dataset.profiling_summary} rowCount={dataset.row_count} />
        )}
        {tab === 2 && dataset.profiling_summary && (
          <DataInsights summary={dataset.profiling_summary} rowCount={dataset.row_count} />
        )}
        {tab === 3 && isReady && (
          <PreprocessingPanel
            dataset={dataset}
            onDone={(updatedDataset) => setDataset(updatedDataset)}
          />
        )}
      </Box>
    </Box>
  );
}
