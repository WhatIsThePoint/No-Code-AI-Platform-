import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Typography,
  alpha,
} from "@mui/material";
import LightbulbIcon from "@mui/icons-material/LightbulbRounded";
import ArrowForwardIcon from "@mui/icons-material/ArrowForwardRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { datasetsApi } from "../../api/datasets";
import { useTaskStatus } from "../../hooks/useTaskStatus";
import type { ColumnProfile, Dataset, PreprocessingConfig } from "../../types/dataset";

const STEPS = ["Columns", "Strategies", "Split", "Run"];

const IMPUTATION_HINTS: Record<string, string> = {
  mean: "Fills missing numbers with the average value of the column. Best for roughly symmetric data.",
  median: "Fills missing numbers with the middle value. Better than mean when your data has outliers.",
  mode: "Fills missing values with the most common value. Works for text categories and numbers.",
  constant: "Fills every missing value with 0. Use when missing means 'none' or 'zero'.",
};

const ENCODING_HINTS: Record<string, string> = {
  onehot: "Creates a yes/no column per category (Color=Red → Red:1, Blue:0). Best when categories have no natural order.",
  label: "Converts each category to an integer (Red=0, Blue=1, Green=2). Compact but may imply an order.",
  ordinal: "Like label encoding — assigns ordered integers. Use when categories have a real order (Low < Medium < High).",
};

const SCALING_HINTS: Record<string, string> = {
  standard: "Centers values around 0 with unit variance. A safe default for most algorithms.",
  minmax: "Squeezes all values between 0 and 1. Great for neural networks and distance-based models.",
  robust: "Similar to standard but ignores outliers. Use when your data has extreme values.",
  none: "Keep original values. Fine for tree models (Random Forest, XGBoost) that don't need scaling.",
};

// ── Profiler-driven suggestions ──────────────────────────────────────────────
// Thresholds calibrated against the sample datasets: 20% nulls is enough to
// hurt mean imputation, |skew| > 1.5 is the classical "consider transform"
// cutoff, and >50 unique values for a categorical column is where one-hot
// starts to balloon (the OOM bug we hit earlier was 181k uniques).

const NULL_THRESHOLD = 20; // pct
const SKEW_THRESHOLD = 1.5;
const HIGH_CARDINALITY = 50;

interface Suggestion {
  id: string;
  kind: "missing" | "skew" | "log" | "cardinality";
  column: string;
  i18nKey: string;
  values: Record<string, string | number>;
}

function buildSuggestions(columns: ColumnProfile[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const c of columns) {
    if (c.missing_pct >= NULL_THRESHOLD) {
      out.push({
        id: `missing-${c.name}`,
        kind: "missing",
        column: c.name,
        i18nKey: "preprocessingSuggestions.highMissing",
        values: { column: c.name, pct: c.missing_pct.toFixed(1) },
      });
    }
    if (c.needs_log_transform) {
      out.push({
        id: `log-${c.name}`,
        kind: "log",
        column: c.name,
        i18nKey: "preprocessingSuggestions.needsLogTransform",
        values: { column: c.name },
      });
    } else if (c.skewness !== undefined && Math.abs(c.skewness) >= SKEW_THRESHOLD) {
      out.push({
        id: `skew-${c.name}`,
        kind: "skew",
        column: c.name,
        i18nKey: "preprocessingSuggestions.highSkew",
        values: { column: c.name, value: c.skewness.toFixed(2) },
      });
    }
    // Categorical / object columns with extreme cardinality ahead of one-hot.
    const isCategorical = c.dtype === "object" || c.dtype === "string" || c.dtype === "category";
    if (isCategorical && c.unique_count > HIGH_CARDINALITY) {
      out.push({
        id: `cardinality-${c.name}`,
        kind: "cardinality",
        column: c.name,
        i18nKey: "preprocessingSuggestions.highCardinality",
        values: { column: c.name, unique: c.unique_count },
      });
    }
  }
  // Cap to keep the chip strip readable on busy datasets.
  return out.slice(0, 6);
}

