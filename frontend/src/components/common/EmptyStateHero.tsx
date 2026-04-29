import { Box, Button, Typography, alpha } from "@mui/material";
import type { SvgIconComponent } from "@mui/icons-material";
import type { ReactNode } from "react";

interface Props {
  icon: SvgIconComponent;
  title: string;
  description: string;
  /**
   * Primary CTA — "+ New Dataset", "Load Demo", etc. Optional so this same
   * component can render on pages where the action lives elsewhere.
   */
  actionLabel?: string;
  onAction?: () => void;
  /** Slot for non-button affordances (e.g. DemoDatasetButton). */
  secondaryAction?: ReactNode;
  /** Visual accent color. Defaults to indigo to match the dataset palette. */
  accent?: string;
  dense?: boolean;
}

export function EmptyStateHero({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryAction,
  accent = "#6366f1",
  dense = false,
}: Props) {
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        textAlign: "center",
        py: dense ? 6 : 9,
        px: 3,
        borderRadius: 4,
        border: "1px dashed",
        borderColor: alpha(accent, 0.35),
        bgcolor: alpha(accent, 0.025),
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: "20px",
          mx: "auto",
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.7)})`,
          color: "#fff",
          boxShadow: `0 10px 24px -10px ${alpha(accent, 0.55)}`,
        }}
      >
        <Icon sx={{ fontSize: 32 }} />
      </Box>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75 }}>
        {title}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.secondary", maxWidth: 460, mx: "auto", mb: 2.5 }}
      >
        {description}
      </Typography>
      <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap" }}>
        {actionLabel && onAction && (
          <Button
            variant="contained"
            onClick={onAction}
            sx={{
              background: `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.85)})`,
              fontWeight: 600,
              "&:hover": {
                background: `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.95)})`,
              },
            }}
          >
            {actionLabel}
          </Button>
        )}
        {secondaryAction}
      </Box>
    </Box>
  );
}
