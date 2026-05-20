import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  alpha,
} from "@mui/material";
import ImageRoundedIcon from "@mui/icons-material/ImageRounded";
import { useEffect, useMemo, useState } from "react";
import { dlApi, type ImagePreviewSample } from "../../api/dl";
import type { Dataset } from "../../types/dataset";

interface Props {
  dataset: Dataset;
}

const ACCENT = "#d2541c";

/**
 * Image-dataset Preview tab — sibling of `DatasetPreview` for the DL
 * workflow. The tabular DataGrid doesn't fit an ImageFolder layout, so
 * we render the class-counts table from `dataset.image_profile` and a
 * thumbnail strip per class fetched from `/datasets/<id>/image-preview`.
 */
export function ImageDatasetPreview({ dataset }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [samples, setSamples] = useState<ImagePreviewSample[]>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    dlApi
      .imagePreview(dataset.dataset_id, 4)
      .then(({ data }) => {
        if (!alive) return;
        setSamples(data.samples);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        const e = err as { response?: { data?: { error?: string } } };
        setError(e.response?.data?.error ?? "Failed to load image preview");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dataset.dataset_id]);

  const profile = dataset.image_profile;
  // `samples` is a flat list of {class, thumb_b64}; group by class for layout.
  const byClass = useMemo(() => {
    const acc: Record<string, string[]> = {};
    for (const s of samples) {
      (acc[s.class] ??= []).push(s.thumb_b64);
    }
    return acc;
  }, [samples]);

  return (
    <Box className="animate-fade-in">
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <ImageRoundedIcon sx={{ color: ACCENT }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Image dataset preview
        </Typography>
        <Box sx={{ flex: 1 }} />
        {profile && (
          <>
            <Chip
              label={`${profile.num_classes} classes`}
              size="small"
              variant="outlined"
            />
            <Chip
              label={`${profile.total_images} images`}
              size="small"
              variant="outlined"
            />
            {profile.sample_dim && (
              <Chip
                label={`${profile.sample_dim[0]}×${profile.sample_dim[1]}`}
                size="small"
                variant="outlined"
              />
            )}
          </>
        )}
      </Stack>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && !loading && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            {profile?.class_counts &&
              Object.entries(profile.class_counts)
                .sort((a, b) => b[1] - a[1])
                .map(([cls, count]) => (
                  <Box
                    key={cls}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "120px 60px 1fr", md: "180px 80px 1fr" },
                      alignItems: "center",
                      gap: 2,
                      py: 1,
                      borderBottom: 1,
                      borderColor: "divider",
                      "&:last-of-type": { borderBottom: 0 },
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={cls}
                    >
                      {cls}
                    </Typography>
                    <Chip
                      label={count}
                      size="small"
                      sx={{
                        bgcolor: alpha(ACCENT, 0.1),
                        color: ACCENT,
                        fontWeight: 700,
                        width: 60,
                      }}
                    />
                    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                      {(byClass[cls] ?? []).slice(0, 6).map((b64, i) => (
                        <Box
                          key={i}
                          component="img"
                          src={b64}
                          alt={`${cls} sample ${i + 1}`}
                          sx={{
                            width: 48,
                            height: 48,
                            objectFit: "cover",
                            borderRadius: "4px",
                            border: 1,
                            borderColor: "divider",
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                ))}
          </Stack>
        </Paper>
      )}
    </Box>
  );
}
