import { IconButton, Tooltip } from "@mui/material";
import ContrastRoundedIcon from "@mui/icons-material/ContrastRounded";
import { useTranslation } from "react-i18next";
import { useThemeStore } from "../../theme/themeStore";

export function ContrastToggle() {
  const { t } = useTranslation();
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  const enabled = mode === "highContrast";
  const label = enabled ? t("contrast.disable") : t("contrast.enable");

  return (
    <Tooltip title={label} arrow>
      <IconButton
        onClick={toggle}
        aria-label={label}
        aria-pressed={enabled}
        size="small"
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 1.5,
          color: enabled ? "primary.main" : "text.secondary",
          // Filled background when active so the state reads at a glance.
          bgcolor: enabled ? "action.selected" : "transparent",
        }}
      >
        <ContrastRoundedIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Tooltip>
  );
}
