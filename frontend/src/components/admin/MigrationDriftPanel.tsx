import { useEffect, useState } from "react";
import { Box, Stack, Typography } from "@mui/material";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ReportProblemRoundedIcon from "@mui/icons-material/ReportProblemRounded";
import { adminApi, type MigrationDriftReport } from "../../api/admin";
import { MONO, P } from "./parity";

const POLL_MS = 60_000;

export function MigrationDriftPanel() {
  const [report, setReport] = useState<MigrationDriftReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await adminApi.getMigrationDrift();
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

  const status: "ok" | "drift" | "unavailable" | "loading" =
    !report ? "loading" : report.status;
  const StatusIcon =
    status === "ok"
      ? CheckCircleRoundedIcon
      : status === "drift"
      ? ReportProblemRoundedIcon
      : ErrorOutlineRoundedIcon;
  const statusColor =
    status === "ok" ? P.ok : status === "drift" ? P.bad : P.muted;
  const statusLabel =
    status === "ok"
      ? "init.sql in sync with live DB"
      : status === "drift"
      ? "Drift detected"
      : status === "unavailable"
      ? "init.sql not reachable"
      : "Probing schema…";

  const driftEntries = report?.column_diffs ?? [];

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
          <StorageRoundedIcon sx={{ fontSize: 14, color: P.muted }} />
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: P.muted,
            }}
          >
            Migration drift · live
          </Typography>
        </Box>
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: MONO,
            fontSize: 10,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: statusColor,
          }}
        >
          <StatusIcon sx={{ fontSize: 12 }} />
          {error ? "probe failed" : statusLabel}
        </Box>
      </Box>

      {!report ? (
        <Box sx={{ p: 4, textAlign: "center", fontFamily: MONO, fontSize: 12, color: P.muted }}>
          {error ? `Probe failed: ${error}` : "Diffing init.sql against live DB…"}
        </Box>
      ) : status === "ok" ? (
        <Box sx={{ p: 3, fontFamily: MONO, fontSize: 12, color: P.muted, textAlign: "center" }}>
          Bootstrap schema and live DB agree. Alembic-only tables are excluded:{" "}
          <span style={{ color: P.ink2 }}>
            {(report.alembic_only_allowlist ?? []).join(", ")}
          </span>
          .
        </Box>
      ) : status === "unavailable" ? (
        <Box sx={{ p: 3, fontFamily: MONO, fontSize: 12, color: P.muted, textAlign: "center" }}>
          {report.message ?? "init.sql not reachable from this container."}
        </Box>
      ) : (
        <Box sx={{ p: 1.5 }}>
          {(report.tables_only_in_init_sql?.length ?? 0) > 0 && (
            <Box sx={{ mb: 1.25 }}>
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: P.bad,
                  mb: 0.5,
                }}
              >
                Missing in live DB (defined in init.sql):
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                {report.tables_only_in_init_sql!.map((t) => (
                  <Box
                    key={t}
                    sx={{
                      fontFamily: MONO,
                      fontSize: 11,
                      px: 0.75,
                      py: 0.25,
                      border: `1px solid ${P.bad}`,
                      borderRadius: "2px",
                      color: P.bad,
                    }}
                  >
                    {t}
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {(report.tables_only_in_live_db?.length ?? 0) > 0 && (
            <Box sx={{ mb: 1.25 }}>
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: P.accent,
                  mb: 0.5,
                }}
              >
                Live but not in init.sql (and not on Alembic-only allowlist):
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                {report.tables_only_in_live_db!.map((t) => (
                  <Box
                    key={t}
                    sx={{
                      fontFamily: MONO,
                      fontSize: 11,
                      px: 0.75,
                      py: 0.25,
                      border: `1px solid ${P.accent}`,
                      borderRadius: "2px",
                      color: P.accent,
                    }}
                  >
                    {t}
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {driftEntries.length > 0 && (
            <Box>
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: P.muted,
                  mb: 0.5,
                }}
              >
                Column-level drift
              </Typography>
              {driftEntries.map((entry) => (
                <Box
                  key={entry.table}
                  sx={{
                    p: 1,
                    borderBottom: `1px solid ${P.ruleSoft}`,
                    "&:last-of-type": { borderBottom: 0 },
                  }}
                >
                  <Typography
                    sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: P.ink, mb: 0.5 }}
                  >
                    {entry.table}
                  </Typography>
                  {entry.only_in_init_sql.length > 0 && (
                    <Typography sx={{ fontFamily: MONO, fontSize: 11, color: P.bad }}>
                      missing from live DB: {entry.only_in_init_sql.join(", ")}
                    </Typography>
                  )}
                  {entry.only_in_live_db.length > 0 && (
                    <Typography sx={{ fontFamily: MONO, fontSize: 11, color: P.accent }}>
                      missing from init.sql: {entry.only_in_live_db.join(", ")}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
