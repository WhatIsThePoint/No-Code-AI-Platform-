import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, LinearProgress, Stack, Typography, alpha } from "@mui/material";
import BoltIcon from "@mui/icons-material/BoltRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircleRounded";
import ErrorIcon from "@mui/icons-material/ErrorOutlineRounded";
import { Plot } from "../data/plotly";
import { getTrainingSocket } from "../../api/socket";
import { useNotifications } from "../../store/notificationsSlice";

interface ProgressEvent {
  pipeline_id: string;
  ts: string;
  progress_pct: number;
  stage: string;
}

interface MetricEvent {
  pipeline_id: string;
  ts: string;
  step: number;
  metric: string;
  value: number;
  split: string;
}

// DL training emits one packet per epoch carrying three series at once —
// see realtime_emitter.emit_epoch in dl-training-service. Fanning it out
// into three MetricEvents on the client keeps the rendering code below
// completely framework-agnostic.
interface EpochEvent {
  pipeline_id: string;
  ts: string;
  epoch: number;
  epochs_total: number;
  train_loss: number;
  val_loss: number;
  val_acc: number;
}

interface CompleteEvent {
  pipeline_id: string;
  ts: string;
  version_id?: string;
  duration_s?: number;
  metrics?: Record<string, unknown>;
}

interface FailedEvent {
  pipeline_id: string;
  ts: string;
  error: string;
}

interface ProgressPoint {
  t: number; // ms since first event
  pct: number;
}

interface MetricSeries {
  name: string; // metric · split
  points: { step: number; value: number }[];
}

interface Props {
  pipelineId: string;
  /** Hide once a previous run has completed; show again on next start. */
  startedAt?: string;
  height?: number;
}

const STAGE_LABELS: Record<string, string> = {
  loading_data: "Loading data",
  preparing_features: "Preparing features",
  fitting_model: "Fitting model",
  training_done: "Training done",
  saving_model: "Saving model",
  // DL-specific stages emitted by dl-training-service.train_image:
  building_model: "Building model",
  queued: "Queued",
  done: "Complete",
  error: "Error",
};

// `epoch_<n>_of_<N>` stages render as "Epoch n / N" — friendlier than the
// raw underscore form. Returned untouched if the regex doesn't match.
function prettyStage(raw: string): string {
  const match = /^epoch_(\d+)_of_(\d+)$/.exec(raw);
  if (match) return `Epoch ${match[1]} / ${match[2]}`;
  return STAGE_LABELS[raw] ?? raw;
}

/**
 * Sprint 7 Module 3 — live training visualization.
 *
 * Subscribes to the `/training` SocketIO namespace, joins the pipeline's
 * room, and renders progress + per-step metric points as Plotly traces.
 * The Y-axis is auto-scaled by Plotly because the progress values (0–100)
 * and metric values (0–1) live on different ranges; we put progress on
 * its own subplot row.
 */
