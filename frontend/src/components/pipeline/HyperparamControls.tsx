import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Typography,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import type { Algorithm } from "../../types/pipeline";

interface Props {
  algorithm: Algorithm;
  values: Record<string, number | string | boolean>;
  onChange: (key: string, value: number | string | boolean) => void;
}

type SliderParam = { type: "slider"; label: string; min: number; max: number; step: number; default: number };
type SelectParam = { type: "select"; label: string; options: string[]; default: string };
type CheckboxParam = { type: "checkbox"; label: string; default: boolean };
type ParamDef = SliderParam | SelectParam | CheckboxParam;

const PARAMS: Record<Algorithm, Record<string, ParamDef>> = {
  xgboost: {
    n_estimators:  { type: "slider", label: "Trees",          min: 50,   max: 500,  step: 10,   default: 100 },
    max_depth:     { type: "slider", label: "Max Depth",      min: 3,    max: 10,   step: 1,    default: 6   },
    learning_rate: { type: "slider", label: "Learning Rate",  min: 0.01, max: 0.3,  step: 0.01, default: 0.1 },
    subsample:     { type: "slider", label: "Subsample",      min: 0.5,  max: 1.0,  step: 0.05, default: 0.8 },
  },
  random_forest: {
    n_estimators:     { type: "slider", label: "Trees",            min: 50, max: 500, step: 10, default: 100 },
    max_depth:        { type: "slider", label: "Max Depth",         min: 3,  max: 20,  step: 1,  default: 10  },
    min_samples_split:{ type: "slider", label: "Min Samples Split", min: 2,  max: 10,  step: 1,  default: 2   },
  },
  gbm: {
    n_estimators:  { type: "slider", label: "Boosting Rounds", min: 50,   max: 500,  step: 10,   default: 100 },
    max_depth:     { type: "slider", label: "Max Depth",        min: 2,    max: 8,    step: 1,    default: 3   },
    learning_rate: { type: "slider", label: "Learning Rate",    min: 0.01, max: 0.3,  step: 0.01, default: 0.1 },
    subsample:     { type: "slider", label: "Subsample",        min: 0.5,  max: 1.0,  step: 0.05, default: 1.0 },
  },
  glm: {
    C:        { type: "slider", label: "Regularization (C)", min: 0.01, max: 10,   step: 0.01, default: 1.0 },
    max_iter: { type: "slider", label: "Max Iterations",     min: 100,  max: 1000, step: 50,   default: 200 },
    solver:   { type: "select", label: "Solver",             options: ["lbfgs", "liblinear", "saga"], default: "lbfgs" },
  },
  lightgbm: {
    n_estimators:  { type: "slider", label: "Iterations",    min: 50,   max: 500, step: 10,   default: 100 },
    max_depth:     { type: "slider", label: "Max Depth",      min: -1,   max: 15,  step: 1,    default: -1  },
    learning_rate: { type: "slider", label: "Learning Rate",  min: 0.01, max: 0.3, step: 0.01, default: 0.1 },
    num_leaves:    { type: "slider", label: "Num Leaves",     min: 10,   max: 100, step: 5,    default: 31  },
  },
  catboost: {
    iterations:    { type: "slider", label: "Iterations",    min: 50,   max: 500, step: 10,   default: 100 },
    depth:         { type: "slider", label: "Tree Depth",     min: 3,    max: 10,  step: 1,    default: 6   },
    learning_rate: { type: "slider", label: "Learning Rate",  min: 0.01, max: 0.3, step: 0.01, default: 0.1 },
  },
  xgboost_reg: {
    n_estimators:  { type: "slider", label: "Trees",          min: 50,   max: 500,  step: 10,   default: 100 },
    max_depth:     { type: "slider", label: "Max Depth",      min: 3,    max: 10,   step: 1,    default: 6   },
    learning_rate: { type: "slider", label: "Learning Rate",  min: 0.01, max: 0.3,  step: 0.01, default: 0.1 },
    subsample:     { type: "slider", label: "Subsample",      min: 0.5,  max: 1.0,  step: 0.05, default: 0.8 },
  },
  random_forest_reg: {
    n_estimators:     { type: "slider", label: "Trees",             min: 50, max: 500, step: 10, default: 100 },
    max_depth:        { type: "slider", label: "Max Depth",         min: 3,  max: 20,  step: 1,  default: 10  },
    min_samples_split:{ type: "slider", label: "Min Samples Split", min: 2,  max: 10,  step: 1,  default: 2   },
  },
  gbm_reg: {
    n_estimators:  { type: "slider", label: "Boosting Rounds", min: 50,   max: 500,  step: 10,   default: 100 },
    max_depth:     { type: "slider", label: "Max Depth",       min: 2,    max: 8,    step: 1,    default: 3   },
    learning_rate: { type: "slider", label: "Learning Rate",   min: 0.01, max: 0.3,  step: 0.01, default: 0.1 },
    subsample:     { type: "slider", label: "Subsample",       min: 0.5,  max: 1.0,  step: 0.05, default: 1.0 },
  },
  ridge: {
    alpha: { type: "slider", label: "Alpha (Regularization)", min: 0.01, max: 100, step: 0.01, default: 1.0 },
  },
  lightgbm_reg: {
    n_estimators:  { type: "slider", label: "Iterations",    min: 50,   max: 500, step: 10,   default: 100 },
    max_depth:     { type: "slider", label: "Max Depth",     min: -1,   max: 15,  step: 1,    default: -1  },
    learning_rate: { type: "slider", label: "Learning Rate", min: 0.01, max: 0.3, step: 0.01, default: 0.1 },
    num_leaves:    { type: "slider", label: "Num Leaves",    min: 10,   max: 100, step: 5,    default: 31  },
  },
  catboost_reg: {
    iterations:    { type: "slider", label: "Iterations",    min: 50,   max: 500, step: 10,   default: 100 },
    depth:         { type: "slider", label: "Tree Depth",    min: 3,    max: 10,  step: 1,    default: 6   },
    learning_rate: { type: "slider", label: "Learning Rate", min: 0.01, max: 0.3, step: 0.01, default: 0.1 },
  },
  kmeans: {
    n_clusters:    { type: "slider",   label: "Clusters",     min: 2,  max: 20, step: 1, default: 3 },
    compute_elbow: { type: "checkbox", label: "Compute Elbow (k=2–10)",  default: false },
  },
  prophet: {
    periods:           { type: "slider", label: "Forecast Periods",    min: 7,   max: 365, step: 7, default: 30 },
    freq:              { type: "select", label: "Frequency",           options: ["D", "W", "M"], default: "D" },
    seasonality_mode:  { type: "select", label: "Seasonality Mode",    options: ["additive", "multiplicative"], default: "additive" },
  },
};

