import { useEffect, useRef, useState } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import HealthAndSafetyRoundedIcon from "@mui/icons-material/HealthAndSafetyRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { adminApi, type SystemHealthSnapshot } from "../../api/admin";
import { MONO, P } from "./parity";

const POLL_MS = 8000;

function formatChecked(ts: number | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString();
}

export function HealthcheckPanel() {
  const [snap, setSnap] = useState<SystemHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<number | null>(null);

  const tick = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getSystemHealth();
      setSnap(data);
      setError(null);
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } };
      setError(err.response?.data?.error ?? "request_failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const safeTick = async () => {
      if (!alive) return;
      await tick();
    };
    safeTick();
    timer.current = window.setInterval(safeTick, POLL_MS);
    return () => {
      alive = false;
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, []);

  const services = snap?.services ?? [];

  return (
    <Box sx={{ border: `1px solid ${P.rule}`, bgcolor: P.paper }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: "16px",
          py: "10px",
          borderBottom: `1px solid ${P.rule}`,
          bgcolor: P.paper2,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <HealthAndSafetyRoundedIcon sx={{ fontSize: 14, color: P.muted }} />
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: P.muted,
            }}
          >
            Infra health · live
          </Typography>
        </Box>
        <Tooltip
          title={
            error
              ? `Last poll error: ${error}`
              : `Checked at ${formatChecked(snap?.checked_at)}`
          }
          arrow
        >
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: snap?.all_up ? P.ok : snap ? P.bad : P.muted,
              cursor: "help",
            }}
          >
            {loading && (
              <RefreshRoundedIcon
                sx={{
                  fontSize: 11,
                  animation: "spin 1s linear infinite",
                  "@keyframes spin": { to: { transform: "rotate(360deg)" } },
                }}
              />
            )}
            {snap
              ? `${snap.up_count}/${snap.total} up`
              : error
              ? "probe failed"
              : "checking…"}
          </Box>
        </Tooltip>
      </Box>

      {services.length === 0 ? (
        <Box
          sx={{
            p: 4,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 12,
            color: P.muted,
          }}
        >
          {error ? `Probe failed: ${error}` : "Probing infrastructure…"}
        </Box>
      ) : (
        <Box>
          {services.map((s) => {
            const up = s.status === "up";
            return (
              <Box
                key={s.service}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  alignItems: "center",
                  gap: "12px",
                  px: "16px",
                  py: "12px",
                  borderBottom: `1px solid ${P.ruleSoft}`,
                  "&:last-of-type": { borderBottom: 0 },
                  position: "relative",
                  "&::before": !up
                    ? {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        bgcolor: P.bad,
                      }
                    : undefined,
                }}
              >
                <Tooltip title={up ? "Up" : s.message ?? "Down"} arrow>
                  <Box
                    role="status"
                    aria-label={`${s.service} ${up ? "up" : "down"}`}
                    sx={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      bgcolor: up ? P.ok : P.bad,
                      boxShadow: up
                        ? `0 0 0 3px ${P.okSoft}`
                        : `0 0 0 3px ${P.badSoft}`,
                      flexShrink: 0,
                    }}
                  />
                </Tooltip>
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 600,
                      color: P.ink,
                    }}
                  >
                    {s.service}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: up ? P.muted : P.bad,
                      mt: "2px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={up ? undefined : s.message}
                  >
                    {up ? "operational" : s.message ?? "unreachable"}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    fontFamily: MONO,
                    fontSize: 11,
                    fontWeight: 500,
                    color: up ? P.ink2 : P.bad,
                    minWidth: 56,
                    textAlign: "right",
                  }}
                >
                  {s.latency_ms.toFixed(1)} ms
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
