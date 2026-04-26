import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import type { SvgIconComponent } from "@mui/icons-material";

interface Props {
  /** Short button label shown next to the lock icon. */
  label: string;
  /** Headline inside the modal (e.g. "Team chat is a Company feature"). */
  featureTitle: string;
  /** One-line description of what the feature does. */
  featureDescription: string;
  /** Optional leading icon next to the label (same one used for the real feature). */
  icon?: SvgIconComponent;
}

/**
 * Renders a dim, locked-looking button that opens an "Upgrade Required"
 * modal on click. Used to replace hidden premium controls so free-tier
 * users can see what they're missing instead of finding empty toolbars.
 */
export function UpgradeLockBadge({
  label,
  featureTitle,
  featureDescription,
  icon: Icon,
}: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={() => setOpen(true)}
        startIcon={
          Icon ? (
            <Stack direction="row" alignItems="center" spacing={0.25}>
              <Icon sx={{ fontSize: 14, opacity: 0.6 }} />
              <LockRoundedIcon sx={{ fontSize: 11, color: "#94a3b8" }} />
            </Stack>
          ) : (
            <LockRoundedIcon sx={{ fontSize: 14, color: "#94a3b8" }} />
          )
        }
        sx={{
          borderColor: alpha("#94a3b8", 0.35),
          color: "#64748b",
          fontWeight: 600,
          "&:hover": {
            borderColor: "#f59e0b",
            color: "#b45309",
            bgcolor: alpha("#f59e0b", 0.06),
          },
        }}
      >
        {label}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: 1,
            borderColor: "divider",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            fontWeight: 700,
            pb: 1,
          }}
        >
          <LockRoundedIcon sx={{ color: "#f59e0b" }} />
          Upgrade Required
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
              {featureTitle}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {featureDescription}
            </Typography>
          </Box>
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              bgcolor: alpha("#f59e0b", 0.08),
              border: 1,
              borderColor: alpha("#f59e0b", 0.2),
            }}
          >
            <Typography variant="caption" sx={{ color: "#b45309", fontWeight: 600 }}>
              Available on the Collaborator plan. Upgrade to unlock team chat,
              meeting links, and shared pipelines.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: "text.secondary" }}>
            Maybe later
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setOpen(false);
              navigate("/billing");
            }}
            sx={{
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              "&:hover": {
                background: "linear-gradient(135deg, #d97706, #b45309)",
              },
            }}
          >
            View plans
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
