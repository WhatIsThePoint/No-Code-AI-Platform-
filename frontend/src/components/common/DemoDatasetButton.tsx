import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Menu,
  MenuItem,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import DatasetRoundedIcon from "@mui/icons-material/DatasetRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ArrowDropDownRoundedIcon from "@mui/icons-material/ArrowDropDownRounded";
import { useTranslation } from "react-i18next";
import { datasetsApi } from "../../api/datasets";
import { useTaskStatus } from "../../hooks/useTaskStatus";

interface DemoSpec {
  id: string;
  i18nKey: "churn" | "iris" | "titanic";
  file: string;
  uploadName: string;
}

const DEMOS: DemoSpec[] = [
  { id: "churn", i18nKey: "churn", file: "/demo/customer_churn.csv", uploadName: "customer_churn_demo.csv" },
  { id: "iris", i18nKey: "iris", file: "/demo/iris.csv", uploadName: "iris_demo.csv" },
  { id: "titanic", i18nKey: "titanic", file: "/demo/titanic.csv", uploadName: "titanic_demo.csv" },
];

interface Props {
  onDone?: () => void;
  variant?: "contained" | "outlined";
  size?: "small" | "medium";
}

export function DemoDatasetButton({ onDone, variant = "outlined", size = "medium" }: Props) {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [active, setActive] = useState<DemoSpec | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const { result } = useTaskStatus(taskId);

  const handlePick = (spec: DemoSpec) => {
    setActive(spec);
    setOpen(true);
    setError(null);
    setTaskId(null);
    setMenuAnchor(null);
  };

  const handleLoad = async () => {
    if (!active) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(active.file);
      if (!res.ok) throw new Error(`Demo CSV not found (${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], active.uploadName, { type: "text/csv" });
      const description = t(`demoDatasets.${active.i18nKey}.description`);
      const { data } = await datasetsApi.upload(file, { description });
      setTaskId(data.task_id);
    } catch (e: unknown) {
      const resp = (e as { response?: { status?: number; data?: { error?: string; limit?: string; max?: number } } }).response;
      if (resp?.status === 402) {
        const limit = resp.data?.limit;
        const max = resp.data?.max;
        setError(
          limit === "max_file_size_mb"
            ? t("demoDatasets.errors.fileTooLarge", { max })
            : t("demoDatasets.errors.quotaReached", { max })
        );
      } else {
        setError((e as Error).message || t("demoDatasets.errors.loadFailed"));
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
      setActive(null);
      onDone?.();
    }, 600);
    return () => clearTimeout(t);
  }, [done, taskId, onDone]);

  return (
    <>
      <Button
        ref={buttonRef}
        variant={variant}
        size={size}
        startIcon={<AutoAwesomeRoundedIcon />}
        endIcon={<ArrowDropDownRoundedIcon />}
        onClick={(e) => setMenuAnchor(e.currentTarget)}
        aria-label={t("demoDatasets.menuAriaLabel")}
        sx={{
          borderColor: alpha("#8b5cf6", 0.4),
          color: "#7c3aed",
          fontWeight: 600,
          "&:hover": { borderColor: "#8b5cf6", bgcolor: alpha("#8b5cf6", 0.06) },
        }}
      >
        {t("demoDatasets.buttonLabel")}
      </Button>

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
        slotProps={{ paper: { sx: { mt: 0.5, minWidth: 280 } } }}
      >
        {DEMOS.map((spec) => (
          <MenuItem key={spec.id} onClick={() => handlePick(spec)} sx={{ py: 1.25 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {t(`demoDatasets.${spec.i18nKey}.title`)}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                {t(`demoDatasets.${spec.i18nKey}.summary`)}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      <Dialog
        open={open}
        onClose={() => !loading && !taskId && setOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 700 }}>
          <DatasetRoundedIcon sx={{ color: "#8b5cf6" }} />
          {active && t(`demoDatasets.${active.i18nKey}.title`)}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {active && (
              <>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {t(`demoDatasets.${active.i18nKey}.description`)}
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
                    {t("demoDatasets.summaryHeader")}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.8rem", whiteSpace: "pre-line" }}>
                    {t(`demoDatasets.${active.i18nKey}.specs`)}
                  </Typography>
                </Box>
              </>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {taskId && result && !done && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                  {result.status === "pending" ? t("demoDatasets.queued") : t("demoDatasets.profiling")}{" "}
                  {result.progress_pct}%
                </Typography>
                <LinearProgress variant="determinate" value={result.progress_pct} sx={{ mt: 0.5 }} />
              </Box>
            )}
            {done && result?.status === "success" && (
              <Alert severity="success">{t("demoDatasets.successRedirect")}</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpen(false)} disabled={loading || !!taskId}>
            {t("common.cancel")}
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
            {loading
              ? t("demoDatasets.loading")
              : taskId
              ? t("demoDatasets.profilingShort")
              : t("demoDatasets.loadButton")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
