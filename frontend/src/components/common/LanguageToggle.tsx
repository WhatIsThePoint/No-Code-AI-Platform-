import { ToggleButton, ToggleButtonGroup, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { setLanguage, type SupportedLanguage } from "../../i18n";

export function LanguageToggle() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language ?? "en").split("-")[0] as SupportedLanguage;

  const handleChange = (_: unknown, value: SupportedLanguage | null) => {
    if (value && value !== current) setLanguage(value);
  };

  return (
    <Tooltip title={t("language.switchAria")} arrow>
      <ToggleButtonGroup
        value={current}
        exclusive
        size="small"
        onChange={handleChange}
        aria-label={t("language.switchAria")}
        sx={{
          "& .MuiToggleButton-root": {
            px: 1.25,
            py: 0.25,
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            border: "1px solid",
            borderColor: "divider",
            color: "text.secondary",
          },
          "& .MuiToggleButton-root.Mui-selected": {
            bgcolor: "#0b0d0e",
            color: "#fafaf7",
            "&:hover": { bgcolor: "#0b0d0e" },
          },
        }}
      >
        <ToggleButton value="en" aria-label={t("language.english")}>
          EN
        </ToggleButton>
        <ToggleButton value="fr" aria-label={t("language.french")}>
          FR
        </ToggleButton>
      </ToggleButtonGroup>
    </Tooltip>
  );
}
