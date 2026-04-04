import { Handle, Position } from "@xyflow/react";
import { Box, Typography } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import type { NodeProps } from "@xyflow/react";

export function EvaluateNode({ data, selected }: NodeProps) {
  const d = data as { version_id?: string };
  return (
    <Box
      sx={{
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: 2,
        borderColor: selected ? "success.main" : "divider",
        bgcolor: "background.paper",
        minWidth: 160,
        boxShadow: selected ? 4 : 1,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <AssessmentIcon fontSize="small" color="success" />
        <Typography variant="caption" fontWeight={700} color="success.main">
          EVALUATE
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary">
        {d.version_id ? `v: ${d.version_id.slice(0, 8)}` : "Results appear here"}
      </Typography>
      <Handle type="target" position={Position.Left} />
    </Box>
  );
}