function SuggestionsBar({ columns }: { columns: ColumnProfile[] }) {
  const { t } = useTranslation();
  const all = useMemo(() => buildSuggestions(columns), [columns]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const visible = all.filter((s) => !dismissed.has(s.id));
  if (visible.length === 0) return null;

  const palette: Record<Suggestion["kind"], { bg: string; border: string; ink: string }> = {
    missing: { bg: alpha("#f59e0b", 0.08), border: alpha("#f59e0b", 0.45), ink: "#92400e" },
    skew: { bg: alpha("#0ea5e9", 0.08), border: alpha("#0ea5e9", 0.45), ink: "#0369a1" },
    log: { bg: alpha("#0ea5e9", 0.08), border: alpha("#0ea5e9", 0.45), ink: "#0369a1" },
    cardinality: { bg: alpha("#ef4444", 0.08), border: alpha("#ef4444", 0.45), ink: "#991b1b" },
  };

  return (
    <Box sx={{ mb: 2.5 }} role="region" aria-label={t("preprocessingSuggestions.title")}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "text.secondary",
          display: "block",
          mb: 1,
        }}
      >
        💡 {t("preprocessingSuggestions.title")}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
        {visible.map((s) => {
          const c = palette[s.kind];
          return (
            <Chip
              key={s.id}
              label={t(s.i18nKey, s.values)}
              onDelete={() => setDismissed((prev) => new Set(prev).add(s.id))}
              deleteIcon={
                <IconButton
                  size="small"
                  aria-label={t("preprocessingSuggestions.dismissAria")}
                  sx={{ p: 0, color: "inherit" }}
                >
                  <CloseRoundedIcon sx={{ fontSize: 14 }} />
                </IconButton>
              }
              sx={{
                bgcolor: c.bg,
                border: 1,
                borderColor: c.border,
                color: c.ink,
                fontWeight: 500,
                fontSize: "0.75rem",
                height: "auto",
                py: 0.5,
                "& .MuiChip-label": { whiteSpace: "normal", lineHeight: 1.4, py: 0.25 },
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
}


function StrategyHint({ text }: { text: string }) {
  return (
    <Typography
      variant="body2"
      sx={{
        color: "text.secondary",
        mt: 0.75,
        pl: 1.5,
        borderLeft: `3px solid ${alpha("#d2541c", 0.3)}`,
        fontSize: "0.8rem",
        lineHeight: 1.5,
      }}
    >
      {text}
    </Typography>
  );
}

interface Props {
  dataset: Dataset;
  onDone: (updated: Dataset) => void;
}

export function PreprocessingPanel({ dataset, onDone }: Props) {
  const columns = dataset.profiling_summary?.columns.map((c) => c.name) ?? [];
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [included, setIncluded] = useState<string[]>(columns);
  const [target, setTarget] = useState(columns[columns.length - 1] ?? "");
  const [imputation, setImputation] = useState("mean");
  const [encoding, setEncoding] = useState("onehot");
  const [scaling, setScaling] = useState("standard");
  const [splitRatios, setSplitRatios] = useState({ train: 70, val: 15, test: 15 });
  const [taskId, setTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { result } = useTaskStatus(taskId);

  const handleRun = async () => {
    setError(null);
    const config: PreprocessingConfig = {
      target_column: target,
      included_columns: included,
      excluded_columns: columns.filter((c) => !included.includes(c)),
      imputation_strategy: imputation as PreprocessingConfig["imputation_strategy"],
      encoding_strategy: encoding as PreprocessingConfig["encoding_strategy"],
      scaling_strategy: scaling as PreprocessingConfig["scaling_strategy"],
      split_ratios: {
        train: splitRatios.train / 100,
        val: splitRatios.val / 100,
        test: splitRatios.test / 100,
      },
    };
    try {
      const { data } = await datasetsApi.preprocess(dataset.dataset_id, config);
      setTaskId(data.task_id);
      setStep(3);
    } catch {
      setError("Failed to start preprocessing");
    }
  };

  if (result?.status === "success") {
    datasetsApi.get(dataset.dataset_id).then(({ data }) => onDone(data));
  }

  const toggleColumn = (col: string) => {
    setIncluded((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  return (
    <Box className="animate-fade-in">
      {/* Why preprocessing exists */}
      <Alert
        icon={<LightbulbIcon />}
        severity="info"
        sx={{
          mb: 3,
          bgcolor: alpha("#d2541c", 0.04),
          border: 1,
          borderColor: alpha("#d2541c", 0.15),
          "& .MuiAlert-icon": { color: "#d2541c" },
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Why preprocessing?
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
          Machine learning models can't read messy spreadsheets — they need clean numbers. Preprocessing
          fills missing values, turns text into numbers, and scales everything so models can learn patterns.
          Once done, your data moves to the pipeline editor where you connect it to a training model.
        </Typography>
      </Alert>

      <Stepper activeStep={step} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Step 0: Column selection */}
      {step === 0 && (
        <Paper sx={{ p: 3, borderRadius: 4 }} className="animate-fade-in">
          <SuggestionsBar columns={dataset.profiling_summary?.columns ?? []} />
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Select Columns</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Choose which columns feed into the model, and pick your <strong>target column</strong> —
            the value you want to predict. Remove identifier columns (IDs, names, timestamps) since they
            don't help the model learn patterns.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {columns.map((col) => (
              <FormControlLabel
                key={col}
                control={
                  <Checkbox
                    checked={included.includes(col)}
                    onChange={() => toggleColumn(col)}
                    size="small"
                    sx={{ "&.Mui-checked": { color: "#d2541c" } }}
                  />
                }
                label={<Typography variant="body2">{col}</Typography>}
                sx={{
                  mr: 1,
                  px: 1,
                  borderRadius: 2,
                  bgcolor: included.includes(col) ? alpha("#d2541c", 0.04) : "transparent",
                  transition: "background 0.2s",
                }}
              />
            ))}
          </Box>
          <FormControl fullWidth sx={{ mt: 2.5, maxWidth: 300 }}>
            <InputLabel>Target Column</InputLabel>
            <Select value={target} label="Target Column" onChange={(e) => setTarget(e.target.value)}>
              {included.map((col) => (
                <MenuItem key={col} value={col}>{col}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <StrategyHint text="Example: to predict house prices, pick 'price'. To predict churn, pick 'churned'." />
          <Button variant="contained" sx={{ mt: 2.5 }} onClick={() => setStep(1)}>
            Next
          </Button>
        </Paper>
      )}

      {/* Step 1: Strategies */}
      {step === 1 && (
        <Paper sx={{ p: 3, maxWidth: 500, borderRadius: 4 }} className="animate-fade-in">
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Preprocessing Strategies</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Each dropdown handles a common data problem. The hint under each option explains what it does.
          </Typography>

          <FormControl fullWidth margin="normal">
            <InputLabel>Missing Value Imputation</InputLabel>
            <Select value={imputation} label="Missing Value Imputation" onChange={(e) => setImputation(e.target.value)}>
              <MenuItem value="mean">Mean</MenuItem>
              <MenuItem value="median">Median</MenuItem>
              <MenuItem value="mode">Mode</MenuItem>
              <MenuItem value="constant">Constant (0)</MenuItem>
            </Select>
          </FormControl>
          <StrategyHint text={IMPUTATION_HINTS[imputation]} />

          <FormControl fullWidth margin="normal" sx={{ mt: 2 }}>
            <InputLabel>Categorical Encoding</InputLabel>
            <Select value={encoding} label="Categorical Encoding" onChange={(e) => setEncoding(e.target.value)}>
              <MenuItem value="onehot">One-Hot</MenuItem>
              <MenuItem value="label">Label</MenuItem>
              <MenuItem value="ordinal">Ordinal</MenuItem>
            </Select>
          </FormControl>
          <StrategyHint text={ENCODING_HINTS[encoding]} />

          <FormControl fullWidth margin="normal" sx={{ mt: 2 }}>
            <InputLabel>Feature Scaling</InputLabel>
            <Select value={scaling} label="Feature Scaling" onChange={(e) => setScaling(e.target.value)}>
              <MenuItem value="standard">Standard Scaler</MenuItem>
              <MenuItem value="minmax">Min-Max</MenuItem>
              <MenuItem value="robust">Robust Scaler</MenuItem>
              <MenuItem value="none">None</MenuItem>
            </Select>
          </FormControl>
          <StrategyHint text={SCALING_HINTS[scaling]} />

          <Box sx={{ mt: 3, display: "flex", gap: 1 }}>
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(2)}>Next</Button>
          </Box>
        </Paper>
      )}

      {/* Step 2: Split ratios */}
      {step === 2 && (
        <Paper sx={{ p: 3, maxWidth: 500, borderRadius: 4 }} className="animate-fade-in">
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Train / Validation / Test Split</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Your data gets split into three parts: <strong>Train</strong> (the model learns from this),
            <strong> Validation</strong> (tunes the model during training), and <strong>Test</strong> (a
            final exam the model has never seen). This prevents the model from just memorizing answers.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            {[
              { label: "Train", value: splitRatios.train, color: "#d2541c" },
              { label: "Val", value: splitRatios.val, color: "#8b5cf6" },
              { label: "Test", value: splitRatios.test, color: "#10b981" },
            ].map((s) => (
              <Box
                key={s.label}
                sx={{
                  flex: 1,
                  textAlign: "center",
                  py: 1.5,
                  borderRadius: 3,
                  bgcolor: alpha(s.color, 0.06),
                  border: 1,
                  borderColor: alpha(s.color, 0.15),
                }}
              >
                <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{s.label}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: s.color }}>{s.value}%</Typography>
              </Box>
            ))}
          </Box>
          <Slider
            value={splitRatios.train}
            min={50}
            max={90}
            step={5}
            onChange={(_, v) => {
              const train = v as number;
              const remaining = 100 - train;
              setSplitRatios({ train, val: Math.round(remaining / 2), test: remaining - Math.round(remaining / 2) });
            }}
          />
          <StrategyHint text="70/15/15 is a safe default. If you have very little data (under 1,000 rows), try 80/10/10." />
          <Box sx={{ mt: 2.5, display: "flex", gap: 1 }}>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button variant="contained" onClick={handleRun}>Run Preprocessing</Button>
          </Box>
        </Paper>
      )}

      {/* Step 3: Running */}
      {step === 3 && (
        <Paper sx={{ p: 3, maxWidth: 500, borderRadius: 4 }} className="animate-fade-in">
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Preprocessing in Progress</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
            Your data is being cleaned and split. Once complete, head to the pipeline editor to connect
            it to a training node.
          </Typography>
          {result && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "#8b5cf6", mb: 0.5 }}>
                {result.status} — {result.progress_pct}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={result.progress_pct}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: alpha("#8b5cf6", 0.1),
                  "& .MuiLinearProgress-bar": {
                    borderRadius: 3,
                    background: "linear-gradient(90deg, #d2541c, #8b5cf6)",
                  },
                }}
              />
              {result.status === "failure" && (
                <Alert severity="error" sx={{ mt: 1.5 }}>{result.error_message}</Alert>
              )}
              {result.status === "success" && (
                <>
                  <Alert severity="success" sx={{ mt: 1.5 }}>
                    Preprocessing complete! Train/val/test splits are saved and ready to train.
                  </Alert>
                  <Button
                    variant="contained"
                    endIcon={<ArrowForwardIcon />}
                    onClick={() => navigate("/pipelines")}
                    sx={{
                      mt: 2,
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      textTransform: "none",
                    }}
                  >
                    Go to Pipelines
                  </Button>
                </>
              )}
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
}
