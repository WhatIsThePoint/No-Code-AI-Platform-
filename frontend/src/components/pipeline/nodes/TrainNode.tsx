import { Handle, Position } from "@xyflow/react";
import { Box, Chip, Typography } from "@mui/material";
import ModelTrainingIcon from "@mui/icons-material/ModelTraining";
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
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: 2,
        borderColor: selected ? "secondary.main" : "divider",
        bgcolor: "background.paper",
        minWidth: 160,
        boxShadow: selected ? 4 : 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <ModelTrainingIcon fontSize="small" color="secondary" />
        <Typography variant="caption" fontWeight={700} color="secondary">
          TRAIN
        </Typography>
      </Box>
      <Typography variant="body2" fontWeight={600}>
        {ALGO_LABELS[d.algorithm ?? ""] ?? d.algorithm ?? "Select algorithm"}
      </Typography>
      {d.task_type && (
        <Chip label={d.task_type} size="small" sx={{ mt: 0.5, fontSize: 10 }} />
      )}
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
