import { Box, Tooltip, alpha } from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import PriorityHighRoundedIcon from "@mui/icons-material/PriorityHighRounded";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { VALIDATION_COLORS, type NodeValidation } from "./validation";

interface Props {
  validation: NodeValidation | undefined;
}

export function NodeBadge({ validation }: Props) {
  if (!validation) return null;
  const color = VALIDATION_COLORS[validation.status];
  const Icon =
    validation.status === "valid"
      ? CheckRoundedIcon
      : validation.status === "warning"
      ? WarningAmberRoundedIcon
      : PriorityHighRoundedIcon;

  return (
    <Tooltip title={validation.message} arrow placement="top">
      <Box
        sx={{
          position: "absolute",
          top: -6,
          right: -6,
          width: 16,
          height: 16,
          borderRadius: "50%",
          bgcolor: color,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 0 2px #fff, 0 2px 6px ${alpha(color, 0.45)}`,
          zIndex: 5,
          cursor: "help",
          // Subtle pulse on errors so they pull the eye in a busy graph.
          animation:
            validation.status === "error" ? "nodebadge-pulse 1.6s ease-out infinite" : "none",
          "@keyframes nodebadge-pulse": {
            "0%": { boxShadow: `0 0 0 2px #fff, 0 0 0 0 ${alpha(color, 0.55)}` },
            "70%": { boxShadow: `0 0 0 2px #fff, 0 0 0 8px ${alpha(color, 0)}` },
            "100%": { boxShadow: `0 0 0 2px #fff, 0 0 0 0 ${alpha(color, 0)}` },
          },
        }}
      >
        <Icon sx={{ fontSize: 11 }} />
      </Box>
    </Tooltip>
  );
}
