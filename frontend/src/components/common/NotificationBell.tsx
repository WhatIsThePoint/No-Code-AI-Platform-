import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import NotificationsRoundedIcon from "@mui/icons-material/NotificationsRounded";
import ChatBubbleRoundedIcon from "@mui/icons-material/ChatBubbleRounded";
import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import VideoCallRoundedIcon from "@mui/icons-material/VideoCallRounded";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberRoundedIcon from "@mui/icons-material/WarningAmberRounded";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useNotifications,
  unreadCountSelector,
  type AppNotification,
  type NotificationKind,
} from "../../store/notificationsSlice";
import { formatRelativeTime } from "../../lib/relativeTime";

const ICONS: Record<NotificationKind, React.ElementType> = {
  chat_message: ChatBubbleRoundedIcon,
  mention: AlternateEmailRoundedIcon,
  training_done: CheckCircleRoundedIcon,
  training_failed: ErrorOutlineRoundedIcon,
  document_indexed: DescriptionRoundedIcon,
  meeting_started: VideoCallRoundedIcon,
  info: InfoOutlinedIcon,
  warning: WarningAmberRoundedIcon,
};

const ACCENTS: Record<NotificationKind, string> = {
  chat_message: "#6366f1",
  mention: "#a855f7",
  training_done: "#10b981",
  training_failed: "#ef4444",
  document_indexed: "#0ea5e9",
  meeting_started: "#f59e0b",
  info: "#0ea5e9",
  warning: "#f59e0b",
};

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const items = useNotifications((s) => s.items);
  const unread = useNotifications(unreadCountSelector);
  const markRead = useNotifications((s) => s.markRead);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const clear = useNotifications((s) => s.clear);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const open = Boolean(anchor);

  const handleClick = (n: AppNotification) => {
    markRead(n.id);
    if (n.href) navigate(n.href);
    setAnchor(null);
  };

  return (
    <>
      <Tooltip title={t("notifications.open")} arrow>
        <IconButton
          onClick={(e) => setAnchor(e.currentTarget)}
          size="small"
          aria-label={t("notifications.open")}
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1.5,
          }}
        >
          <Badge
            badgeContent={unread}
            color="error"
            max={99}
            invisible={unread === 0}
            sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", height: 14, minWidth: 14 } }}
          >
            <NotificationsRoundedIcon sx={{ fontSize: 16 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              width: 380,
              maxHeight: 520,
              mt: 1,
              borderRadius: 2,
              border: 1,
              borderColor: "divider",
            },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.25,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {t("notifications.title")}
            </Typography>
            {unread > 0 && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {t("notifications.unread", { count: unread })}
              </Typography>
            )}
          </Box>
          {items.length > 0 && (
            <Stack direction="row" spacing={0.5}>
              <Button
                size="small"
                onClick={markAllRead}
                disabled={unread === 0}
                sx={{ fontSize: "0.65rem", px: 1, minWidth: 0 }}
              >
                {t("notifications.markAllRead")}
              </Button>
              <Button
                size="small"
                onClick={clear}
                color="inherit"
                sx={{ fontSize: "0.65rem", px: 1, minWidth: 0, color: "text.secondary" }}
              >
                {t("notifications.clearAll")}
              </Button>
            </Stack>
          )}
        </Box>

        {items.length === 0 ? (
          <Box sx={{ py: 4, px: 3, textAlign: "center" }}>
            <NotificationsRoundedIcon
              sx={{ fontSize: 28, color: "text.disabled", mb: 1 }}
            />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("notifications.empty")}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflowY: "auto", maxHeight: 440 }}>
            {items.map((n, idx) => {
              const Icon = ICONS[n.kind] ?? InfoOutlinedIcon;
              const accent = ACCENTS[n.kind] ?? "#6366f1";
              return (
                <Box key={n.id}>
                  <Box
                    role="button"
                    tabIndex={0}
                    onClick={() => handleClick(n)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleClick(n);
                      }
                    }}
                    sx={{
                      display: "flex",
                      gap: 1.25,
                      p: 1.5,
                      cursor: n.href ? "pointer" : "default",
                      bgcolor: n.read ? "transparent" : alpha(accent, 0.05),
                      borderLeft: n.read ? "3px solid transparent" : `3px solid ${accent}`,
                      "&:hover": { bgcolor: alpha(accent, 0.08) },
                      transition: "background-color 0.12s ease",
                    }}
                  >
                    <Box
                      sx={{
                        width: 28,
                        height: 28,
                        borderRadius: "8px",
                        bgcolor: alpha(accent, 0.12),
                        color: accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon sx={{ fontSize: 16 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: n.read ? 500 : 700,
                          lineHeight: 1.35,
                        }}
                      >
                        {n.title}
                      </Typography>
                      {n.body && (
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            display: "block",
                            mt: 0.25,
                            lineHeight: 1.4,
                            wordBreak: "break-word",
                          }}
                        >
                          {n.body}
                        </Typography>
                      )}
                      <Typography
                        variant="caption"
                        sx={{ color: "text.disabled", fontSize: "0.65rem" }}
                      >
                        {formatRelativeTime(n.created_at, i18n.resolvedLanguage ?? "en")}
                      </Typography>
                    </Box>
                  </Box>
                  {idx < items.length - 1 && <Divider />}
                </Box>
              );
            })}
          </Box>
        )}
      </Popover>
    </>
  );
}
