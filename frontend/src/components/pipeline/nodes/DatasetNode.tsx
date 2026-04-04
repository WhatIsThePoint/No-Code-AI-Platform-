import { Handle, Position } from "@xyflow/react";
import { Box, Chip, Typography } from "@mui/material";
import StorageIcon from "@mui/icons-material/Storage";
import type { NodeProps } from "@xyflow/react";

export function DatasetNode({ data, selected }: NodeProps) {
  const d = data as { dataset_name?: string; dataset_id?: string };
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: 2,
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: "background.paper",
        minWidth: 160,
        boxShadow: selected ? 4 : 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <StorageIcon fontSize="small" color="primary" />
        <Typography variant="caption" fontWeight={700} color="primary">
          DATASET
        </Typography>
      </Box>
      <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
        {d.dataset_name || d.dataset_id || "Select a dataset"}
      </Typography>
      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
