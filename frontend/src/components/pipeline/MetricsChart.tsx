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
import { Box, Typography, alpha } from "@mui/material";
import type { ClassificationMetrics, ClusteringMetrics, ForecastMetrics, ModelMetrics, RegressionMetrics } from "../../types/model";
import { ShapImportanceChart } from "./ShapImportanceChart";

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

export function MetricsChart({ metrics }: Props) {
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
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>Classification Metrics</Typography>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={bars} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
            <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v: number) => `${(v * 100).toFixed(2)}%`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
            <Bar dataKey="value" fill="#6366f1" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>

        {featureData && !metrics.shap_importance && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2.5, fontWeight: 700 }}>Feature Importance (Top 10)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={featureData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
        {metrics.shap_importance && (
          <ShapImportanceChart importance={metrics.shap_importance} color="#8b5cf6" />
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
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>Regression Metrics</Typography>
        <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
          {[
            { label: "MAE", value: metrics.mae.toFixed(4) },
            { label: "RMSE", value: metrics.rmse.toFixed(4) },
            { label: "R\u00B2", value: metrics.r2.toFixed(4) },
          ].map((m) => (
            <Box key={m.label} sx={{ px: 2, py: 1.5, borderRadius: 3, bgcolor: alpha("#6366f1", 0.04), border: 1, borderColor: alpha("#6366f1", 0.1) }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>{m.label}</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{m.value}</Typography>
            </Box>
          ))}
        </Box>
        {featureData && !metrics.shap_importance && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, fontWeight: 700 }}>Feature Importance (Top 10)</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={featureData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
        {metrics.shap_importance && (
          <ShapImportanceChart importance={metrics.shap_importance} color="#10b981" />
        )}
      </Box>
    );
  }

  if (isClustering(metrics)) {
    return (
      <Box>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>Clustering Metrics</Typography>
        <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
          <Box sx={{ px: 2, py: 1.5, borderRadius: 3, bgcolor: alpha("#8b5cf6", 0.04), border: 1, borderColor: alpha("#8b5cf6", 0.1) }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>Clusters</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{metrics.n_clusters}</Typography>
          </Box>
          <Box sx={{ px: 2, py: 1.5, borderRadius: 3, bgcolor: alpha("#6366f1", 0.04), border: 1, borderColor: alpha("#6366f1", 0.1) }}>
            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>Inertia</Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{metrics.inertia.toFixed(2)}</Typography>
          </Box>
          {metrics.silhouette_score != null && (
            <Box sx={{ px: 2, py: 1.5, borderRadius: 3, bgcolor: alpha("#10b981", 0.04), border: 1, borderColor: alpha("#10b981", 0.1) }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>Silhouette</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{metrics.silhouette_score.toFixed(4)}</Typography>
            </Box>
          )}
        </Box>
        {metrics.elbow_data && metrics.elbow_data.length > 0 && (
          <>
            <Typography variant="subtitle2" gutterBottom sx={{ mt: 2, fontWeight: 700 }}>Elbow Curve</Typography>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={metrics.elbow_data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="k" label={{ value: "k", position: "insideBottom", offset: -5 }} />
                <YAxis />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
                <Line type="monotone" dataKey="inertia" stroke="#6366f1" dot={{ fill: "#6366f1", r: 4 }} strokeWidth={2} />
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
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
          Forecast — {metrics.periods_forecasted} periods ({metrics.freq})
        </Typography>
        <Box sx={{ display: "flex", gap: 3, mb: 2, flexWrap: "wrap" }}>
          {metrics.mae != null && (
            <Box sx={{ px: 2, py: 1.5, borderRadius: 3, bgcolor: alpha("#6366f1", 0.04), border: 1, borderColor: alpha("#6366f1", 0.1) }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>MAE</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{metrics.mae.toFixed(4)}</Typography>
            </Box>
          )}
          {metrics.mape != null && (
            <Box sx={{ px: 2, py: 1.5, borderRadius: 3, bgcolor: alpha("#8b5cf6", 0.04), border: 1, borderColor: alpha("#8b5cf6", 0.1) }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>MAPE</Typography>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>{metrics.mape.toFixed(2)}%</Typography>
            </Box>
          )}
        </Box>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={metrics.forecast_data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="ds" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }} />
            <Legend />
            <Line type="monotone" dataKey="yhat" stroke="#6366f1" dot={false} name="Forecast" strokeWidth={2} />
            <Line type="monotone" dataKey="yhat_lower" stroke={alpha("#8b5cf6", 0.4)} dot={false} strokeDasharray="4 2" name="Lower" />
            <Line type="monotone" dataKey="yhat_upper" stroke={alpha("#8b5cf6", 0.4)} dot={false} strokeDasharray="4 2" name="Upper" />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  }

  return <Typography variant="body2" color="text.secondary">No metrics available.</Typography>;
}
