import { Box, Tooltip, Typography, alpha } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Plot } from "../data/plotly";

interface Props {
  importance: Record<string, number>;
  color?: string;
}

export function ShapImportanceChart({ importance, color = "#8b5cf6" }: Props) {
  const entries = Object.entries(importance).slice(0, 10).reverse();
  const features = entries.map(([name]) => name);
  const values = entries.map(([, v]) => v);

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 2.5, mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          SHAP Global Importance
        </Typography>
        <Tooltip
          arrow
          title="Features at the top had the biggest impact on the model's predictions (mean |SHAP value|)."
        >
          <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
        </Tooltip>
      </Box>
      <Box sx={{ width: "100%", height: 240 }}>
        <Plot
          data={[
            {
              type: "bar",
              orientation: "h",
              x: values,
              y: features,
              marker: { color },
              hovertemplate: "%{y}<br>mean |SHAP|: %{x:.4f}<extra></extra>",
            },
          ]}
          layout={{
            autosize: true,
            margin: { l: 140, r: 20, t: 8, b: 30 },
            xaxis: { tickfont: { size: 10 } },
            yaxis: { tickfont: { size: 11 } },
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