export function LiveTrainingChart({ pipelineId, height = 280 }: Props) {
  const [progressPoints, setProgressPoints] = useState<ProgressPoint[]>([]);
  const [metricSeries, setMetricSeries] = useState<Record<string, MetricSeries>>({});
  const [stage, setStage] = useState<string>("waiting");
  const [completed, setCompleted] = useState<CompleteEvent | null>(null);
  const [failed, setFailed] = useState<FailedEvent | null>(null);
  const t0Ref = useRef<number | null>(null);

  useEffect(() => {
    const socket = getTrainingSocket();

    const onProgress = (evt: ProgressEvent) => {
      if (evt.pipeline_id !== pipelineId) return;
      const ts = new Date(evt.ts).getTime();
      if (t0Ref.current == null) t0Ref.current = ts;
      const t = (ts - (t0Ref.current ?? ts)) / 1000;
      setProgressPoints((prev) => [...prev, { t, pct: evt.progress_pct }]);
      setStage(evt.stage);
      setCompleted(null);
      setFailed(null);
    };

    const onMetric = (evt: MetricEvent) => {
      if (evt.pipeline_id !== pipelineId) return;
      const key = `${evt.metric} · ${evt.split}`;
      setMetricSeries((prev) => {
        const existing = prev[key] ?? { name: key, points: [] };
        return {
          ...prev,
          [key]: {
            ...existing,
            points: [...existing.points, { step: evt.step, value: evt.value }],
          },
        };
      });
    };

    const onEpoch = (evt: EpochEvent) => {
      if (evt.pipeline_id !== pipelineId) return;
      // Three series per epoch, indexed by the epoch number on the X-axis
      // so DL runs share the same step-based plotting code as ML runs.
      const points: { key: string; value: number }[] = [
        { key: "train_loss · train", value: evt.train_loss },
        { key: "val_loss · val", value: evt.val_loss },
        { key: "val_acc · val", value: evt.val_acc },
      ];
      setMetricSeries((prev) => {
        const next = { ...prev };
        for (const p of points) {
          const existing = next[p.key] ?? { name: p.key, points: [] };
          next[p.key] = {
            ...existing,
            points: [...existing.points, { step: evt.epoch, value: p.value }],
          };
        }
        return next;
      });
    };

    const onComplete = (evt: CompleteEvent) => {
      if (evt.pipeline_id !== pipelineId) return;
      setStage("complete");
      setCompleted(evt);
      useNotifications.getState().push({
        kind: "training_done",
        title: "Training finished",
        body: evt.duration_s
          ? `Pipeline ${pipelineId.slice(0, 8)} completed in ${evt.duration_s}s.`
          : `Pipeline ${pipelineId.slice(0, 8)} just produced a new model version.`,
        href: `/pipelines/${pipelineId}`,
        ref_id: pipelineId,
      });
    };

    const onFailed = (evt: FailedEvent) => {
      if (evt.pipeline_id !== pipelineId) return;
      setStage("failed");
      setFailed(evt);
      useNotifications.getState().push({
        kind: "training_failed",
        title: "Training failed",
        body: `Pipeline ${pipelineId.slice(0, 8)} crashed during training.`,
        href: `/pipelines/${pipelineId}`,
        ref_id: pipelineId,
      });
    };

    // Re-enter the room on every (re)connect. The server forgets rooms
    // across disconnects, so without this we silently stop receiving
    // updates after any transient network blip.
    const joinRoom = () => socket.emit("join_pipeline", { pipeline_id: pipelineId });

    socket.on("training_progress", onProgress);
    socket.on("training_metric", onMetric);
    socket.on("training_epoch", onEpoch);
    socket.on("training_complete", onComplete);
    socket.on("training_failed", onFailed);
    socket.on("connect", joinRoom);
    if (socket.connected) joinRoom();

    return () => {
      socket.off("training_progress", onProgress);
      socket.off("training_metric", onMetric);
      socket.off("training_epoch", onEpoch);
      socket.off("training_complete", onComplete);
      socket.off("training_failed", onFailed);
      socket.off("connect", joinRoom);
      if (socket.connected) socket.emit("leave_pipeline", { pipeline_id: pipelineId });
    };
  }, [pipelineId]);

  const lastPct = progressPoints.length
    ? progressPoints[progressPoints.length - 1].pct
    : 0;

  const traces = useMemo(() => {
    // Plotly trace shapes vary by type (scatter / scattergl / bar / …);
    // typing them precisely just to push them into Plot is unnecessary churn.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const out: any[] = [];
    if (progressPoints.length > 0) {
      out.push({
        x: progressPoints.map((p) => p.t),
        y: progressPoints.map((p) => p.pct),
        type: "scatter",
        mode: "lines+markers",
        name: "Progress %",
        line: { color: "#d2541c", width: 2 },
        marker: { color: "#d2541c", size: 5 },
        yaxis: "y",
      });
    }
    Object.values(metricSeries).forEach((s, idx) => {
      const palette = ["#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7"];
      out.push({
        x: s.points.map((p) => p.step),
        y: s.points.map((p) => p.value),
        type: "scatter",
        mode: "lines+markers",
        name: s.name,
        line: { color: palette[idx % palette.length], width: 2 },
        marker: { color: palette[idx % palette.length], size: 6 },
        yaxis: "y2",
      });
    });
    return out;
  }, [progressPoints, metricSeries]);

  const stageLabel = prettyStage(stage);
  const accent =
    stage === "complete"
      ? "#10b981"
      : stage === "failed"
      ? "#ef4444"
      : "#d2541c";

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: "#fff",
        border: 1,
        borderColor: "divider",
        mb: 3,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ mb: 1.5 }}
      >
        {stage === "complete" ? (
          <CheckCircleIcon sx={{ color: accent }} />
        ) : stage === "failed" ? (
          <ErrorIcon sx={{ color: accent }} />
        ) : (
          <BoltIcon sx={{ color: accent }} />
        )}
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Live training
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip
          label={stageLabel}
          size="small"
          sx={{
            fontSize: "0.65rem",
            height: 22,
            bgcolor: alpha(accent, 0.1),
            color: accent,
            fontWeight: 700,
          }}
        />
      </Stack>

      <Box sx={{ mb: 1.5 }}>
        <LinearProgress
          variant="determinate"
          value={Math.max(0, Math.min(100, lastPct))}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(accent, 0.12),
            "& .MuiLinearProgress-bar": { bgcolor: accent, borderRadius: 3 },
          }}
        />
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", display: "block", mt: 0.5 }}
        >
          {lastPct}% · {progressPoints.length} updates received
        </Typography>
      </Box>

      {failed ? (
        <Typography variant="body2" sx={{ color: "#b91c1c" }}>
          Training failed: {failed.error}
        </Typography>
      ) : traces.length === 0 ? (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Waiting for the worker to publish progress…
        </Typography>
      ) : (
        <Plot
          data={traces}
          layout={{
            autosize: true,
            height,
            showlegend: true,
            margin: { l: 48, r: 48, t: 10, b: 36 },
            xaxis: {
              title: { text: "Time / Step" },
              gridcolor: alpha("#cbd5e1", 0.3),
              zeroline: false,
            },
            yaxis: {
              title: { text: "Progress %" },
              range: [0, 105],
              gridcolor: alpha("#cbd5e1", 0.3),
            },
            yaxis2: {
              title: { text: "Metric value" },
              overlaying: "y",
              side: "right",
              autorange: true,
              gridcolor: "transparent",
            },
            legend: { orientation: "h", y: -0.2 },
            plot_bgcolor: "transparent",
            paper_bgcolor: "transparent",
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height }}
          useResizeHandler
        />
      )}

      {completed && (
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", display: "block", mt: 1 }}
        >
          Completed in {completed.duration_s?.toFixed(1)}s · version{" "}
          {completed.version_id?.slice(0, 8) ?? "—"}
        </Typography>
      )}
    </Box>
  );
}
