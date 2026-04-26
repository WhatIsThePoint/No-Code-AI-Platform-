import { useEffect, useRef, useState } from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import { systemApi, type HardwareSnapshot } from "../../api/system";
import { MONO, P, formatMb } from "./parity";

const POLL_MS = 4000;

interface BarState {
  used: number;
  total: number;
  pct: number;
  tone: "ok" | "warn" | "bad";
}

function deriveBar(snap: HardwareSnapshot | null): BarState {
  if (snap?.gpu) {
    const used = snap.gpu.total_mb - snap.gpu.free_mb;
    const pct = snap.gpu.total_mb
      ? Math.max(0, Math.min(100, (used / snap.gpu.total_mb) * 100))
      : 0;
    const tone: BarState["tone"] = pct >= 90 ? "bad" : pct >= 70 ? "warn" : "ok";
    return { used, total: snap.gpu.total_mb, pct, tone };
  }
  const ram = snap?.ram;
  if (ram) {
    const used = ram.total_mb - ram.free_mb;
    const pct = ram.total_mb
      ? Math.max(0, Math.min(100, (used / ram.total_mb) * 100))
      : 0;
    const tone: BarState["tone"] = pct >= 90 ? "bad" : pct >= 70 ? "warn" : "ok";
    return { used, total: ram.total_mb, pct, tone };
  }
  return { used: 0, total: 0, pct: 0, tone: "ok" };
}

export function LiveHardwarePanel() {
  const [snap, setSnap] = useState<HardwareSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await systemApi.getHardware();
        if (!alive) return;
        setSnap(data);
        setError(null);
      } catch {
        if (!alive) return;
        setError("probe_failed");
      }
    };
    tick();
    timer.current = window.setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      if (timer.current !== null) window.clearInterval(timer.current);
    };
  }, []);

  const bar = deriveBar(snap);
  const isGpu = !!snap?.gpu;
  const barColor =
    bar.tone === "bad" ? P.bad : bar.tone === "warn" ? P.accent : P.ok;
  const heading = isGpu ? "GPU VRAM · live" : "System RAM · live";

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
          <MemoryRoundedIcon sx={{ fontSize: 14, color: P.muted }} />
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: P.muted,
            }}
          >
            {heading}
          </Typography>
        </Box>
        <Tooltip
          title={
            error
              ? "Hardware probe failed"
              : `Profile: ${snap?.profile ?? "—"} · poll every ${POLL_MS / 1000}s`
          }
          arrow
        >
          <Box
            sx={{
              fontFamily: MONO,
              fontSize: 10,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: error ? P.bad : isGpu ? P.ok : P.muted,
              cursor: "help",
            }}
          >
            {error
              ? "probe error"
              : isGpu
              ? `profile: ${snap?.profile}`
              : "cpu fallback"}
          </Box>
        </Tooltip>
      </Box>

      <Box sx={{ p: "20px" }}>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: 13,
            color: P.ink,
            fontWeight: 600,
            mb: 0.25,
            wordBreak: "break-word",
          }}
        >
          {snap?.gpu?.name ??
            (snap?.gpu_detected === false ? "No GPU detected" : "Probing…")}
        </Typography>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: 11,
            color: P.muted,
            mb: 2,
          }}
        >
          {snap
            ? isGpu
              ? `${formatMb(bar.used)} used · ${formatMb(snap.gpu!.free_mb)} free / ${formatMb(bar.total)}`
              : `${formatMb(bar.used)} used · ${formatMb(snap.ram.free_mb)} free / ${formatMb(bar.total)}`
            : "—"}
        </Typography>

        {/* Memory progress bar — flat, square corners, color shifts on threshold */}
        <Box
          sx={{
            position: "relative",
            height: 8,
            bgcolor: P.paper3,
            border: `1px solid ${P.rule}`,
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${bar.pct}%`,
              bgcolor: barColor,
              transition: "width 0.4s ease, background-color 0.3s ease",
            }}
          />
        </Box>

        <Box
          sx={{
            mt: 1,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: MONO,
            fontSize: 10,
            color: P.muted,
            letterSpacing: "0.04em",
          }}
        >
          <span>{bar.pct.toFixed(0)}% used</span>
          <span>
            recommended K ≤ {snap?.recommended_top_k ?? "—"} · max {snap?.max_top_k ?? "—"}
          </span>
        </Box>

        {!isGpu && snap && (
          <Box
            sx={{
              mt: 2,
              p: "10px 12px",
              border: `1px solid ${P.rule}`,
              borderRadius: "2px",
              bgcolor: P.paper2,
              fontFamily: MONO,
              fontSize: 11,
              color: P.ink2,
              lineHeight: 1.5,
            }}
          >
            CPU-only inference: Ollama will run on the host CPU. Set
            <code style={{ marginLeft: 4, marginRight: 4 }}>GPU_TOTAL_VRAM_MB</code>
            on the gateway container to declare a host GPU not visible to this
            container.
          </Box>
        )}
      </Box>
    </Box>
  );
}
