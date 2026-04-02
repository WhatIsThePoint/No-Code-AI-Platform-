import {
  Box,
  Tab,
  Tabs,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { datasetsApi } from "../api/datasets";
import type { Dataset } from "../types/dataset";
import { DatasetPreview } from "../components/data/DatasetPreview";
import { ProfilingReport } from "../components/data/ProfilingReport";
import { PreprocessingPanel } from "../components/data/PreprocessingPanel";

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

  if (loading) return <CircularProgress />;
  if (!dataset) return <Alert severity="error">Dataset not found</Alert>;

  const isReady = dataset.status === "ready" || dataset.status === "preprocessed";

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {dataset.name}
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {dataset.source_type.toUpperCase()} · {dataset.row_count?.toLocaleString() ?? "?"} rows ·{" "}
        {dataset.column_count ?? "?"} columns · Status: {dataset.status}
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Preview" disabled={!isReady} />
        <Tab label="Profile" disabled={!dataset.profiling_summary} />
        <Tab label="Preprocessing" disabled={!isReady} />
      </Tabs>

      {tab === 0 && isReady && <DatasetPreview datasetId={dataset.dataset_id} />}
      {tab === 1 && dataset.profiling_summary && (
        <ProfilingReport summary={dataset.profiling_summary} />
      )}
      {tab === 2 && isReady && (
        <PreprocessingPanel
          dataset={dataset}
          onDone={(updatedDataset) => setDataset(updatedDataset)}
        />
      )}
    </Box>
  );
}
