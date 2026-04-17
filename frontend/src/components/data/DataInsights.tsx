import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Typography,
  alpha,
} from "@mui/material";
import InsightsIcon from "@mui/icons-material/InsightsRounded";
import CheckCircleIcon from "@mui/icons-material/CheckCircleRounded";
import WarningIcon from "@mui/icons-material/WarningAmberRounded";
import AutoGraphIcon from "@mui/icons-material/AutoGraphRounded";
import CategoryIcon from "@mui/icons-material/CategoryRounded";
import TrendingUpIcon from "@mui/icons-material/TrendingUpRounded";
import BubbleChartIcon from "@mui/icons-material/BubbleChartRounded";
import CleaningServicesIcon from "@mui/icons-material/CleaningServicesRounded";
import SettingsIcon from "@mui/icons-material/SettingsRounded";
import AssessmentIcon from "@mui/icons-material/AssessmentRounded";
import type { ProfilingSummary, ColumnProfile } from "../../types/dataset";

interface Props {
  summary: ProfilingSummary;
  rowCount?: number;
}

type TaskType = "classification" | "regression" | "clustering" | "unknown";

interface AlgorithmRec {
  name: string;
  description: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  bestFor: string[];
}

interface DataWarning {
  severity: "error" | "warning" | "info";
  message: string;
}

const NUMERIC_HINTS = ["int", "float", "number", "double"];

function isNumeric(dtype: string): boolean {
  return NUMERIC_HINTS.some((h) => dtype.toLowerCase().includes(h));
}

function computeQualityScore(summary: ProfilingSummary): number {
  let score = 100;
  score -= Math.min(summary.total_missing_pct, 40);
  if (summary.duplicate_rows > 0) score -= 5;
  const badColumns = summary.columns.filter((c) => c.missing_pct > 50).length;
  score -= badColumns * 3;
  return Math.max(0, Math.round(score));
}

function detectTaskType(summary: ProfilingSummary): {
  type: TaskType;
  targetGuess?: ColumnProfile;
  reason: string;
} {
  const cols = summary.columns;
  if (cols.length === 0) return { type: "unknown", reason: "No columns available" };

  // Heuristic: last column is often the target in tutorials
  const lastCol = cols[cols.length - 1];

  // Categorical target with small cardinality → classification
  if (!isNumeric(lastCol.dtype) && lastCol.unique_count >= 2 && lastCol.unique_count <= 50) {
    return {
      type: "classification",
      targetGuess: lastCol,
      reason: `"${lastCol.name}" has ${lastCol.unique_count} categories — looks like a classification target.`,
    };
  }

  // Numeric target with few unique values → likely classification (encoded labels)
  if (isNumeric(lastCol.dtype) && lastCol.unique_count <= 10) {
    return {
      type: "classification",
      targetGuess: lastCol,
      reason: `"${lastCol.name}" has only ${lastCol.unique_count} unique values — likely a classification label.`,
    };
  }

  // Numeric target with many unique values → regression
  if (isNumeric(lastCol.dtype) && lastCol.unique_count > 10) {
    return {
      type: "regression",
      targetGuess: lastCol,
      reason: `"${lastCol.name}" is a continuous number — looks like a regression target.`,
    };
  }

  // All numeric, no clear target → clustering
  if (cols.every((c) => isNumeric(c.dtype))) {
    return {
      type: "clustering",
      reason: "All columns are numeric with no clear label — good fit for clustering.",
    };
  }

  return {
    type: "unknown",
    reason: "Couldn't auto-detect the task type. Select a target column in the preprocessing step.",
  };
}

