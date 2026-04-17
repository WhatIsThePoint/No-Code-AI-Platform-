import { Handle, Position } from "@xyflow/react";
import { Box, Chip, Typography, alpha } from "@mui/material";
import ModelTrainingIcon from "@mui/icons-material/ModelTrainingRounded";
import type { NodeProps } from "@xyflow/react";

const ALGO_LABELS: Record<string, string> = {
  xgboost: "XGBoost",
  random_forest: "Random Forest",
  gbm: "GBM",
  glm: "Logistic (GLM)",
  lightgbm: "LightGBM",
  catboost: "CatBoost",
  kmeans: "K-Means",
  prophet: "Prophet",
};

export function TrainNode({ data, selected }: NodeProps) {
  const d = data as { algorithm?: string; task_type?: string };
  return (
    <Box
      sx={{
        px: 2.5,
        py: 2,
        borderRadius: 3,
        border: 2,
        borderColor: selected ? "#8b5cf6" : alpha("#8b5cf6", 0.2),
        bgcolor: "#fff",
        minWidth: 180,
        boxShadow: selected
          ? `0 8px 25px -5px ${alpha("#8b5cf6", 0.3)}, 0 0 0 3px ${alpha("#8b5cf6", 0.1)}`
          : `0 2px 8px -2px ${alpha("#0f172a", 0.08)}`,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          borderColor: alpha("#8b5cf6", 0.5),
          boxShadow: `0 4px 16px -4px ${alpha("#8b5cf6", 0.25)}`,
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModelTrainingIcon sx={{ fontSize: 16, color: "#fff" }} />
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "#8b5cf6", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.65rem" }}>
          Train
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {ALGO_LABELS[d.algorithm ?? ""] ?? d.algorithm ?? "Select algorithm"}
      </Typography>
      {d.task_type && (
        <Chip label={d.task_type} size="small" sx={{ mt: 0.75, fontSize: "0.65rem", height: 22, bgcolor: alpha("#8b5cf6", 0.08), color: "#7c3aed" }} />
      )}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
