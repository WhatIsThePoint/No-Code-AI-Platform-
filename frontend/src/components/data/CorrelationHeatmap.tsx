import { Box, Paper, Typography, alpha } from "@mui/material";
import InsightsIcon from "@mui/icons-material/InsightsRounded";
import { Plot } from "./plotly";
import type { CorrelationMatrix } from "../../types/dataset";

interface Props {
  matrix: CorrelationMatrix;
  truncated?: boolean;
}

export function CorrelationHeatmap({ matrix, truncated }: Props) {
  const size = Math.min(520, 120 + matrix.columns.length * 28);

  return (
    <Paper sx={{ p: 3, mb: 3, borderRadius: 4 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: "10px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <InsightsIcon sx={{ color: "#fff", fontSize: 18 }} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Feature Correlation
        </Typography>
      </Box>
      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
        Values close to <strong>+1</strong> or <strong>-1</strong> mean two columns move together —
        a sign of redundancy or, if one is your target, possible leakage.
        {truncated && " (First 25 numeric columns shown.)"}
      </Typography>
      <Box sx={{ width: "100%", overflowX: "auto" }}>
        <Plot
          data={[
            {
              type: "heatmap",
              z: matrix.values,
              x: matrix.columns,
              y: matrix.columns,
              zmin: -1,
              zmax: 1,
              colorscale: "RdBu",
              reversescale: true,
              hovertemplate: "%{y} × %{x}<br>r = %{z:.3f}<extra></extra>",
              colorbar: { thickness: 12, len: 0.8 },
            },
          ]}
          layout={{
            width: size,
            height: size,
            margin: { l: 90, r: 10, t: 10, b: 90 },
            xaxis: { tickangle: -45, tickfont: { size: 10 } },
            yaxis: { tickfont: { size: 10 }, autorange: "reversed" },
            plot_bgcolor: alpha("#f8fafc", 0.6),
            paper_bgcolor: "transparent",
          }}
          config={{ displayModeBar: false, responsive: true }}
        />
      </Box>
    </Paper>
  );
}
