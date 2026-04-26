import { Alert, AlertTitle, Box, Chip, Typography, alpha } from "@mui/material";
import FunctionsIcon from "@mui/icons-material/FunctionsRounded";
import type { ColumnProfile } from "../../types/dataset";

interface Props {
  skewedColumns: string[];
  columns: ColumnProfile[];
}

/**
 * Sprint 7 Module 2 — Surfaces a log-transform suggestion when the backend
 * flags one or more numeric columns as heavily skewed (|skew| ≥ 1.5 with
 * non-negative support). Renders nothing when the list is empty.
 */
export function SkewnessAlert({ skewedColumns, columns }: Props) {
  if (!skewedColumns || skewedColumns.length === 0) return null;

  const skewByName = new Map<string, number | undefined>();
  columns.forEach((c) => skewByName.set(c.name, c.skewness));

  const accent = "#a855f7";

  return (
    <Alert
      severity="info"
      icon={<FunctionsIcon />}
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
        {skewedColumns.length === 1
          ? `1 column is heavily skewed`
          : `${skewedColumns.length} columns are heavily skewed`}
      </AlertTitle>

      <Typography variant="body2" sx={{ mb: 1 }}>
        Add a <strong>Log Transform</strong> node in the pipeline so models that assume
        roughly symmetric features (linear/logistic regression, distance-based methods) get
        well-behaved inputs.
      </Typography>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        {skewedColumns.map((name) => {
          const skew = skewByName.get(name);
          return (
            <Chip
              key={name}
              label={skew !== undefined ? `${name} · skew ${skew.toFixed(2)}` : name}
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
          );
        })}
      </Box>
    </Alert>
  );
}
