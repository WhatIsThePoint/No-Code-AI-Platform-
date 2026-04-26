import { useEffect, useRef, useState } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import LayersRoundedIcon from "@mui/icons-material/LayersRounded";
import { adminApi, type QueueSnapshot } from "../../api/admin";
import { MONO, P } from "./parity";

const POLL_MS = 4000;

export function QueueMonitorPanel() {
  const [snap, setSnap] = useState<QueueSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await adminApi.getQueueDepths();
        if (!alive) return;
        setSnap(data);
        setError(null);
      } catch (e) {
        if (!alive) return;
        const err = e as { response?: { data?: { error?: string } } };
        setError(err.response?.data?.error ?? "request_failed");
      }
    };
    tick();
    timer.current = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, []);

  const queues = snap?.queues ?? {};
  const queueNames = Object.keys(queues);

  return (
    <Box
      sx={{
        border: `1px solid ${P.rule}`,
        bgcolor: P.paper,
      }}
    >
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
          <LayersRoundedIcon sx={{ fontSize: 14, color: P.muted }} />
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: P.muted,
            }}
          >
            Celery queues · live
          </Typography>
        </Box>
        <Tooltip
          title={
            error
              ? `Last poll error: ${error}`
              : snap?.redis_ok
              ? "Redis healthy"
              : snap?.redis_error ?? "Probing Redis…"
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
              color: snap?.redis_ok ? P.ok : P.bad,
              cursor: "help",
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                bgcolor: snap?.redis_ok ? P.ok : P.bad,
              }}
            />
            {snap?.redis_ok ? "Redis OK" : "Redis error"}
          </Box>
        </Tooltip>
      </Box>

      {queueNames.length === 0 ? (
        <Box
          sx={{
            p: 4,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 12,
            color: P.muted,
          }}
        >
          {error ? `Probe failed: ${error}` : "Loading queue depths…"}
        </Box>
      ) : (
        <Box>
          {queueNames.map((name) => {
            const depth = queues[name];
            const busy = depth !== null && depth > 0;
            return (
              <Box
                key={name}
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  px: "16px",
                  py: "12px",
                  borderBottom: `1px solid ${P.ruleSoft}`,
                  "&:last-of-type": { borderBottom: 0 },
                  position: "relative",
                  // Pulse a left bar in accent when the queue has work waiting.
                  "&::before": busy
                    ? {
                        content: '""',
                        position: "absolute",
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 3,
                        bgcolor: P.accent,
                        animation: "queuePulse 1.4s ease-in-out infinite",
                      }
                    : undefined,
                  "@keyframes queuePulse": {
                    "0%, 100%": { opacity: 1 },
                    "50%": { opacity: 0.35 },
                  },
                }}
              >
                <Box>
                  <Typography
                    sx={{
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 600,
                      color: P.ink,
                    }}
                  >
                    {name}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: MONO,
                      fontSize: 10,
                      color: P.muted,
                      mt: "2px",
                    }}
                  >
                    {depth === null
                      ? "unreachable"
                      : busy
                      ? `${depth} task${depth === 1 ? "" : "s"} pending`
                      : "idle"}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    fontFamily: MONO,
                    fontSize: 18,
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                    color: depth === null ? P.bad : busy ? P.accent : P.ink2,
                    minWidth: 40,
                    textAlign: "right",
                  }}
                >
                  {depth === null ? "—" : depth}
                </Box>
              </Box>
            );
          })}
          <Box
            sx={{
              px: "16px",
              py: "8px",
              bgcolor: P.paper2,
              borderTop: `1px solid ${P.rule}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: P.muted,
            }}
          >
            <span>Total pending</span>
            <span style={{ color: P.ink, fontSize: 12 }}>
              {snap?.total_pending ?? 0}
            </span>
          </Box>
        </Box>
      )}
    </Box>
  );
}
