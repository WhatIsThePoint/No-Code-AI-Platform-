import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Slider,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { datasetsApi } from "../../api/datasets";
import { useTaskStatus } from "../../hooks/useTaskStatus";
import type { Dataset, PreprocessingConfig } from "../../types/dataset";

const STEPS = ["Columns", "Strategies", "Split", "Run"];

interface Props {
  dataset: Dataset;
  onDone: (updated: Dataset) => void;
}

export function PreprocessingPanel({ dataset, onDone }: Props) {
  const columns = dataset.profiling_summary?.columns.map((c) => c.name) ?? [];

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
    <Box>
      <Stepper activeStep={step} sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Step 0: Column selection */}
      {step === 0 && (
        <Box>
          <Typography variant="h6" gutterBottom>Select Columns</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {columns.map((col) => (
              <FormControlLabel
                key={col}
                control={
                  <Checkbox
                    checked={included.includes(col)}
                    onChange={() => toggleColumn(col)}
                    size="small"
                  />
                }
                label={col}
              />
            ))}
          </Box>
          <FormControl fullWidth sx={{ mt: 2, maxWidth: 300 }}>
            <InputLabel>Target Column</InputLabel>
            <Select value={target} label="Target Column" onChange={(e) => setTarget(e.target.value)}>
              {included.map((col) => (
                <MenuItem key={col} value={col}>{col}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" sx={{ mt: 2 }} onClick={() => setStep(1)}>
            Next
          </Button>
        </Box>
      )}

      {/* Step 1: Strategies */}
      {step === 1 && (
        <Box sx={{ maxWidth: 400 }}>
          <Typography variant="h6" gutterBottom>Preprocessing Strategies</Typography>
          <FormControl fullWidth margin="normal">
            <InputLabel>Missing Value Imputation</InputLabel>
            <Select value={imputation} label="Missing Value Imputation" onChange={(e) => setImputation(e.target.value)}>
              <MenuItem value="mean">Mean</MenuItem>
              <MenuItem value="median">Median</MenuItem>
              <MenuItem value="mode">Mode</MenuItem>
              <MenuItem value="constant">Constant (0)</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Categorical Encoding</InputLabel>
            <Select value={encoding} label="Categorical Encoding" onChange={(e) => setEncoding(e.target.value)}>
              <MenuItem value="onehot">One-Hot</MenuItem>
              <MenuItem value="label">Label</MenuItem>
              <MenuItem value="ordinal">Ordinal</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Feature Scaling</InputLabel>
            <Select value={scaling} label="Feature Scaling" onChange={(e) => setScaling(e.target.value)}>
              <MenuItem value="standard">Standard Scaler</MenuItem>
              <MenuItem value="minmax">Min-Max</MenuItem>
              <MenuItem value="robust">Robust Scaler</MenuItem>
              <MenuItem value="none">None</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
            <Button onClick={() => setStep(0)}>Back</Button>
            <Button variant="contained" onClick={() => setStep(2)}>Next</Button>
          </Box>
        </Box>
      )}

      {/* Step 2: Split ratios */}
      {step === 2 && (
        <Box sx={{ maxWidth: 400 }}>
          <Typography variant="h6" gutterBottom>Train / Val / Test Split</Typography>
          <Typography variant="body2">Train: {splitRatios.train}%</Typography>
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
          <Typography variant="body2">Validation: {splitRatios.val}% · Test: {splitRatios.test}%</Typography>
          <Typography variant="caption" color="text.secondary">
            Total: {splitRatios.train + splitRatios.val + splitRatios.test}%
          </Typography>
          <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
            <Button onClick={() => setStep(1)}>Back</Button>
            <Button variant="contained" onClick={handleRun}>Run Preprocessing</Button>
          </Box>
        </Box>
      )}

      {/* Step 3: Running */}
      {step === 3 && (
        <Box>
          <Typography variant="h6" gutterBottom>Preprocessing in Progress</Typography>
          {result && (
            <Box sx={{ maxWidth: 400 }}>
              <Typography variant="body2">{result.status} — {result.progress_pct}%</Typography>
              <LinearProgress variant="determinate" value={result.progress_pct} sx={{ mt: 1 }} />
              {result.status === "failure" && (
                <Alert severity="error" sx={{ mt: 1 }}>{result.error_message}</Alert>
              )}
              {result.status === "success" && (
                <Alert severity="success" sx={{ mt: 1 }}>Preprocessing complete! Train/val/test splits saved.</Alert>
              )}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
