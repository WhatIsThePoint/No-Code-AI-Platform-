import { useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import VisibilityRoundedIcon from "@mui/icons-material/VisibilityRounded";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../store/authSlice";
import { adminApi } from "../../api/admin";

function formatRemaining(secondsLeft: number): string {
  if (secondsLeft <= 0) return "0:00";
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Persistent red banner shown across the top of every page while a super-admin
 * is impersonating another user. Shows the target email + a live countdown to
 * the token's natural expiry, plus a one-click Exit that restores the original
 * session and audit-logs the end of the session.
 */
export function ImpersonationBanner() {
  const impersonation = useAuthStore((s) => s.impersonation);
  const endImpersonation = useAuthStore((s) => s.endImpersonation);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [, tick] = useState(0);

  // Drive a per-second re-render so the countdown updates without polling.
  useEffect(() => {
    if (!impersonation) return;
    const handle = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(handle);
  }, [impersonation]);

  // Auto-exit when the token expires so the user isn't stuck staring at a
  // session that's already invalid server-side.
  useEffect(() => {
    if (!impersonation) return;
    const remaining = impersonation.expiresAt - Math.floor(Date.now() / 1000);
    if (remaining <= 0) {
      handleExit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [impersonation, /* re-evaluated on tick via the parent re-render */]);

  if (!impersonation) return null;

  const remaining = Math.max(
    0,
    impersonation.expiresAt - Math.floor(Date.now() / 1000),
  );

  const handleExit = async () => {
    const ended = endImpersonation();
    if (ended) {
      try {
        await adminApi.endImpersonation(ended.targetUserId);
      } catch {
        // Best-effort — the backend will still see the end via audit log
        // expiry timeout, and the original session is already restored
        // client-side regardless.
      }
    }
    navigate("/admin");
  };

  return (
    <Box
      role="alert"
      aria-live="polite"
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        // Sit above the AppBar (which is itself zIndex.drawer + 1) so the Exit
        // button is always reachable; the AppBar would otherwise occlude it.
        zIndex: (theme) => theme.zIndex.drawer + 100,
        bgcolor: "#b91c1c",
        color: "#fff",
        px: 2,
        py: 0.75,
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
      }}
    >
      <VisibilityRoundedIcon sx={{ fontSize: 18 }} />
      <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
        {t("impersonation.banner", { email: impersonation.targetEmail })}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
          letterSpacing: "0.04em",
          opacity: 0.95,
        }}
      >
        {t("impersonation.expiresIn", { time: formatRemaining(remaining) })}
      </Typography>
      <Button
        size="small"
        variant="contained"
        onClick={handleExit}
        sx={{
          bgcolor: "#fff",
          color: "#b91c1c",
          fontWeight: 700,
          "&:hover": { bgcolor: "#fee2e2", color: "#7f1d1d" },
        }}
      >
        {t("impersonation.exit")}
      </Button>
    </Box>
  );
}
