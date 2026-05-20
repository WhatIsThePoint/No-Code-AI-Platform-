import {
  Alert,
  Box,
  Button,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  alpha,
} from "@mui/material";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import { useRef, useState } from "react";
import { dlApi, type DLPredictResponse } from "../../api/dl";

interface Props {
  versionId: string;
  /** Optional caption shown next to the version_id chip. */
  arch?: string;
}

/**
 * "Try it" widget — drop-zone + image preview + top-K prediction bars.
 *
 * Designed to be embeddable in three places without per-host re-styling:
 *   - PipelineCanvas, immediately after a DL training run finishes
 *   - ModelRegistryPage, on the row for a pytorch version
 *   - the Companion's pipeline-aware action menu (chat 9 polish)
 */
export function DLPredictPanel({ versionId, arch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DLPredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePicked = async (file: File) => {
    setError(null);
    setResult(null);
    // ObjectURL is revoked on next select to keep the browser's blob slot
    // count bounded — without this a user clicking through 50 images
    // accumulates 50 live blobs.
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setBusy(true);
    try {
      const { data } = await dlApi.predict(versionId, file);
      setResult(data);
    } catch (err) {
      const e = err as {
        response?: { status?: number; data?: { detail?: string; error?: string } };
      };
      const detail = e.response?.data?.detail || e.response?.data?.error;
      setError(detail || "Prediction failed");
    } finally {
      setBusy(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handlePicked(f);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handlePicked(f);
  };

  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: 1,
        borderColor: "divider",
        boxShadow: `0 2px 8px -2px ${alpha("#0f172a", 0.06)}`,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <ScienceRoundedIcon sx={{ color: "#10b981" }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Try this model
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Upload an image, get the top predictions back from the trained model. Inference runs locally, no cloud round-trip." arrow>
          <Typography
            variant="caption"
            sx={{
              fontFamily: "'JetBrains Mono', monospace",
              color: "text.secondary",
              cursor: "help",
            }}
          >
            v {versionId.slice(0, 8)}{arch ? ` · ${arch}` : ""}
          </Typography>
        </Tooltip>
      </Stack>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/bmp"
        style={{ display: "none" }}
        onChange={onChange}
      />

      <Box
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        sx={{
          py: 2.5,
          px: 2,
          border: "1.5px dashed",
          borderColor: alpha("#10b981", 0.4),
          borderRadius: 2,
          bgcolor: alpha("#10b981", 0.04),
          cursor: busy ? "wait" : "pointer",
          textAlign: "center",
          transition: "background-color 0.15s ease, border-color 0.15s ease",
          "&:hover": { bgcolor: alpha("#10b981", 0.08), borderColor: "#10b981" },
        }}
      >
        {busy ? (
          <CircularProgress size={20} sx={{ color: "#10b981" }} />
        ) : (
          <CloudUploadRoundedIcon sx={{ color: "#10b981", fontSize: 24 }} />
        )}
        <Typography
          variant="body2"
          sx={{ mt: 0.5, color: "#047857", fontWeight: 600 }}
        >
          {busy ? "Predicting…" : "Drop or pick an image"}
        </Typography>
      </Box>

      {previewUrl && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
          <Box
            component="img"
            src={previewUrl}
            alt="Uploaded sample"
            sx={{
              width: { xs: "100%", sm: 160 },
              height: { xs: 160, sm: 160 },
              objectFit: "cover",
              borderRadius: 2,
              border: 1,
              borderColor: "divider",
            }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {error ? (
              <Alert severity="error" sx={{ mt: 0.5 }}>
                {error}
              </Alert>
            ) : result ? (
              <>
                <Typography
                  variant="caption"
                  sx={{
                    color: "text.secondary",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 600,
                  }}
                >
                  Top {result.probs.length} predictions
                </Typography>
                <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                  {result.probs.map((p, i) => (
                    <Box key={`${p.class}-${i}`}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: i === 0 ? 700 : 500,
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.class}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 600,
                            color: i === 0 ? "#047857" : "text.secondary",
                            minWidth: 56,
                            textAlign: "right",
                          }}
                        >
                          {(p.probability * 100).toFixed(1)}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={Math.max(0, Math.min(100, p.probability * 100))}
                        sx={{
                          height: 5,
                          borderRadius: 3,
                          mt: 0.25,
                          bgcolor: alpha("#10b981", 0.1),
                          "& .MuiLinearProgress-bar": {
                            borderRadius: 3,
                            bgcolor: i === 0 ? "#10b981" : alpha("#10b981", 0.5),
                          },
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </>
            ) : (
              <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                Pick an image to see the model's top predictions.
              </Typography>
            )}
          </Box>
        </Stack>
      )}

      {!previewUrl && error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Stack
          direction="row"
          spacing={1}
          sx={{ mt: 2, justifyContent: "flex-end" }}
        >
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setResult(null);
              setError(null);
              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }
            }}
          >
            Try another
          </Button>
        </Stack>
      )}
    </Paper>
  );
}
