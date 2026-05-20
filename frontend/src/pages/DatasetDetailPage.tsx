import {
  Box,
  Chip,
  Tab,
  Tabs,
  Typography,
  CircularProgress,
  Alert,
} from "@mui/material";
import StorageIcon from "@mui/icons-material/StorageRounded";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { datasetsApi } from "../api/datasets";
import type { Dataset, ProfilingSummary } from "../types/dataset";
import { DatasetPreview } from "../components/data/DatasetPreview";
import { ImageDatasetPreview } from "../components/data/ImageDatasetPreview";
import { ProfilingReport } from "../components/data/ProfilingReport";
import { PreprocessingPanel } from "../components/data/PreprocessingPanel";
import { DataInsights } from "../components/data/DataInsights";
import { useReportCompanionContext } from "../components/companion/useCompanionContext";

// Surface the profiling alerts to the AI Companion so its SMOTE / log-transform
// suggestions are grounded in *this* dataset, not generic ML trivia.
function buildProfilingNotes(
  summary: ProfilingSummary | null | undefined,
  description: string | null | undefined,
): string | undefined {
  const parts: string[] = [];
  if (description) parts.push(`User-provided description: ${description}`);
  if (!summary) return parts.join("\n") || undefined;

  if (summary.target_column && summary.target_imbalance) {
    const t = summary.target_imbalance;
    if (t.needs_balancing) {
      parts.push(
        `Target "${summary.target_column}" is imbalanced — minority class is ${t.minority_pct}% of ${t.total} rows. SMOTE or class weighting is recommended.`,
      );
    } else if (t.classes && t.classes.length) {
      const top = t.classes
        .slice(0, 3)
        .map((c) => `${c.label}=${c.pct}%`)
        .join(", ");
      parts.push(
        `Target "${summary.target_column}" class distribution: ${top}.`,
      );
    }
  }

  if (summary.skewed_columns && summary.skewed_columns.length) {
    parts.push(
      `Highly skewed numeric columns (consider log transform): ${summary.skewed_columns
        .slice(0, 8)
        .join(", ")}.`,
    );
  }

  const outlierCols = (summary.columns || [])
    .filter((c) => c.outliers && c.outliers.count > 0 && c.outliers.pct >= 1)
    .map((c) => `${c.name} (${c.outliers!.pct}%)`)
    .slice(0, 6);
  if (outlierCols.length) {
    parts.push(`Columns with notable z-score outliers: ${outlierCols.join(", ")}.`);
  }

  return parts.length ? parts.join("\n") : undefined;
}

export function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    if (!id) return;
    datasetsApi.get(id).then(({ data }) => {
      setDataset(data);
      setLoading(false);
    });
  }, [id]);

  const companionNotes = useMemo(
    () => buildProfilingNotes(dataset?.profiling_summary, dataset?.description),
    [dataset?.profiling_summary, dataset?.description],
  );

  const schemaPreview = useMemo(() => {
    const cols = dataset?.profiling_summary?.columns;
    if (!cols || cols.length === 0) return undefined;
    return cols.slice(0, 20).map((c) => `${c.name}:${c.dtype}`).join(", ");
  }, [dataset?.profiling_summary?.columns]);

  useReportCompanionContext({
    active_view: "DatasetDetailPage",
    dataset: dataset
      ? {
          name: dataset.name,
          row_count: dataset.row_count,
          column_count: dataset.column_count,
          schema_preview: schemaPreview,
          target_column:
            dataset.preprocessing_config?.target_column ??
            dataset.profiling_summary?.target_column,
        }
      : null,
    notes: companionNotes,
  });

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (!dataset) return <Alert severity="error">Dataset not found</Alert>;

  const isReady = dataset.status === "ready" || dataset.status === "preprocessed";

  const statusColor = dataset.status === "preprocessed" || dataset.status === "ready"
    ? "success" : dataset.status === "error" ? "error" : "default";

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: "14px",
            background: "linear-gradient(135deg, #d2541c, #a8401a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            flexShrink: 0,
          }}
        >
          <StorageIcon />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h4" noWrap>{dataset.name}</Typography>
        </Box>
        <Chip label={dataset.status} color={statusColor} />
      </Box>

      <Typography variant="body2" sx={{ color: "text.secondary", mb: 3, ml: 7 }}>
        {dataset.source_type.toUpperCase()} · {dataset.row_count?.toLocaleString() ?? "?"} rows ·{" "}
        {dataset.column_count ?? "?"} columns
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Preview" disabled={!isReady} />
        {/* Image datasets don't have a tabular schema, so the
            Profile / Insights / Preprocessing tabs (all of which assume
            columnar data) are hidden — only the image-aware Preview tab
            remains for source_type=image. */}
        {dataset.source_type !== "image" && (
          <Tab label="Profile" disabled={!dataset.profiling_summary} />
        )}
        {dataset.source_type !== "image" && (
          <Tab label="Insights" disabled={!dataset.profiling_summary} />
        )}
        {dataset.source_type !== "image" && (
          <Tab label="Preprocessing" disabled={!isReady} />
        )}
      </Tabs>

      <Box className="animate-fade-in" key={tab}>
        {tab === 0 && isReady && dataset.source_type === "image" && (
          <ImageDatasetPreview dataset={dataset} />
        )}
        {tab === 0 && isReady && dataset.source_type !== "image" && (
          <DatasetPreview datasetId={dataset.dataset_id} />
        )}
        {tab === 1 && dataset.source_type !== "image" && dataset.profiling_summary && (
          <ProfilingReport summary={dataset.profiling_summary} rowCount={dataset.row_count} />
        )}
        {tab === 2 && dataset.source_type !== "image" && dataset.profiling_summary && (
          <DataInsights summary={dataset.profiling_summary} rowCount={dataset.row_count} />
        )}
        {tab === 3 && dataset.source_type !== "image" && isReady && (
          <PreprocessingPanel
            dataset={dataset}
            onDone={(updatedDataset) => setDataset(updatedDataset)}
          />
        )}
      </Box>
    </Box>
  );
}
