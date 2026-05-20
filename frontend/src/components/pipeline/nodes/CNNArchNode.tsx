import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import {
  Box,
  Chip,
  FormControlLabel,
  MenuItem,
  Select,
  Switch,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import type {
  CNNArch,
  CNNArchNodeData,
  DLInputSize,
} from "../../../types/pipeline";
import { NodeBadge } from "./NodeBadge";
import { getValidationBorderColor, type NodeValidation } from "./validation";

const ACCENT = "#a855f7";
const ACCENT_DARK = "#7e22ce";

interface ArchOption {
  value: CNNArch;
  label: string;
  paramsCaption: string;
  /** Whether the registry has an ImageNet checkpoint for this arch. */
  pretrainedAvailable: boolean;
  /** Recommended input size for the demo budget. */
  recommendedInput: DLInputSize;
  hint: string;
}

// Catalog-as-data — kept in sync with the backend `archs/__init__.py`
// registry. If a new arch is added there it must also appear here, and
// `ALLOWED_ARCHS` on the route enforces the closed set.
const ARCHS: ArchOption[] = [
  {
    value: "lenet",
    label: "LeNet",
    paramsCaption: "≈60k params",
    pretrainedAvailable: false,
    recommendedInput: 28,
    hint: "Tiny CNN — trains in seconds. Good for Fashion-MNIST-class smoke tests.",
  },
  {
    value: "tiny_resnet",
    label: "Tiny ResNet (ResNet-9)",
    paramsCaption: "≈2.7 M params",
    pretrainedAvailable: false,
    recommendedInput: 64,
    hint: "BatchNorm + skip connections. Hits ~90% on CIFAR-10 in 5 epochs.",
  },
  {
    value: "mobilenet_v3_small",
    label: "MobileNet V3 Small",
    paramsCaption: "≈2.5 M params · ImageNet",
    pretrainedAvailable: true,
    recommendedInput: 224,
    hint: "Pretrained ImageNet weights. The demo-killer for small custom datasets.",
  },
];

const INPUT_SIZES: DLInputSize[] = [28, 64, 128, 224];

interface ExtraProps {
  __validation?: NodeValidation;
}

/**
 * Architecture picker + pretrained toggle + input-size dropdown.
 *
 * The pretrained toggle is *not* hidden when an arch lacks ImageNet
 * weights — it's disabled with a tooltip so the user understands *why*
 * the option isn't available rather than seeing a control silently
 * disappear when they switch arch.
 */
export function CNNArchNode({ id, data, selected }: NodeProps) {
  const d = data as CNNArchNodeData & ExtraProps;
  const { setNodes } = useReactFlow();

  const arch = d.arch ?? "lenet";
  const inputSize = d.input_size ?? 28;
  const pretrained = d.pretrained ?? false;
  const archMeta = ARCHS.find((a) => a.value === arch) ?? ARCHS[0];

  const update = (patch: Partial<CNNArchNodeData>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    );
  };

  const handleArchChange = (next: CNNArch) => {
    const meta = ARCHS.find((a) => a.value === next);
    if (!meta) return;
    // Auto-snap input size to the new arch's recommended bucket — and turn
    // pretrained off if the new arch can't honour it. Both are friendly
    // defaults the user can override; we just don't want to stash an
    // impossible state on the node.
    update({
      arch: next,
      input_size: meta.recommendedInput,
      pretrained: meta.pretrainedAvailable ? pretrained : false,
    });
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
        minWidth: 240,
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
          <HubRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
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
          CNN Arch
        </Typography>
      </Box>

      <Select
        className="nodrag"
        size="small"
        fullWidth
        value={arch}
        onChange={(e) => handleArchChange(e.target.value as CNNArch)}
        sx={{ fontSize: "0.78rem", mb: 0.75 }}
      >
        {ARCHS.map((a) => (
          <MenuItem key={a.value} value={a.value}>
            <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <Typography component="span" sx={{ fontSize: "0.78rem", fontWeight: 600 }}>
                {a.label}
              </Typography>
              <Typography
                component="span"
                sx={{ fontSize: "0.65rem", color: "text.secondary" }}
              >
                {a.paramsCaption}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography
          sx={{
            fontSize: "0.65rem",
            color: "text.secondary",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            fontWeight: 600,
            flex: 1,
          }}
        >
          Input size
        </Typography>
        <Select
          className="nodrag"
          size="small"
          value={inputSize}
          onChange={(e) => update({ input_size: Number(e.target.value) as DLInputSize })}
          sx={{ fontSize: "0.78rem", minWidth: 80 }}
        >
          {INPUT_SIZES.map((s) => (
            <MenuItem key={s} value={s} sx={{ fontSize: "0.78rem" }}>
              {s} px
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Tooltip
        title={
          archMeta.pretrainedAvailable
            ? "Initialize from ImageNet weights — the demo-killer for small custom datasets."
            : `${archMeta.label} has no canonical ImageNet checkpoint. From-scratch training only.`
        }
        arrow
      >
        <Box className="nodrag" sx={{ display: "flex", alignItems: "center" }}>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={pretrained && archMeta.pretrainedAvailable}
                disabled={!archMeta.pretrainedAvailable}
                onChange={(_, checked) => update({ pretrained: checked })}
              />
            }
            label={
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 600 }}>
                Pretrained (ImageNet)
              </Typography>
            }
            sx={{ mr: 0 }}
          />
        </Box>
      </Tooltip>

      <Box sx={{ mt: 0.75, display: "flex", flexWrap: "wrap", gap: 0.5 }}>
        <Chip
          label={archMeta.paramsCaption}
          size="small"
          variant="outlined"
          sx={{ fontSize: "0.62rem", height: 18 }}
        />
        {pretrained && archMeta.pretrainedAvailable && (
          <Chip
            label="transfer-learn"
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
      </Box>

      <Typography
        sx={{
          mt: 0.75,
          fontSize: "0.62rem",
          color: "text.secondary",
          lineHeight: 1.35,
        }}
      >
        {archMeta.hint}
      </Typography>

      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