function getAlgorithms(task: TaskType): AlgorithmRec[] {
  switch (task) {
    case "classification":
      return [
        {
          name: "Logistic Regression",
          description: "A simple, fast model that works like a smart yes/no decision maker.",
          difficulty: "Beginner",
          bestFor: ["fast", "interpretable", "small data"],
        },
        {
          name: "Random Forest",
          description: "Combines many decision trees to get better accuracy out of the box.",
          difficulty: "Beginner",
          bestFor: ["robust", "no scaling needed", "handles missing"],
        },
        {
          name: "XGBoost",
          description: "A powerful boosted model that learns from its own mistakes — often tops Kaggle.",
          difficulty: "Intermediate",
          bestFor: ["high accuracy", "tabular data"],
        },
        {
          name: "SVM",
          description: "Finds the best boundary between categories. Good on small, clean datasets.",
          difficulty: "Advanced",
          bestFor: ["small data", "complex boundaries"],
        },
      ];
    case "regression":
      return [
        {
          name: "Linear Regression",
          description: "Draws the best-fit line through your data — the simplest place to start.",
          difficulty: "Beginner",
          bestFor: ["fast", "interpretable"],
        },
        {
          name: "Random Forest",
          description: "Handles complex patterns and mixed data types without much tuning.",
          difficulty: "Beginner",
          bestFor: ["robust", "no scaling needed"],
        },
        {
          name: "XGBoost",
          description: "A top-performing boosted model — a go-to for tabular regression.",
          difficulty: "Intermediate",
          bestFor: ["high accuracy", "tabular data"],
        },
      ];
    case "clustering":
      return [
        {
          name: "K-Means",
          description: "Groups similar data points into K clusters. Fast and easy to understand.",
          difficulty: "Beginner",
          bestFor: ["fast", "spherical clusters"],
        },
        {
          name: "DBSCAN",
          description: "Finds clusters of any shape automatically — no need to pick K.",
          difficulty: "Intermediate",
          bestFor: ["irregular shapes", "outlier detection"],
        },
      ];
    default:
      return [];
  }
}

function computeWarnings(summary: ProfilingSummary): DataWarning[] {
  const warnings: DataWarning[] = [];
  if (summary.total_missing_pct > 20) {
    warnings.push({
      severity: "warning",
      message: `Overall missing rate is ${summary.total_missing_pct}% — consider imputation or dropping sparse columns.`,
    });
  }
  if (summary.duplicate_rows > 0) {
    warnings.push({
      severity: "warning",
      message: `${summary.duplicate_rows} duplicate rows found — they may bias your model.`,
    });
  }
  const highMissing = summary.columns.filter((c) => c.missing_pct > 50);
  if (highMissing.length > 0) {
    warnings.push({
      severity: "error",
      message: `${highMissing.length} column(s) have more than 50% missing values — consider removing them.`,
    });
  }
  const constant = summary.columns.filter((c) => c.unique_count === 1);
  if (constant.length > 0) {
    warnings.push({
      severity: "warning",
      message: `${constant.length} column(s) contain a single value — they add no information.`,
    });
  }
  if (warnings.length === 0) {
    warnings.push({
      severity: "info",
      message: "No major data quality issues detected. You're ready to train.",
    });
  }
  return warnings;
}

const DIFFICULTY_COLORS: Record<AlgorithmRec["difficulty"], { bg: string; fg: string }> = {
  Beginner: { bg: alpha("#10b981", 0.12), fg: "#059669" },
  Intermediate: { bg: alpha("#f59e0b", 0.12), fg: "#b45309" },
  Advanced: { bg: alpha("#ef4444", 0.12), fg: "#b91c1c" },
};

const TASK_META: Record<
  TaskType,
  { label: string; icon: React.ComponentType<{ sx?: object }>; color: string }
> = {
  classification: { label: "Classification", icon: CategoryIcon, color: "#6366f1" },
  regression: { label: "Regression", icon: TrendingUpIcon, color: "#8b5cf6" },
  clustering: { label: "Clustering", icon: BubbleChartIcon, color: "#10b981" },
  unknown: { label: "Unknown", icon: AutoGraphIcon, color: "#64748b" },
};

