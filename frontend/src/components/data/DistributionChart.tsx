import { Box } from "@mui/material";
import { Plot } from "./plotly";
import type { ColumnHistogram } from "../../types/dataset";

interface Props {
  histogram: ColumnHistogram;
  color?: string;
}

export function DistributionChart({ histogram, color = "#6366f1" }: Props) {
  const { bins, counts } = histogram;
  const centers = counts.map((_, i) => (bins[i] + bins[i + 1]) / 2);
  const widths = counts.map((_, i) => bins[i + 1] - bins[i]);

  return (
    <Box sx={{ width: "100%", height: 110, mt: 1 }}>
      <Plot
        data={[
          {
            type: "bar",
            x: centers,
            y: counts,
            width: widths,
            marker: { color, line: { width: 0 } },
            hovertemplate: "%{x:.2f}<br>count: %{y}<extra></extra>",
          },
        ]}
        layout={{
          autosize: true,
          margin: { l: 28, r: 6, t: 4, b: 20 },
          bargap: 0.02,
          xaxis: { tickfont: { size: 9 }, showgrid: false },
          yaxis: { tickfont: { size: 9 }, showgrid: false, zeroline: false },
          plot_bgcolor: "transparent",
          paper_bgcolor: "transparent",
          showlegend: false,
        }}
        config={{ displayModeBar: false, responsive: true, staticPlot: true }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </Box>
  );
}
