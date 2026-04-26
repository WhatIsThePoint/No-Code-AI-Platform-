import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import DatasetRoundedIcon from "@mui/icons-material/DatasetRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import { datasetsApi } from "../../api/datasets";
import { useTaskStatus } from "../../hooks/useTaskStatus";

const DEMO_FILE = "/demo/customer_churn.csv";
const DEMO_DESCRIPTION =
  "Pre-cleaned Customer Churn dataset (100 rows). Target column: `churn` (binary). " +
  "Great for trying out the full pipeline: Upload → Profile → Preprocess → Train → Evaluate.";

interface Props {
  onDone?: () => void;
  variant?: "contained" | "outlined";
  size?: "small" | "medium";
}

export function DemoDatasetButton({ onDone, variant = "outlined", size = "medium" }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { result } = useTaskStatus(taskId);

  const handleLoad = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(DEMO_FILE);
      if (!res.ok) throw new Error(`Demo CSV not found (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], "customer_churn_demo.csv", { type: "text/csv" });
      const { data } = await datasetsApi.upload(file, { description: DEMO_DESCRIPTION });
      setTaskId(data.task_id);
    } catch (e: unknown) {
      const resp = (e as { response?: { status?: number; data?: { error?: string; limit?: string; max?: number } } }).response;
      if (resp?.status === 402) {
        const limit = resp.data?.limit;
        const max = resp.data?.max;
        setError(
          limit === "max_file_size_mb"
            ? `The demo file exceeds the ${max} MB limit for your plan.`
            : `You've reached the ${max} dataset limit on your plan.`
        );
      } else {
        setError((e as Error).message || "Failed to load demo dataset");
      }
    } finally {
      setLoading(false);
    }
  };

  const done = result?.status === "success" || result?.status === "failure";

  useEffect(() => {
    if (!done || !taskId) return;
    const t = setTimeout(() => {
      setTaskId(null);
      setOpen(false);
      onDone?.();
    }, 600);
    return () => clearTimeout(t);
  }, [done, taskId, onDone]);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        startIcon={<AutoAwesomeRoundedIcon />}
        onClick={() => setOpen(true)}
        sx={{
          borderColor: alpha("#8b5cf6", 0.4),
          color: "#7c3aed",
          fontWeight: 600,
          "&:hover": {
            borderColor: "#8b5cf6",
            bgcolor: alpha("#8b5cf6", 0.06),
          },
        }}
      >
        Load Demo Dataset
      </Button>

      <Dialog
        open={open}
        onClose={() => !loading && !taskId && setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
          <DatasetRoundedIcon sx={{ color: "#8b5cf6" }} />
          Customer Churn — Demo Dataset
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              A small, pre-cleaned sample of telecom customer records with a binary{" "}
              <strong>churn</strong> label. Perfect for a first end-to-end pipeline.
            </Typography>
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: alpha("#8b5cf6", 0.06),
                border: 1,
                borderColor: alpha("#8b5cf6", 0.2),
              }}
            >
              <Typography variant="caption" sx={{ color: "#6d28d9", fontWeight: 600, display: "block", mb: 0.5 }}>
                Dataset summary
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.8rem" }}>
                100 rows · 11 columns · Target: <strong>churn</strong> (binary)
                <br />
                Features: tenure, monthly_charges, contract type, payment method, support_calls…
              </Typography>
            </Box>
            {error && <Alert severity="error">{error}</Alert>}
            {taskId && result && !done && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                  {result.status === "pending" ? "Queued…" : "Profiling…"} {result.progress_pct}%
                </Typography>
                <LinearProgress variant="determinate" value={result.progress_pct} sx={{ mt: 0.5 }} />
              </Box>
            )}
            {done && result?.status === "success" && (
              <Alert severity="success">Demo dataset ready. Redirecting…</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={loading || !!taskId}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleLoad}
            disabled={loading || !!taskId}
            startIcon={<AutoAwesomeRoundedIcon />}
            sx={{
              background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              "&:hover": { background: "linear-gradient(135deg, #7c3aed, #6d28d9)" },
            }}
          >
            {loading ? "Loading…" : taskId ? "Profiling…" : "Load Demo"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
