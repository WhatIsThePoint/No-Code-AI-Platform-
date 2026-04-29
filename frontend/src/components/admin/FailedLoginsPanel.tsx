import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import LockClockRoundedIcon from "@mui/icons-material/LockClockRounded";
import { useTranslation } from "react-i18next";
import { adminApi, type FailedLoginsReport } from "../../api/admin";
import { MONO, P } from "./parity";

const POLL_MS = 30_000;

export function FailedLoginsPanel() {
  const { t } = useTranslation();
  const [report, setReport] = useState<FailedLoginsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await adminApi.getFailedLogins(24);
        if (!alive) return;
        setReport(data);
        setError(null);
      } catch (e) {
        if (!alive) return;
        const err = e as { response?: { data?: { error?: string } } };
        setError(err.response?.data?.error ?? "request_failed");
      }
    };
    tick();
    const handle = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(handle);
    };
  }, []);

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
          <LockClockRoundedIcon sx={{ fontSize: 14, color: P.muted }} />
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: P.muted,
            }}
          >
            {t("failedLogins.title")}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: report && report.total > 0 ? P.bad : P.muted,
          }}
        >
          {report ? t("failedLogins.total", { count: report.total }) : error ?? "…"}
        </Typography>
      </Box>

      {!report ? (
        <Box
          sx={{
            p: 4,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 12,
            color: P.muted,
          }}
        >
          {error ? `Probe failed: ${error}` : "Loading attempts…"}
        </Box>
      ) : report.total === 0 ? (
        <Box sx={{ p: 3, fontFamily: MONO, fontSize: 12, color: P.muted, textAlign: "center" }}>
          {t("failedLogins.noData")}
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <Box sx={{ p: 1.5, borderRight: { md: `1px solid ${P.ruleSoft}` } }}>
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: P.muted,
                mb: 0.75,
                px: 0.5,
              }}
            >
              {t("failedLogins.topIps")}
            </Typography>
            <Stack spacing={0}>
              {report.top_ips.map((row) => (
                <Box
                  key={row.ip_address}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    alignItems: "center",
                    px: 0.5,
                    py: 0.625,
                    borderBottom: `1px solid ${P.ruleSoft}`,
                    "&:last-of-type": { borderBottom: 0 },
                  }}
                >
                  <Typography
                    sx={{ fontFamily: MONO, fontSize: 12, color: P.ink }}
                  >
                    {row.ip_address}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: MONO,
                      fontSize: 12,
                      fontWeight: 700,
                      color: row.attempts > 5 ? P.bad : P.ink2,
                    }}
                  >
                    {row.attempts}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Box>
          <Box sx={{ p: 1.5 }}>
            <Typography
              sx={{
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: P.muted,
                mb: 0.75,
                px: 0.5,
              }}
            >
              {t("failedLogins.recent")}
            </Typography>
            <Box sx={{ maxHeight: 220, overflowY: "auto" }}>
              {report.recent.slice(0, 25).map((r) => (
                <Box
                  key={r.id}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    px: 0.5,
                    py: 0.625,
                    borderBottom: `1px solid ${P.ruleSoft}`,
                    "&:last-of-type": { borderBottom: 0 },
                  }}
                >
                  <Typography
                    sx={{
                      fontFamily: MONO,
                      fontSize: 11,
                      fontWeight: 600,
                      color: P.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.email ?? "—"}
                  </Typography>
                  <Typography
                    sx={{ fontFamily: MONO, fontSize: 10, color: P.muted2 }}
                  >
                    {r.ip_address ?? "?"} · {new Date(r.created_at).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
