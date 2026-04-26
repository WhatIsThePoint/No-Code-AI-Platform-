import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box, Chip, Typography, alpha } from "@mui/material";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import type { VectorStoreNodeData } from "../../../types/pipeline";

export function VectorStoreNode({ data, selected }: NodeProps) {
  const d = data as VectorStoreNodeData;
  return (
    <Box
      sx={{
        px: 2.5,
        py: 2,
        borderRadius: 3,
        border: 2,
        borderColor: selected ? "#a855f7" : alpha("#a855f7", 0.25),
        bgcolor: "#fff",
        minWidth: 190,
        boxShadow: selected
          ? `0 8px 25px -5px ${alpha("#a855f7", 0.3)}, 0 0 0 3px ${alpha("#a855f7", 0.1)}`
          : `0 2px 8px -2px ${alpha("#0f172a", 0.08)}`,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { borderColor: alpha("#a855f7", 0.55) },
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            background: "linear-gradient(135deg, #a855f7, #7e22ce)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <StorageRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: "#7e22ce",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontSize: "0.65rem",
          }}
        >
          Vector Store
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        pgvector (local)
      </Typography>
      <Typography variant="caption" color="text.secondary">
        384-dim · cosine
      </Typography>

      <Box sx={{ mt: 1 }}>
        <Chip
          size="small"
          label={`${d.total_chunks ?? 0} chunks indexed`}
          variant="outlined"
          sx={{ fontSize: "0.65rem", height: 20 }}
        />
      </Box>

      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
