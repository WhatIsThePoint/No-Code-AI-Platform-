import { Box, Typography, alpha } from "@mui/material";
import { Plot } from "../data/plotly";

interface Props {
  matrix: number[][];
  /** Optional class labels; defaults to 0,1,2… */
  labels?: (string | number)[];
  height?: number;
  title?: string;
}

/**
 * Sprint 7 Module 3 — confusion matrix heatmap.
 *
 * Plotly's `heatmap` trace gives us nicely shaded cells with per-cell text
 * annotations. Reads from the metrics dict that classification models
 * already return as `confusion_matrix`.
 */
export function ConfusionMatrixHeatmap({
  matrix,
  labels,
  height = 320,
  title = "Confusion matrix",
}: Props) {
  if (!matrix || matrix.length === 0) return null;

  const n = matrix.length;
  const ticks = labels && labels.length === n ? labels.map(String) : Array.from({ length: n }, (_, i) => `${i}`);

  const annotations = [] as any[];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      annotations.push({
        x: ticks[j],
        y: ticks[i],
        text: String(matrix[i][j]),
        showarrow: false,
        font: { color: "#0f172a", size: 12 },
      });
    }
  }

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
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block", mb: 1.5 }}
      >
        Rows = true labels, columns = predicted. Diagonal cells are correct
        predictions; off-diagonal are mistakes.
      </Typography>
      <Plot
        data={[
          {
            z: matrix,
            x: ticks,
            y: ticks,
            type: "heatmap",
            colorscale: [
              [0, "#eef2ff"],
              [0.5, "#a5b4fc"],
              [1, "#4338ca"],
            ],
            showscale: true,
            hovertemplate: "true %{y} → pred %{x}<br>count %{z}<extra></extra>",
          },
        ]}
        layout={{
          autosize: true,
          height,
          margin: { l: 60, r: 30, t: 10, b: 50 },
          xaxis: {
            title: { text: "Predicted" },
            tickfont: { size: 11 },
            gridcolor: alpha("#cbd5e1", 0.3),
            automargin: true,
          },
          yaxis: {
            title: { text: "True" },
            tickfont: { size: 11 },
            autorange: "reversed",
            gridcolor: alpha("#cbd5e1", 0.3),
            automargin: true,
          },
          annotations,
          plot_bgcolor: "transparent",
          paper_bgcolor: "transparent",
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: "100%", height }}
        useResizeHandler
      />
    </Box>
  );
}
