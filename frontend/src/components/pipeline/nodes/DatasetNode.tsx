import { Handle, Position } from "@xyflow/react";
import { Box, Typography, alpha } from "@mui/material";
import StorageIcon from "@mui/icons-material/StorageRounded";
import type { NodeProps } from "@xyflow/react";
import { NodeBadge } from "./NodeBadge";
import { getValidationBorderColor, type NodeValidation } from "./validation";

export function DatasetNode({ data, selected }: NodeProps) {
  const d = data as { dataset_name?: string; dataset_id?: string; __validation?: NodeValidation };
  const validationBorder = getValidationBorderColor(d.__validation, "");
  return (
    <Box
      sx={{
        position: "relative",
        px: 2.5,
        py: 2,
        borderRadius: 3,
        border: 2,
        borderColor: validationBorder || (selected ? "#6366f1" : alpha("#6366f1", 0.2)),
        bgcolor: "#fff",
        minWidth: 180,
        boxShadow: selected
          ? `0 8px 25px -5px ${alpha("#6366f1", 0.3)}, 0 0 0 3px ${alpha("#6366f1", 0.1)}`
          : `0 2px 8px -2px ${alpha("#0f172a", 0.08)}`,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          borderColor: alpha("#6366f1", 0.5),
          boxShadow: `0 4px 16px -4px ${alpha("#6366f1", 0.25)}`,
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StorageIcon sx={{ fontSize: 16, color: "#fff" }} />
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "#6366f1", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.65rem" }}>
          Dataset
        </Typography>
      </Box>
      <Typography variant="body2" noWrap sx={{ maxWidth: 160, fontWeight: 500 }}>
        {d.dataset_name || d.dataset_id || "Select a dataset"}
      </Typography>
      <Handle type="source" position={Position.Right} />
      <NodeBadge validation={d.__validation} />
    </Box>
  );
}
