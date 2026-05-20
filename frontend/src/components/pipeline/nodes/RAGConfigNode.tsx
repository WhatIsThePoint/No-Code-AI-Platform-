import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box, MenuItem, Select, Slider, Tooltip, Typography, alpha } from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";
import MemoryRoundedIcon from "@mui/icons-material/MemoryRounded";
import { useEffect, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { RAGConfigNodeData, RAGLlmEngine } from "../../../types/pipeline";
import { fetchHardwareOnce, type HardwareSnapshot } from "../../../api/system";
import { NodeBadge } from "./NodeBadge";
import { getValidationBorderColor, type NodeValidation } from "./validation";

const DEFAULT_TOP_K = 8;
const FALLBACK_MAX_K = 10; // used until hardware probe completes

interface EngineOption {
  value: RAGLlmEngine;
  label: string;
  vram: string;
  // Minimum *free* VRAM (MB) required to run this model at K=8/8K context
  // without spilling KV cache to system RAM. Numbers include weights (Q4_K_M)
  // plus a realistic KV-cache headroom for an 8K window.
  vramRequiredMb: number;
  bestFor: string;
  hint: string;
}

const ENGINES: EngineOption[] = [
  {
    value: "llama3.2:3b",
    label: "Llama 3.2 · 3B",
    vram: "~3.5 GB VRAM",
    vramRequiredMb: 3500,
    bestFor: "General Q&A",
    hint: "Balanced quality and speed. Best default on a 6 GB GPU.",
  },
  {
    value: "phi3:mini",
    label: "Phi-3 Mini · 3.8B",
    vram: "~4.0 GB VRAM",
    vramRequiredMb: 4000,
    bestFor: "Reasoning & Structure",
    hint: "Microsoft Phi-3. Strong reasoning for its size; good for structured answers.",
  },
  {
    value: "gemma2:2b",
    label: "Gemma 2 · 2B",
    vram: "~3.0 GB VRAM",
    vramRequiredMb: 3000,
    bestFor: "Speed & Low VRAM",
    hint: "Google Gemma 2. Fast and lean; good fallback when VRAM is tight.",
  },
];

const MONO = "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";
const INK = "#0b0d0e";
const RULE = "#d8d5c7";
const ACCENT = "#d2541c";
const MUTED = "#6b6b65";

function formatGb(mb: number): string {
  return `${(mb / 1024).toFixed(1)} GB`;
}

function describeHardware(hw: HardwareSnapshot | null): string {
  if (!hw) return "Detecting hardware…";
  if (hw.gpu_detected && hw.gpu) {
    return `${hw.gpu.name} · ${formatGb(hw.gpu.free_mb)} free / ${formatGb(hw.gpu.total_mb)}`;
  }
  return `CPU only · ${formatGb(hw.ram.free_mb)} RAM free`;
}

export function RAGConfigNode({ id, data, selected }: NodeProps) {
  const d = data as RAGConfigNodeData & { __validation?: NodeValidation };
  const validationBorder = getValidationBorderColor(d.__validation, "");
  const { setNodes } = useReactFlow();
  const [hw, setHw] = useState<HardwareSnapshot | null>(null);
  const [hwError, setHwError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchHardwareOnce()
      .then((snap) => {
        if (alive) setHw(snap);
      })
      .catch(() => {
        if (alive) setHwError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleChange = (engine: RAGConfigNodeData["llm_engine"]) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, llm_engine: engine } } : n))
    );
  };

  // Dynamic ceiling: server-recommended max, falls back to a safe default
  // while the probe is in flight or unreachable.
  const dynamicMaxK = hw?.max_top_k ?? FALLBACK_MAX_K;
  const safeTopK = hw?.recommended_top_k ?? DEFAULT_TOP_K;

  const handleTopKChange = (value: number) => {
    const clamped = Math.max(1, Math.min(value, dynamicMaxK));
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, top_k: clamped } } : n))
    );
  };

  const topK = d.top_k ?? DEFAULT_TOP_K;
  const inDanger = topK > safeTopK;

  // VRAM gating: a model is disabled when the host's free VRAM cannot fit
  // its weights + minimum KV cache. CPU-only hosts disable nothing — Ollama
  // will run them on CPU (slow but functional).
  const freeVram = hw?.gpu?.free_mb ?? null;
  const isModelDisabled = (e: EngineOption): boolean =>
    freeVram !== null && freeVram < e.vramRequiredMb;

  // Selected slider/thumb color flips to ACCENT once the user crosses
  // the recommended ceiling for their hardware.
  const sliderMarks = (() => {
    const marks = [{ value: 1, label: "1" }];
    if (safeTopK > 1 && safeTopK < dynamicMaxK) {
      marks.push({ value: safeTopK, label: String(safeTopK) });
    }
    marks.push({ value: dynamicMaxK, label: String(dynamicMaxK) });
    return marks;
  })();

  return (
    <Box
      sx={{
        position: "relative",
        px: 2,
        py: 1.75,
        borderRadius: "2px",
        border: 1,
        borderColor: validationBorder || (selected ? ACCENT : RULE),
        bgcolor: "#fafaf7",
        minWidth: 240,
        boxShadow: "none",
        transition: "border-color 0.15s ease",
        "&:hover": { borderColor: validationBorder || (selected ? ACCENT : INK) },
      }}
    >
      <Handle type="target" position={Position.Left} />
      <NodeBadge validation={d.__validation} />
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: "2px",
            bgcolor: INK,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AutoAwesomeRoundedIcon sx={{ fontSize: 13, color: "#fafaf7" }} />
        </Box>
        <Typography
          sx={{
            fontFamily: MONO,
            fontWeight: 700,
            color: INK,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontSize: "0.65rem",
          }}
        >
          RAG Config
        </Typography>
      </Box>

      <Typography
        sx={{
          display: "block",
          mb: 0.5,
          fontFamily: MONO,
          fontSize: "0.65rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        Local LLM engine
      </Typography>
      <Select
        className="nodrag"
        size="small"
        fullWidth
        value={d.llm_engine ?? "llama3.2:3b"}
        onChange={(e) => handleChange(e.target.value as RAGLlmEngine)}
        renderValue={(val) => {
          const e = ENGINES.find((x) => x.value === val);
          return (
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
              <Typography
                component="span"
                sx={{ fontFamily: MONO, fontSize: "0.78rem", color: INK, fontWeight: 600 }}
              >
                {e?.label ?? val}
              </Typography>
              {e && (
                <Typography
                  component="span"
                  sx={{ fontFamily: MONO, fontSize: "0.65rem", color: MUTED, letterSpacing: "0.04em" }}
                >
                  {e.vram}
                </Typography>
              )}
            </Box>
          );
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              borderRadius: "2px",
              border: `1px solid ${RULE}`,
              boxShadow: "none",
              mt: 0.5,
            },
          },
        }}
      >
        {ENGINES.map((e) => {
          const disabled = isModelDisabled(e);
          return (
            <MenuItem
              key={e.value}
              value={e.value}
              disabled={disabled}
              sx={{
                display: "block",
                borderRadius: 0,
                py: 1,
                px: 1.25,
                borderBottom: `1px solid ${alpha(RULE, 0.5)}`,
                "&:last-of-type": { borderBottom: "none" },
                "&.Mui-selected": {
                  bgcolor: alpha(ACCENT, 0.08),
                  "&:hover": { bgcolor: alpha(ACCENT, 0.12) },
                },
                "&.Mui-disabled": { opacity: 0.55 },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: MONO,
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    color: INK,
                  }}
                >
                  {e.label}
                </Typography>
                <Box
                  component="span"
                  sx={{
                    ml: "auto",
                    px: 0.75,
                    py: 0.125,
                    border: `1px solid ${disabled ? alpha("#b54141", 0.6) : RULE}`,
                    borderRadius: "2px",
                    fontFamily: MONO,
                    fontSize: "0.62rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    color: disabled ? "#b54141" : MUTED,
                    textTransform: "uppercase",
                  }}
                >
                  {disabled ? `Needs ${formatGb(e.vramRequiredMb)} VRAM` : e.vram}
                </Box>
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: MONO,
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: ACCENT,
                  }}
                >
                  Best for:
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    fontFamily: MONO,
                    fontSize: "0.66rem",
                    fontWeight: 600,
                    color: INK,
                  }}
                >
                  {e.bestFor}
                </Typography>
              </Box>
              <Typography
                sx={{
                  fontFamily: MONO,
                  fontSize: "0.66rem",
                  lineHeight: 1.4,
                  color: MUTED,
                  whiteSpace: "normal",
                }}
              >
                {e.hint}
              </Typography>
            </MenuItem>
          );
        })}
      </Select>

      <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography
          sx={{
            fontFamily: MONO,
            fontSize: "0.65rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: MUTED,
          }}
        >
          Top-K context
        </Typography>
        <Tooltip
          title={
            hw
              ? `Recommended ≤ ${safeTopK} for your hardware (max ${dynamicMaxK}). Higher = more recall but slower TTFT and worse 'lost in the middle'.`
              : "Higher = more recall but slower TTFT, more VRAM, and worse 'lost in the middle' on small models."
          }
          arrow
          placement="top"
        >
          <Typography
            component="span"
            sx={{
              fontFamily: MONO,
              fontSize: "0.78rem",
              fontWeight: 700,
              color: inDanger ? ACCENT : INK,
              cursor: "help",
            }}
          >
            {topK}
          </Typography>
        </Tooltip>
      </Box>
      {/* Slight right padding > left so the rightmost mark dot, whose
          MUI default transform centres it on `left: 100%`, lands fully
          inside the node's rounded border instead of bleeding past it. */}
      <Box className="nodrag" sx={{ pl: 1.25, pr: 2, pb: 2 }}>
        <Slider
          size="small"
          value={Math.min(topK, dynamicMaxK)}
          min={1}
          max={dynamicMaxK}
          step={1}
          marks={sliderMarks}
          onChange={(_, v) => handleTopKChange(Array.isArray(v) ? v[0] : v)}
          sx={{
            color: inDanger ? ACCENT : INK,
            height: 2,
            py: "10px",
            "& .MuiSlider-thumb": {
              width: 10,
              height: 10,
              borderRadius: "2px",
              bgcolor: inDanger ? ACCENT : INK,
              "&:hover, &.Mui-focusVisible": { boxShadow: "none" },
              "&.Mui-active": { boxShadow: "none" },
            },
            "& .MuiSlider-rail": { bgcolor: RULE, opacity: 1 },
            "& .MuiSlider-track": { border: "none" },
            "& .MuiSlider-mark": { bgcolor: RULE, height: 4, width: 1 },
            "& .MuiSlider-markLabel": {
              fontFamily: MONO,
              fontSize: "0.6rem",
              color: MUTED,
              top: 16,
            },
            // Pin the first/last *dots* fully inside the rail. MUI's default
            // `translate(-50%, -50%)` puts half of the 0% / 100% mark
            // outside the rail edges; we shift them inward instead.
            "& .MuiSlider-mark[data-index='0']": {
              transform: "translate(0, -50%)",
            },
            [`& .MuiSlider-mark[data-index='${sliderMarks.length - 1}']`]: {
              transform: "translate(-100%, -50%)",
            },
            // Pin the first/last *labels* the same way so the digits don't
            // hang past the node's rounded border.
            "& .MuiSlider-markLabel[data-index='0']": {
              transform: "translateX(0)",
            },
            [`& .MuiSlider-markLabel[data-index='${sliderMarks.length - 1}']`]: {
              transform: "translateX(-100%)",
            },
          }}
        />
      </Box>
      {inDanger && (
        <Box
          sx={{
            mt: 1,
            display: "flex",
            alignItems: "flex-start",
            gap: 0.75,
            px: 0.75,
            py: 0.625,
            border: `1px solid ${alpha(ACCENT, 0.4)}`,
            borderRadius: "2px",
            bgcolor: alpha(ACCENT, 0.06),
          }}
        >
          <WarningRoundedIcon sx={{ fontSize: 12, color: ACCENT, mt: "1px" }} />
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: "0.62rem",
              lineHeight: 1.4,
              color: INK,
            }}
          >
            {hw
              ? `Above ${safeTopK} exceeds the safe ceiling for your hardware — expect slower TTFT and possible truncation.`
              : "Above 8 may exceed VRAM on Phi-3 Mini and trigger truncation on Gemma 2."}
          </Typography>
        </Box>
      )}

      <Tooltip
        title={
          hw
            ? `Profile: ${hw.profile} · slider capped at ${dynamicMaxK} based on detected hardware.`
            : hwError
            ? "Hardware probe failed — using conservative defaults."
            : "Probing hardware…"
        }
        arrow
        placement="bottom"
      >
        <Box
          sx={{
            mt: 1.25,
            pt: 0.875,
            borderTop: `1px solid ${alpha(RULE, 0.7)}`,
            display: "flex",
            alignItems: "center",
            gap: 0.625,
            cursor: "help",
          }}
        >
          <MemoryRoundedIcon sx={{ fontSize: 11, color: MUTED }} />
          <Typography
            sx={{
              fontFamily: MONO,
              fontSize: "0.6rem",
              letterSpacing: "0.04em",
              color: MUTED,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {hwError ? "Hardware probe unavailable" : describeHardware(hw)}
          </Typography>
        </Box>
      </Tooltip>
    </Box>
  );
}
