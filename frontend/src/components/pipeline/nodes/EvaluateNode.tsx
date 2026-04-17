import { Handle, Position } from "@xyflow/react";
import { Box, Typography, alpha } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/AssessmentRounded";
import type { NodeProps } from "@xyflow/react";

export function EvaluateNode({ data, selected }: NodeProps) {
  const d = data as { version_id?: string };
  return (
    <Box
      sx={{
        px: 2.5,
        py: 2,
        borderRadius: 3,
        border: 2,
        borderColor: selected ? "#10b981" : alpha("#10b981", 0.2),
        bgcolor: "#fff",
        minWidth: 180,
        boxShadow: selected
          ? `0 8px 25px -5px ${alpha("#10b981", 0.3)}, 0 0 0 3px ${alpha("#10b981", 0.1)}`
          : `0 2px 8px -2px ${alpha("#0f172a", 0.08)}`,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": {
          borderColor: alpha("#10b981", 0.5),
          boxShadow: `0 4px 16px -4px ${alpha("#10b981", 0.25)}`,
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AssessmentIcon sx={{ fontSize: 16, color: "#fff" }} />
        </Box>
        <Typography variant="caption" sx={{ fontWeight: 700, color: "#10b981", letterSpacing: "0.05em", textTransform: "uppercase", fontSize: "0.65rem" }}>
          Evaluate
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: d.version_id ? "text.primary" : "text.secondary", fontWeight: d.version_id ? 500 : 400 }}>
        {d.version_id ? `v: ${d.version_id.slice(0, 8)}` : "Results appear here"}
      </Typography>
      <Handle type="target" position={Position.Left} />
    </Box>
  );
}
