import { Box, Card, CardContent, LinearProgress, Stack, Tooltip, Typography, alpha } from "@mui/material";
import StorageRoundedIcon from "@mui/icons-material/StorageRounded";
import DatasetRoundedIcon from "@mui/icons-material/DatasetRounded";
import { useAuthStore } from "../../store/authSlice";
import type { Dataset } from "../../types/dataset";

const TIER_LIMITS: Record<string, { max_datasets: number; max_file_mb: number }> = {
  free: { max_datasets: 3, max_file_mb: 10 },
  solo: { max_datasets: 20, max_file_mb: 100 },
  company: { max_datasets: -1, max_file_mb: 500 },
  super_admin: { max_datasets: -1, max_file_mb: 500 },
};

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  solo: "Solo",
  company: "Collaborator",
  super_admin: "Admin",
};

function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return "0 MB";
  if (mb < 10) return mb.toFixed(1) + " MB";
  return Math.round(mb) + " MB";
}

interface Props {
  datasets: Dataset[];
}

export function UploadQuotaCard({ datasets }: Props) {
  const user = useAuthStore((s) => s.user);
  const tier = user?.tier ?? "free";
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

  const totalBytes = datasets.reduce((acc, d) => acc + (d.size_bytes ?? 0), 0);
  const datasetCount = datasets.length;

  const storagePct = Math.min(100, (totalBytes / (limits.max_file_mb * 1024 * 1024)) * 100);
  const datasetsPct =
    limits.max_datasets === -1 ? 0 : Math.min(100, (datasetCount / limits.max_datasets) * 100);

  const storageNearLimit = storagePct >= 80;
  const datasetsNearLimit = limits.max_datasets !== -1 && datasetsPct >= 80;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="stretch">
          {/* Storage */}
          <Tooltip
            title={`Your plan allows files up to ${limits.max_file_mb} MB each. This shows total bytes stored across all your datasets.`}
            arrow
            placement="top"
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                <StorageRoundedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.7rem" }}>
                  Data Uploaded
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mb: 0.75 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
                  {formatMB(totalBytes)}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  / {limits.max_file_mb} MB per-file limit
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={storagePct}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha("#6366f1", 0.08),
                  "& .MuiLinearProgress-bar": {
                    bgcolor: storageNearLimit ? "#f59e0b" : "#6366f1",
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          </Tooltip>

          {/* Datasets */}
          <Tooltip
            title={
              limits.max_datasets === -1
                ? "Unlimited datasets on your plan."
                : `Your plan allows up to ${limits.max_datasets} datasets at once.`
            }
            arrow
            placement="top"
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                <DatasetRoundedIcon sx={{ fontSize: 18, color: "#8b5cf6" }} />
                <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.7rem" }}>
                  Datasets
                </Typography>
              </Box>
              <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, mb: 0.75 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>
                  {datasetCount}
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  / {limits.max_datasets === -1 ? "∞" : limits.max_datasets} on {TIER_LABEL[tier] ?? tier}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={limits.max_datasets === -1 ? 100 : datasetsPct}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha("#8b5cf6", 0.08),
                  "& .MuiLinearProgress-bar": {
                    bgcolor:
                      limits.max_datasets === -1
                        ? "#10b981"
                        : datasetsNearLimit
                        ? "#f59e0b"
                        : "#8b5cf6",
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
          </Tooltip>
        </Stack>
      </CardContent>
    </Card>
  );
}
