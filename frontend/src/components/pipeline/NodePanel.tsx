import {
  Box,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import StorageIcon from "@mui/icons-material/StorageRounded";
import ModelTrainingIcon from "@mui/icons-material/ModelTrainingRounded";
import AssessmentIcon from "@mui/icons-material/AssessmentRounded";
import { useState } from "react";
import type { PipelineNode, Algorithm, TaskType, TrainNodeData, DatasetNodeData } from "../../types/pipeline";
import type { Dataset } from "../../types/dataset";
import type { ModelVersion } from "../../types/model";
import { HyperparamControls, defaultHyperparams } from "./HyperparamControls";
import { MetricsChart } from "./MetricsChart";
import { NotesPanel } from "./NotesPanel";

interface Props {
  node: PipelineNode;
  pipelineId: string;
  datasets: Dataset[];
  latestVersion?: ModelVersion | null;
  onUpdate: (nodeId: string, patch: Partial<PipelineNode["data"]>) => void;
}

const ALGORITHMS: { value: Algorithm; label: string; taskType: TaskType }[] = [
  // Classification
  { value: "xgboost",           label: "XGBoost (Classification)",    taskType: "classification" },
  { value: "random_forest",     label: "Random Forest (Classifier)",  taskType: "classification" },
  { value: "gbm",               label: "GBM (Classifier)",            taskType: "classification" },
  { value: "glm",               label: "Logistic Regression (GLM)",   taskType: "classification" },
  { value: "lightgbm",          label: "LightGBM (Classifier)",       taskType: "classification" },
  { value: "catboost",          label: "CatBoost (Classifier)",       taskType: "classification" },
  // Regression
  { value: "xgboost_reg",       label: "XGBoost (Regression)",        taskType: "regression"     },
  { value: "random_forest_reg", label: "Random Forest (Regressor)",   taskType: "regression"     },
  { value: "gbm_reg",           label: "GBM (Regressor)",             taskType: "regression"     },
  { value: "ridge",             label: "Ridge Regression",            taskType: "regression"     },
  { value: "lightgbm_reg",      label: "LightGBM (Regressor)",        taskType: "regression"     },
  { value: "catboost_reg",      label: "CatBoost (Regressor)",        taskType: "regression"     },
  // Clustering & Forecasting
  { value: "kmeans",            label: "K-Means",                     taskType: "clustering"     },
  { value: "prophet",           label: "Prophet (Time Series)",       taskType: "forecasting"    },
];

export function NodePanel({ node, pipelineId, datasets, latestVersion, onUpdate }: Props) {
  const [tab, setTab] = useState(0);

  if (node.type === "dataset") {
    const d = node.data as DatasetNodeData;
    return (
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "8px",
              background: "linear-gradient(135deg, #d2541c, #a8401a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <StorageIcon sx={{ fontSize: 15, color: "#fff" }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Dataset Node</Typography>
        </Box>
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>Dataset</InputLabel>
          <Select
            value={d.dataset_id ?? ""}
            label="Dataset"
            onChange={(e) => {
              const ds = datasets.find((x) => x.dataset_id === e.target.value);
              onUpdate(node.node_id, { dataset_id: e.target.value, dataset_name: ds?.name });
            }}
          >
            {datasets.filter((ds) => ds.status === "preprocessed").map((ds) => (
              <MenuItem key={ds.dataset_id} value={ds.dataset_id}>{ds.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Divider sx={{ mb: 2 }} />
        <NotesPanel pipelineId={pipelineId} nodeId={node.node_id} />
      </Box>
    );
  }

  if (node.type === "train") {
    const d = node.data as TrainNodeData;
    const algo = d.algorithm ?? "xgboost";

    return (
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "8px",
              background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ModelTrainingIcon sx={{ fontSize: 15, color: "#fff" }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Train Node</Typography>
        </Box>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab label="Config" />
          <Tab label="Notes" />
        </Tabs>

        {tab === 0 && (
          <>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Algorithm</InputLabel>
              <Select
                value={algo}
                label="Algorithm"
                onChange={(e) => {
                  const newAlgo = e.target.value as Algorithm;
                  const match = ALGORITHMS.find((a) => a.value === newAlgo);
                  onUpdate(node.node_id, {
                    algorithm: newAlgo,
                    task_type: match?.taskType ?? "classification",
                    hyperparams: defaultHyperparams(newAlgo),
                  });
                }}
              >
                {ALGORITHMS.map((a) => (
                  <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {d.task_type !== "forecasting" && d.task_type !== "clustering" && (
              <TextField
                size="small"
                label="Target Column"
                value={d.target_column ?? ""}
                onChange={(e) => onUpdate(node.node_id, { target_column: e.target.value })}
                fullWidth
                sx={{ mb: 2 }}
              />
            )}

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Task: {d.task_type}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Hyperparameters</Typography>
            <HyperparamControls
              algorithm={algo as Algorithm}
              values={d.hyperparams ?? {}}
              onChange={(key, val) =>
                onUpdate(node.node_id, { hyperparams: { ...d.hyperparams, [key]: val } })
              }
            />
          </>
        )}

        {tab === 1 && <NotesPanel pipelineId={pipelineId} nodeId={node.node_id} />}
      </Box>
    );
  }

  if (node.type === "evaluate") {
    return (
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: "8px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <AssessmentIcon sx={{ fontSize: 15, color: "#fff" }} />
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Evaluate Node</Typography>
        </Box>
        {latestVersion && latestVersion.metrics && latestVersion.task_type ? (
          // The Evaluate node only renders for tabular runs; DL versions are
          // shown via DLPredictPanel under the canvas. Narrow defensively so
          // a fresh DL version never lands here without `task_type`.
          <MetricsChart
            metrics={latestVersion.metrics as import("../../types/model").ModelMetrics}
            taskType={latestVersion.task_type}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No trained model yet. Run the pipeline first.
          </Typography>
        )}
        <Divider sx={{ mt: 2, mb: 2 }} />
        <NotesPanel pipelineId={pipelineId} nodeId={node.node_id} />
      </Box>
    );
  }

  return null;
}
