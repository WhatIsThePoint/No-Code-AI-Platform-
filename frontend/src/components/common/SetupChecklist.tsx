import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Collapse,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import RadioButtonUncheckedRoundedIcon from "@mui/icons-material/RadioButtonUncheckedRounded";
import CelebrationRoundedIcon from "@mui/icons-material/CelebrationRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import { useTranslation } from "react-i18next";

const STORAGE_KEY_DISMISSED = "ncai-setup-checklist-dismissed";
const STORAGE_KEY_COLLAPSED = "ncai-setup-checklist-collapsed";

export interface SetupChecklistState {
  hasDataset: boolean;
  hasPipeline: boolean;
  hasTrainedModel: boolean;
  hasTeammate: boolean;
}

interface Props {
  state: SetupChecklistState;
}

interface Item {
  key: keyof SetupChecklistState;
  i18nKey: string;
  optional?: boolean;
}

const ITEMS: Item[] = [
  { key: "hasDataset", i18nKey: "uploadDataset" },
  { key: "hasPipeline", i18nKey: "buildPipeline" },
  { key: "hasTrainedModel", i18nKey: "runTraining" },
  { key: "hasTeammate", i18nKey: "inviteTeammate", optional: true },
];

export function SetupChecklist({ state }: Props) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY_DISMISSED) === "1");
    setCollapsed(localStorage.getItem(STORAGE_KEY_COLLAPSED) === "1");
  }, []);

  const requiredCount = useMemo(() => ITEMS.filter((i) => !i.optional).length, []);
  const requiredDone = useMemo(
    () => ITEMS.filter((i) => !i.optional && state[i.key]).length,
    [state],
  );
  const allRequiredDone = requiredDone === requiredCount;

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY_DISMISSED, "1");
    setDismissed(true);
  };

  const toggleCollapse = () => {
    const next = !collapsed;
    localStorage.setItem(STORAGE_KEY_COLLAPSED, next ? "1" : "0");
    setCollapsed(next);
  };

  const progress = (requiredDone / requiredCount) * 100;

  return (
    <Card
      sx={{
        mb: 3,
        border: 1,
        borderColor: allRequiredDone ? alpha("#10b981", 0.3) : alpha("#6366f1", 0.18),
        bgcolor: allRequiredDone ? alpha("#10b981", 0.04) : alpha("#6366f1", 0.025),
        boxShadow: "none",
      }}
    >
      <CardContent sx={{ pb: collapsed ? "16px !important" : undefined }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: collapsed ? 0 : 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              background: allRequiredDone
                ? "linear-gradient(135deg, #10b981, #059669)"
                : "linear-gradient(135deg, #6366f1, #4f46e5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {allRequiredDone ? (
              <CelebrationRoundedIcon sx={{ fontSize: 20 }} />
            ) : (
              <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {allRequiredDone ? t("setupChecklist.completedTitle") : t("setupChecklist.title")}
            </Typography>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {allRequiredDone
                ? t("setupChecklist.completedSubtitle")
                : t("setupChecklist.subtitle")}
            </Typography>
            {!collapsed && (
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  mt: 1,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha("#0b0d0e", 0.06),
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 3,
                    background: allRequiredDone
                      ? "linear-gradient(90deg, #10b981, #059669)"
                      : "linear-gradient(90deg, #6366f1, #8b5cf6)",
                  },
                }}
              />
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <Tooltip title={collapsed ? "Expand" : "Collapse"} arrow>
              <IconButton
                size="small"
                onClick={toggleCollapse}
                aria-label={collapsed ? "Expand checklist" : "Collapse checklist"}
              >
                {collapsed ? <ExpandMoreRoundedIcon /> : <ExpandLessRoundedIcon />}
              </IconButton>
            </Tooltip>
            {allRequiredDone && (
              <Tooltip title={t("setupChecklist.dismiss")} arrow>
                <IconButton
                  size="small"
                  onClick={handleDismiss}
                  aria-label={t("setupChecklist.dismiss")}
                >
                  <CloseRoundedIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Collapse in={!collapsed} unmountOnExit>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {ITEMS.map((item) => {
              const done = state[item.key];
              return (
                <Box
                  key={item.key}
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.25,
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: "#fff",
                    border: 1,
                    borderColor: done ? alpha("#10b981", 0.25) : "divider",
                    opacity: done ? 0.75 : 1,
                  }}
                >
                  {done ? (
                    <CheckCircleRoundedIcon
                      sx={{ color: "#10b981", fontSize: 20, mt: "1px" }}
                      aria-label="completed"
                    />
                  ) : (
                    <RadioButtonUncheckedRoundedIcon
                      sx={{ color: "text.disabled", fontSize: 20, mt: "1px" }}
                      aria-label="pending"
                    />
                  )}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        textDecoration: done ? "line-through" : "none",
                        color: done ? "text.secondary" : "text.primary",
                      }}
                    >
                      {t(`setupChecklist.items.${item.i18nKey}`)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
                      {t(`setupChecklist.items.${item.i18nKey}Hint`)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
}
