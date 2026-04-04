import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, Box, CircularProgress, IconButton, Tooltip, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { pipelinesApi } from "../api/pipelines";
import { datasetsApi } from "../api/datasets";
import type { Pipeline } from "../types/pipeline";
import type { Dataset } from "../types/dataset";
import { PipelineCanvas } from "../components/pipeline/PipelineCanvas";

export function PipelineEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      pipelinesApi.get(id),
      datasetsApi.list({ limit: 100 }),
    ])
      .then(([pRes, dRes]) => {
        setPipeline(pRes.data);
        setDatasets(dRes.data.items);
      })
      .catch(() => setError("Failed to load pipeline"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !pipeline) {
    return <Alert severity="error">{error ?? "Pipeline not found"}</Alert>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Tooltip title="Back to pipelines">
          <IconButton size="small" onClick={() => navigate("/pipelines")}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Typography variant="h6" fontWeight={700}>{pipeline.name}</Typography>
      </Box>
      <Box sx={{ flex: 1, overflow: "hidden" }}>
        <PipelineCanvas
          pipeline={pipeline}
          datasets={datasets}
          onSaved={setPipeline}
        />
      </Box>
    </Box>
  );
}
