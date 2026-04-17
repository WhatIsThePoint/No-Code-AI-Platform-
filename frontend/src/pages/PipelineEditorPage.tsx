import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, Box, Chip, CircularProgress, IconButton, Tooltip, Typography, alpha } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBackRounded";
import AccountTreeIcon from "@mui/icons-material/AccountTreeRounded";
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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          px: 2.5,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: alpha("#f8fafc", 0.6),
          backdropFilter: "blur(8px)",
        }}
      >
        <Tooltip title="Back to pipelines">
          <IconButton
            size="small"
            onClick={() => navigate("/pipelines")}
            sx={{
              bgcolor: alpha("#6366f1", 0.08),
              "&:hover": { bgcolor: alpha("#6366f1", 0.15) },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "10px",
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AccountTreeIcon sx={{ fontSize: 18, color: "#fff" }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1.05rem" }}>{pipeline.name}</Typography>
        <Chip
          label={pipeline.status}
          size="small"
          sx={{
            fontSize: "0.65rem",
            height: 22,
            bgcolor: alpha("#8b5cf6", 0.08),
            color: "#7c3aed",
            fontWeight: 600,
          }}
        />
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