export function DataInsights({ summary, rowCount }: Props) {
  const qualityScore = computeQualityScore(summary);
  const { type, targetGuess, reason } = detectTaskType(summary);
  const algorithms = getAlgorithms(type);
  const warnings = computeWarnings(summary);

  const qualityColor = qualityScore >= 80 ? "#10b981" : qualityScore >= 50 ? "#f59e0b" : "#ef4444";
  const TaskIcon = TASK_META[type].icon;

  return (
    <Box className="animate-fade-in">
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: "12px",
            background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <InsightsIcon sx={{ color: "#fff" }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Dataset Insights</Typography>
          <Typography variant="caption" color="text.secondary">
            Automatic analysis and model recommendations
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2.5} className="stagger-children">
        {/* Quality score */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Data Quality Score
              </Typography>
              <Box sx={{ position: "relative", display: "inline-flex", mt: 2 }}>
                <CircularProgress
                  variant="determinate"
                  value={100}
                  size={120}
                  thickness={5}
                  sx={{ color: alpha(qualityColor, 0.12) }}
                />
                <CircularProgress
                  variant="determinate"
                  value={qualityScore}
                  size={120}
                  thickness={5}
                  sx={{
                    color: qualityColor,
                    position: "absolute",
                    left: 0,
                    "& .MuiCircularProgress-circle": { strokeLinecap: "round" },
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                  }}
                >
                  <Typography variant="h4" sx={{ fontWeight: 800, color: qualityColor, lineHeight: 1 }}>
                    {qualityScore}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">/ 100</Typography>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mt: 2, color: "text.secondary" }}>
                {qualityScore >= 80
                  ? "Looking great — ready to train."
                  : qualityScore >= 50
                  ? "Decent, but some cleanup will help."
                  : "Needs work before training."}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Task detection */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Suggested Task Type
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: "12px",
                    background: `linear-gradient(135deg, ${TASK_META[type].color}, ${alpha(TASK_META[type].color, 0.7)})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TaskIcon sx={{ color: "#fff" }} />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>{TASK_META[type].label}</Typography>
                  {targetGuess && (
                    <Typography variant="caption" color="text.secondary">
                      Suggested target: <strong>{targetGuess.name}</strong>
                    </Typography>
                  )}
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {reason}
              </Typography>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Rows</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {rowCount?.toLocaleString() ?? "?"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Columns</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {summary.columns.length}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Missing</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {summary.total_missing_pct}%
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Warnings / findings */}
        <Grid item xs={12}>
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                Data Quality Findings
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {warnings.map((w, i) => {
                  const color = w.severity === "error" ? "#ef4444" : w.severity === "warning" ? "#f59e0b" : "#10b981";
                  const Icon = w.severity === "info" ? CheckCircleIcon : WarningIcon;
                  return (
                    <Box
                      key={i}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: alpha(color, 0.06),
                        border: 1,
                        borderColor: alpha(color, 0.15),
                      }}
                    >
                      <Icon sx={{ color, fontSize: 20 }} />
                      <Typography variant="body2" sx={{ color: "text.primary" }}>
                        {w.message}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Algorithm recommendations */}
        {algorithms.length > 0 && (
          <Grid item xs={12}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Recommended Algorithms
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Based on your data, these models are likely to work well. Start with a beginner option,
              then try intermediate ones if you want more accuracy.
            </Typography>
            <Grid container spacing={2}>
              {algorithms.map((alg) => {
                const diff = DIFFICULTY_COLORS[alg.difficulty];
                return (
                  <Grid item xs={12} sm={6} md={4} key={alg.name}>
                    <Card sx={{ height: "100%" }}>
                      <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            {alg.name}
                          </Typography>
                          <Chip
                            label={alg.difficulty}
                            size="small"
                            sx={{
                              bgcolor: diff.bg,
                              color: diff.fg,
                              fontWeight: 600,
                              fontSize: "0.65rem",
                              height: 20,
                            }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
                          {alg.description}
                        </Typography>
                        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                          {alg.bestFor.map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: "0.6rem", height: 18 }}
                            />
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Grid>
        )}

        {/* Next steps flow */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              borderRadius: 4,
              background: `linear-gradient(135deg, ${alpha("#6366f1", 0.04)}, ${alpha("#8b5cf6", 0.04)})`,
              border: 1,
              borderColor: alpha("#6366f1", 0.15),
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
              What happens next?
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                flexWrap: "wrap",
                justifyContent: { xs: "flex-start", md: "space-between" },
              }}
            >
              {[
                { icon: CleaningServicesIcon, label: "Preprocess", desc: "Clean & split", color: "#6366f1" },
                { icon: SettingsIcon, label: "Build Pipeline", desc: "Drag nodes", color: "#8b5cf6" },
                { icon: AutoGraphIcon, label: "Train", desc: "Run the model", color: "#ec4899" },
                { icon: AssessmentIcon, label: "Evaluate", desc: "See metrics", color: "#10b981" },
              ].map((step, i, arr) => (
                <Box key={step.label} sx={{ display: "flex", alignItems: "center", gap: 1.5, flex: 1, minWidth: 140 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: "12px",
                        background: `linear-gradient(135deg, ${step.color}, ${alpha(step.color, 0.7)})`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <step.icon sx={{ color: "#fff", fontSize: 20 }} />
                    </Box>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                        {step.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {step.desc}
                      </Typography>
                    </Box>
                  </Box>
                  {i < arr.length - 1 && (
                    <Typography sx={{ color: alpha("#6366f1", 0.4), fontSize: 20, display: { xs: "none", sm: "block" } }}>
                      →
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