export function HyperparamControls({ algorithm, values, onChange }: Props) {
  const params = PARAMS[algorithm] ?? {};

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {Object.entries(params).map(([key, def]) => {
        const current = values[key] ?? def.default;

        if (def.type === "slider") {
          return (
            <Box key={key}>
              <Typography variant="body2" gutterBottom>
                {def.label}: <strong>{current}</strong>
              </Typography>
              <Slider
                value={Number(current)}
                min={def.min}
                max={def.max}
                step={def.step}
                onChange={(_, v) => onChange(key, v as number)}
                size="small"
              />
            </Box>
          );
        }

        if (def.type === "select") {
          return (
            <FormControl key={key} size="small" fullWidth>
              <InputLabel>{def.label}</InputLabel>
              <Select
                value={String(current)}
                label={def.label}
                onChange={(e) => onChange(key, e.target.value)}
              >
                {def.options.map((opt) => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>
          );
        }

        if (def.type === "checkbox") {
          return (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  checked={Boolean(current)}
                  onChange={(e) => onChange(key, e.target.checked)}
                  size="small"
                />
              }
              label={def.label}
            />
          );
        }

        return null;
      })}
    </Box>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function defaultHyperparams(algorithm: Algorithm): Record<string, number | string | boolean> {
  const params = PARAMS[algorithm] ?? {};
  return Object.fromEntries(Object.entries(params).map(([k, def]) => [k, def.default]));
}
