import { Handle, Position, type NodeProps, useReactFlow } from "@xyflow/react";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { useEffect, useMemo, useRef, useState } from "react";
import { dlApi } from "../../../api/dl";
import { useDatasets } from "../../../hooks/useDatasets";
import type { ImageDatasetNodeData } from "../../../types/pipeline";
import { NodeBadge } from "./NodeBadge";
import { getValidationBorderColor, type NodeValidation } from "./validation";

const ACCENT = "#0ea5e9";
const ACCENT_DARK = "#0284c7";

interface ExtraProps {
  __validation?: NodeValidation;
}

/**
 * Picker over image-typed datasets + per-class thumbnail strip.
 *
 * The thumbnails are fetched lazily once a `dataset_id` is bound — the
 * `/datasets/<id>/image-preview` endpoint returns base64 data-URIs so a
 * single fetch populates the strip without each `<img>` triggering its
 * own request. We also cache them on the node's data so re-renders
 * (Undo/Redo, mode switches) don't re-hit the network.
 */
export function ImageDatasetNode({ id, data, selected }: NodeProps) {
  const d = data as ImageDatasetNodeData & ExtraProps;
  const { setNodes } = useReactFlow();
  const { datasets } = useDatasets();
  const [loadingThumbs, setLoadingThumbs] = useState(false);
  const [thumbsError, setThumbsError] = useState<string | null>(null);
  // Track the dataset_id we last fetched thumbnails for so a re-mint of the
  // node component (caused by ReactFlow's diff) doesn't refetch unnecessarily.
  const fetchedFor = useRef<string | null>(null);

  const imageDatasets = useMemo(
    () => datasets.filter((x) => x.source_type === "image"),
    [datasets],
  );

  const selectedDataset = imageDatasets.find((x) => x.dataset_id === d.dataset_id);

  // Sync server-side metadata onto the node when a fresh dataset is picked
  // — class count + total drives both the strip header and validation.
  useEffect(() => {
    if (!selectedDataset) return;
    const numClasses = selectedDataset.image_profile?.num_classes;
    const total = selectedDataset.image_profile?.total_images;
    if (d.num_classes !== numClasses || d.total_images !== total || d.dataset_name !== selectedDataset.name) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id
            ? {
                ...n,
                data: {
                  ...n.data,
                  dataset_name: selectedDataset.name,
                  num_classes: numClasses,
                  total_images: total,
                },
              }
            : n,
        ),
      );
    }
    // We deliberately omit `d.*` from deps — they're written by this effect
    // and including them would trip the equality dance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDataset?.dataset_id, selectedDataset?.image_profile?.num_classes]);

  const fetchThumbs = async (datasetId: string) => {
    setLoadingThumbs(true);
    setThumbsError(null);
    try {
      const { data: resp } = await dlApi.imagePreview(datasetId, 3);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, thumbnails: resp.samples } } : n,
        ),
      );
      fetchedFor.current = datasetId;
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setThumbsError(e.response?.data?.error || e.message || "Preview failed");
    } finally {
      setLoadingThumbs(false);
    }
  };

  // Auto-fetch on dataset change (and the dataset is ready). Refresh
  // button below also reuses this.
  useEffect(() => {
    if (!d.dataset_id) return;
    if (selectedDataset?.status !== "ready") return;
    if (fetchedFor.current === d.dataset_id) return;
    if (d.thumbnails && d.thumbnails.length > 0) {
      fetchedFor.current = d.dataset_id;
      return;
    }
    void fetchThumbs(d.dataset_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.dataset_id, selectedDataset?.status]);

  const handlePick = (datasetId: string) => {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id
          ? {
              ...n,
              data: {
                ...n.data,
                dataset_id: datasetId,
                // Wipe cached metadata — the effect above will repopulate.
                dataset_name: undefined,
                num_classes: undefined,
                total_images: undefined,
                thumbnails: undefined,
              },
            }
          : n,
      ),
    );
  };

  // Group thumbnails by class so each chip+strip pairs cleanly. Limit to
  // a few classes on the node body (full grid lives in the side panel).
  const thumbsByClass = useMemo(() => {
    const acc: Record<string, string[]> = {};
    for (const s of d.thumbnails ?? []) {
      (acc[s.class] ??= []).push(s.thumb_b64);
    }
    return acc;
  }, [d.thumbnails]);
  const visibleClasses = Object.keys(thumbsByClass).slice(0, 4);

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
          <ImageRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
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
          Image Dataset
        </Typography>
      </Box>

      <Select
        className="nodrag"
        size="small"
        fullWidth
        displayEmpty
        value={d.dataset_id ?? ""}
        onChange={(e) => handlePick(e.target.value as string)}
        sx={{ fontSize: "0.78rem" }}
      >
        <MenuItem value="" disabled>
          <em>Select an image dataset</em>
        </MenuItem>
        {imageDatasets.length === 0 && (
          <MenuItem disabled value="__none__">
            No image datasets — upload a zip from the Data page first
          </MenuItem>
        )}
        {imageDatasets.map((x) => (
          <MenuItem key={x.dataset_id} value={x.dataset_id}>
            <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <Typography component="span" sx={{ fontSize: "0.78rem", fontWeight: 600 }}>
                {x.name}
              </Typography>
              {x.image_profile && (
                <Typography component="span" sx={{ fontSize: "0.65rem", color: "text.secondary" }}>
                  {x.image_profile.num_classes} classes · {x.image_profile.total_images} images
                </Typography>
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>

      {selectedDataset && (
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap" }}>
          <Chip
            label={`${d.num_classes ?? "?"} classes`}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.65rem", height: 20 }}
          />
          <Chip
            label={`${d.total_images ?? "?"} images`}
            size="small"
            variant="outlined"
            sx={{ fontSize: "0.65rem", height: 20 }}
          />
          {selectedDataset.status !== "ready" && (
            <Chip
              label={selectedDataset.status}
              size="small"
              color="warning"
              sx={{ fontSize: "0.65rem", height: 20, textTransform: "capitalize" }}
            />
          )}
          <Tooltip title="Refresh thumbnails" arrow>
            <span>
              <IconButton
                size="small"
                className="nodrag"
                onClick={() => d.dataset_id && fetchThumbs(d.dataset_id)}
                disabled={loadingThumbs || !d.dataset_id}
                sx={{ ml: "auto", p: 0.25 }}
                aria-label="Refresh thumbnails"
              >
                {loadingThumbs ? (
                  <CircularProgress size={12} />
                ) : (
                  <RefreshRoundedIcon sx={{ fontSize: 14 }} />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}

      {visibleClasses.length > 0 && (
        <Box sx={{ mt: 1.25, display: "flex", flexDirection: "column", gap: 0.5 }}>
          {visibleClasses.map((cls) => (
            <Box key={cls} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography
                sx={{
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  width: 50,
                  color: "text.secondary",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                }}
                title={cls}
              >
                {cls}
              </Typography>
              <Box sx={{ display: "flex", gap: 0.25 }}>
                {thumbsByClass[cls].slice(0, 3).map((b64, i) => (
                  <Box
                    key={i}
                    component="img"
                    src={b64}
                    alt={`${cls} sample ${i + 1}`}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: "4px",
                      border: "1px solid",
                      borderColor: alpha(ACCENT, 0.2),
                      objectFit: "cover",
                    }}
                  />
                ))}
              </Box>
            </Box>
          ))}
          {Object.keys(thumbsByClass).length > visibleClasses.length && (
            <Typography sx={{ fontSize: "0.6rem", color: "text.secondary", mt: 0.25 }}>
              +{Object.keys(thumbsByClass).length - visibleClasses.length} more classes
            </Typography>
          )}
        </Box>
      )}

      {thumbsError && (
        <Typography
          variant="caption"
          sx={{ mt: 0.75, display: "block", color: "#b54141", fontSize: "0.65rem" }}
        >
          {thumbsError}
        </Typography>
      )}

      <Handle type="source" position={Position.Right} />
    </Box>
  );
}
