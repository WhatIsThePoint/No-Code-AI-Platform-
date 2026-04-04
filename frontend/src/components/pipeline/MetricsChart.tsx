import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Box, Typography } from "@mui/material";
import type { ClassificationMetrics, ClusteringMetrics, ForecastMetrics, ModelMetrics, RegressionMetrics } from "../../types/model";

interface Props {
  metrics: ModelMetrics;
  taskType: string;
}

function isClassification(m: ModelMetrics): m is ClassificationMetrics {
  return "accuracy" in m;
}

function isClustering(m: ModelMetrics): m is ClusteringMetrics {
  return "n_clusters" in m;
}

function isForecasting(m: ModelMetrics): m is ForecastMetrics {
  return "forecast_data" in m;
}

function isRegression(m: ModelMetrics): m is RegressionMetrics {
  return "mae" in m && "rmse" in m && "r2" in m;
}

export function MetricsChart({ metrics, taskType }: Props) {
  if (isClassification(metrics)) {
    const bars = [
      { name: "Accuracy", value: metrics.accuracy },
      { name: "Precision", value: metrics.precision },
      { name: "Recall", value: metrics.recall },
      { name: "F1", value: metrics.f1 },
      ...(metrics.roc_auc != null ? [{ name: "ROC-AUC", value: metrics.roc_auc }] : []),
    ];

    const featureData = metrics.feature_importance
      ? Object.entries(metrics.feature_importance)
          .slice(0, 10)
          .map(([name, value]) => ({ name, value }))
      : null;

    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>Classification Metrics</Typography>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bars} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `${(v * 100).toFixed(2)}%`} />
            <Bar dataKey="value" fill="#1976d2" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {featureData && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Feature Importance (Top 10)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={featureData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#9c27b0" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </Box>
    );
  }

  if (isRegression(metrics)) {
    const featureData = metrics.feature_importance
      ? Object.entries(metrics.feature_importance)
          .slice(0, 10)
          .map(([name, value]) => ({ name, value }))
      : null;

    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>Regression Metrics</Typography>
        <Typography variant="body2">MAE: <strong>{metrics.mae.toFixed(4)}</strong></Typography>
        <Typography variant="body2">RMSE: <strong>{metrics.rmse.toFixed(4)}</strong></Typography>
        <Typography variant="body2">R²: <strong>{metrics.r2.toFixed(4)}</strong></Typography>
        {featureData && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Feature Importance (Top 10)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={featureData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#2e7d32" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </Box>
    );
  }

  if (isClustering(metrics)) {
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>Clustering Metrics</Typography>
        <Typography variant="body2">Clusters: <strong>{metrics.n_clusters}</strong></Typography>
        <Typography variant="body2">Inertia: <strong>{metrics.inertia.toFixed(2)}</strong></Typography>
        {metrics.silhouette_score != null && (
          <Typography variant="body2">
            Silhouette Score: <strong>{metrics.silhouette_score.toFixed(4)}</strong>
          </Typography>
        )}
        {metrics.elbow_data && metrics.elbow_data.length > 0 && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>Elbow Curve</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metrics.elbow_data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="k" label={{ value: "k", position: "insideBottom", offset: -5 }} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="inertia" stroke="#1976d2" dot />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}
      </Box>
    );
  }

  if (isForecasting(metrics)) {
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom>
          Forecast — {metrics.periods_forecasted} periods ({metrics.freq})
        </Typography>
        {metrics.mae != null && (
          <Typography variant="body2">MAE: <strong>{metrics.mae.toFixed(4)}</strong></Typography>
        )}
        {metrics.mape != null && (
          <Typography variant="body2">MAPE: <strong>{metrics.mape.toFixed(2)}%</strong></Typography>
        )}
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={metrics.forecast_data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="ds" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="yhat" stroke="#1976d2" dot={false} name="Forecast" />
            <Line type="monotone" dataKey="yhat_lower" stroke="#90caf9" dot={false} strokeDasharray="4 2" name="Lower" />
            <Line type="monotone" dataKey="yhat_upper" stroke="#90caf9" dot={false} strokeDasharray="4 2" name="Upper" />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  }

  return <Typography variant="body2" color="text.secondary">No metrics available.</Typography>;
}
