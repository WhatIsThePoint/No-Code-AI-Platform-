import { Box, Tooltip, Typography, alpha } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Plot } from "../data/plotly";
import type { ResidualPoint } from "../../types/model";

interface Props {
  points: ResidualPoint[];
  color?: string;
}

export function ResidualPlot({ points, color = "#6366f1" }: Props) {
  if (!points || points.length === 0) return null;

  const xs = points.map((p) => p.y_pred);
  const ys = points.map((p) => p.y_true - p.y_pred);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Residuals vs. Predicted
        </Typography>
        <Tooltip
          arrow
          title="A random cloud around zero = good fit. A curved or funnel pattern = the model is missing structure."
        >
          <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
        </Tooltip>
      </Box>
      <Box sx={{ width: "100%", height: 280 }}>
        <Plot
          data={[
            {
              type: "scattergl",
              mode: "markers",
              x: xs,
              y: ys,
              marker: { color, size: 6, opacity: 0.55, line: { width: 0 } },
              hovertemplate: "ŷ: %{x:.3f}<br>residual: %{y:.3f}<extra></extra>",
              name: "residual",
            },
            {
              type: "scatter",
              mode: "lines",
              x: [xMin, xMax],
              y: [0, 0],
              line: { color: "#94a3b8", width: 1, dash: "dash" },
              hoverinfo: "skip",
              showlegend: false,
            },
          ]}
          layout={{
            autosize: true,
            margin: { l: 50, r: 20, t: 8, b: 40 },
            xaxis: { title: { text: "Predicted (ŷ)" }, tickfont: { size: 10 }, zeroline: false },
            yaxis: { title: { text: "Residual (y − ŷ)" }, tickfont: { size: 10 }, zeroline: false },
            plot_bgcolor: alpha("#f8fafc", 0.4),
            paper_bgcolor: "transparent",
            showlegend: false,
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: "100%" }}
          useResizeHandler
        />
      </Box>
    </Box>
  );
}
