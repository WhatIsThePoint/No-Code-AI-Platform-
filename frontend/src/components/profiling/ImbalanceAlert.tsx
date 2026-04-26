import { Alert, AlertTitle, Box, Chip, Stack, Typography, alpha } from "@mui/material";
import BalanceIcon from "@mui/icons-material/BalanceRounded";
import type { TargetImbalance } from "../../types/dataset";

interface Props {
  imbalance: TargetImbalance;
  targetColumn: string;
}

export function ImbalanceAlert({ imbalance, targetColumn }: Props) {
  if (!imbalance.is_classification_like) return null;

  const severity: "warning" | "info" = imbalance.needs_balancing ? "warning" : "info";
  const accent = imbalance.needs_balancing ? "#f59e0b" : "#0ea5e9";

  return (
    <Alert
      severity={severity}
      icon={<BalanceIcon />}
      sx={{
        mb: 3,
        borderRadius: 3,
        border: 1,
        borderColor: alpha(accent, 0.35),
        bgcolor: alpha(accent, 0.06),
        "& .MuiAlert-icon": { color: accent },
      }}
    >
      <AlertTitle sx={{ fontWeight: 700 }}>
        {imbalance.needs_balancing
          ? `Target "${targetColumn}" is heavily imbalanced`
          : `Target "${targetColumn}" — class balance summary`}
      </AlertTitle>

      <Typography variant="body2" sx={{ mb: 1 }}>
        {imbalance.n_classes} classes · majority {imbalance.majority_pct.toFixed(1)}% · minority{" "}
        {imbalance.minority_pct.toFixed(1)}%.
        {imbalance.needs_balancing && (
          <>
            {" "}
            Add a <strong>SMOTE</strong> node in the pipeline to oversample minority classes
            before training, or pick a model robust to imbalance (e.g. tree ensembles with{" "}
            <code>class_weight=balanced</code>).
          </>
        )}
      </Typography>

      <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
        {imbalance.classes.map((cls) => (
          <Chip
            key={String(cls.label)}
            label={`${String(cls.label)} · ${cls.pct.toFixed(1)}%`}
            size="small"
            sx={{
              fontSize: "0.65rem",
              height: 22,
              bgcolor: "#fff",
              border: 1,
              borderColor: alpha(accent, 0.3),
              color: "#334155",
              fontWeight: 600,
            }}
          />
        ))}
      </Stack>

      {imbalance.classes.length < imbalance.n_classes && (
        <Box sx={{ mt: 0.75 }}>
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Showing top {imbalance.classes.length} of {imbalance.n_classes} classes.
          </Typography>
        </Box>
      )}
    </Alert>
  );
}
