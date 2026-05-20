import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import {
  Box,
  Chip,
  FormControlLabel,
  MenuItem,
  Select,
  Slider,
  Switch,
  TextField,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import ModelTrainingRoundedIcon from "@mui/icons-material/ModelTrainingRounded";
import { useAuthStore } from "../../../store/authSlice";
import type { DLOptimizer, DLTrainNodeData } from "../../../types/pipeline";
import { NodeBadge } from "./NodeBadge";
import { getValidationBorderColor, type NodeValidation } from "./validation";

const ACCENT = "#10b981";
const ACCENT_DARK = "#047857";

// Service-wide hard caps from dl-training-service.config — the slider can
// never exceed these regardless of tier. Tier-specific ceilings (smaller)
// are read from `user.limits` and override these on a per-user basis;
// the slider's `max` is `min(SERVICE_*, tier_*)`.
const SERVICE_MAX_EPOCHS = 20;
const SERVICE_MAX_BATCH_SIZE = 64;

const OPTIMIZERS: { value: DLOptimizer; label: string; lr: number; hint: string }[] = [
  {
    value: "adam",
    label: "Adam",
    lr: 1e-3,
    hint: "Adaptive LR — converges fast on small datasets. The default for the demo.",
  },
  {
    value: "sgd",
    label: "SGD + Nesterov",
    lr: 1e-2,
    hint: "Better generalisation when paired with augmentation; needs a higher LR.",
  },
];

interface ExtraProps {
  __validation?: NodeValidation;
}

/**
 * Hyper-parameter form for the actual training run. Designed to fit on
 * the canvas without a side-panel drawer — the side-panel branch in chat 6
 * (NodePanel.tsx) reuses the same controls in a roomier layout for users
 * who want to tweak with more breathing room.
 */
export function DLTrainNode({ id, data, selected }: NodeProps) {
  const d = data as DLTrainNodeData & ExtraProps;
  const { setNodes } = useReactFlow();
  // `useAuthStore` is hydrated from sessionStorage on app start, so the
  // limits are available here even on the first render after a refresh.
  // Falls back to the service-wide ceiling when limits aren't loaded yet
  // (e.g. dev with an old token that pre-dates the limits payload).
  const limits = useAuthStore((s) => s.user?.limits);
  const maxEpochs = Math.min(SERVICE_MAX_EPOCHS, limits?.max_dl_epochs ?? SERVICE_MAX_EPOCHS);
  const maxBatch = Math.min(SERVICE_MAX_BATCH_SIZE, limits?.max_dl_batch_size ?? SERVICE_MAX_BATCH_SIZE);

  const epochs = Math.min(d.epochs ?? 5, maxEpochs);
  const batchSize = Math.min(d.batch_size ?? 32, maxBatch);
  const lr = d.lr ?? 1e-3;
  const optimizer = d.optimizer ?? "adam";
  const augment = d.augment ?? false;

  const update = (patch: Partial<DLTrainNodeData>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  };

  const handleOptimizer = (next: DLOptimizer) => {
    const meta = OPTIMIZERS.find((o) => o.value === next);
    // Snap LR to the recommended default for the new optimizer — switching
    // from Adam (1e-3) to SGD (1e-2) without bumping LR makes SGD look
    // broken on stage. User can override after.
    update({ optimizer: next, lr: meta?.lr ?? lr });
  };

  const validationBorder = getValidationBorderColor(d.__validation, "");
  return (
    <Box
      sx={{
        position: "relative",
        px: 2.25,
        py: 1.75,
        borderRadius: 3,
        border: 2,
        borderColor: validationBorder || (selected ? ACCENT : alpha(ACCENT, 0.25)),
        bgcolor: "#fff",
        minWidth: 260,
        boxShadow: selected
          ? `0 8px 25px -5px ${alpha(ACCENT, 0.3)}, 0 0 0 3px ${alpha(ACCENT, 0.1)}`
          : `0 2px 8px -2px ${alpha("#0f172a", 0.08)}`,
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        "&:hover": { borderColor: alpha(ACCENT, 0.55) },
      }}
    >
      <Handle type="target" position={Position.Left} />
      <NodeBadge validation={d.__validation} />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "8px",
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ModelTrainingRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
        </Box>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: ACCENT_DARK,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontSize: "0.65rem",
          }}
        >
          DL Train
        </Typography>
      </Box>

      <Box className="nodrag" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Epochs
            </Typography>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700 }}>{epochs}</Typography>
          </Box>
          <Slider
            size="small"
            value={Math.min(epochs, maxEpochs)}
            min={1}
            max={maxEpochs}
            step={1}
            onChange={(_, v) =>
              update({ epochs: Array.isArray(v) ? v[0] : (v as number) })
            }
            sx={{ color: ACCENT, mt: -0.5 }}
          />
        </Box>

        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Batch size
            </Typography>
            <Typography sx={{ fontSize: "0.78rem", fontWeight: 700 }}>{batchSize}</Typography>
          </Box>
          <Slider
            size="small"
            // Power-of-two-ish marks read more naturally to ML users than
            // continuous; we still allow fine-grained step=1 in case the
            // user really wants 24. Marks past `maxBatch` are dropped so a
            // free-tier user doesn't see a tickmark they can't reach.
            value={Math.min(batchSize, maxBatch)}
            min={1}
            max={maxBatch}
            step={1}
            marks={[
              { value: 8, label: "8" },
              { value: 16, label: "16" },
              { value: 32, label: "32" },
              { value: 64, label: "64" },
            ].filter((m) => m.value <= maxBatch)}
            onChange={(_, v) =>
              update({ batch_size: Array.isArray(v) ? v[0] : (v as number) })
            }
            sx={{
              color: ACCENT,
              mt: -0.5,
              "& .MuiSlider-markLabel": { fontSize: "0.6rem" },
            }}
          />
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.25 }}>
              Optimizer
            </Typography>
            <Select
              size="small"
              fullWidth
              value={optimizer}
              onChange={(e) => handleOptimizer(e.target.value as DLOptimizer)}
              sx={{ fontSize: "0.78rem" }}
            >
              {OPTIMIZERS.map((o) => (
                <Tooltip key={o.value} title={o.hint} arrow placement="right">
                  <MenuItem value={o.value} sx={{ fontSize: "0.78rem" }}>
                    {o.label}
                  </MenuItem>
                </Tooltip>
              ))}
            </Select>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: "0.65rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", mb: 0.25 }}>
              Learning rate
            </Typography>
            <TextField
              size="small"
              type="number"
              value={lr}
              onChange={(e) => {
                const v = Number(e.target.value);
                // Clamp to (0, 1] — the route enforces the same range, but
                // catching it client-side avoids a redundant 400 round-trip.
                if (Number.isFinite(v) && v > 0 && v <= 1) update({ lr: v });
              }}
              inputProps={{ step: 0.0001, min: 0.0001, max: 1, style: { fontSize: "0.78rem" } }}
            />
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={augment}
              onChange={(_, checked) => update({ augment: checked })}
            />
          }
          label={
            <Tooltip
              title="Random crop + horizontal flip + small colour jitter on the train split. Helps generalisation on small datasets."
              arrow
            >
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 600, cursor: "help" }}>
                Augmentation
              </Typography>
            </Tooltip>
          }
          sx={{ mr: 0 }}
        />
      </Box>

      {/* Estimated wall-clock badge — purely informational, derived from
          the slider values. Real estimate from vram_guard lands when the
          user clicks Run. */}
      <Box sx={{ mt: 0.75, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        <Chip
          label={`${epochs} ep × b=${batchSize}`}
          size="small"
          variant="outlined"
          sx={{ fontSize: "0.62rem", height: 18 }}
        />
        <Chip
          label={`lr=${lr}`}
          size="small"
          variant="outlined"
          sx={{ fontSize: "0.62rem", height: 18 }}
        />
        {augment && (
          <Chip
            label="aug"
            size="small"
            sx={{
              fontSize: "0.62rem",
              height: 18,
              bgcolor: alpha(ACCENT, 0.1),
              color: ACCENT_DARK,
              fontWeight: 600,
            }}
          />
        )}
        {limits && (maxEpochs < SERVICE_MAX_EPOCHS || maxBatch < SERVICE_MAX_BATCH_SIZE) && (
          <Tooltip
            title={`Your plan caps DL training at ${maxEpochs} epochs and batch size ${maxBatch}. Upgrade for higher ceilings.`}
            arrow
          >
            <Chip
              label="tier-capped"
              size="small"
              sx={{
                fontSize: "0.62rem",
                height: 18,
                bgcolor: alpha("#f59e0b", 0.12),
                color: "#b45309",
                fontWeight: 600,
                cursor: "help",
              }}
            />
          </Tooltip>
        )}
      </Box>

      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
