import { Box, Typography, alpha } from "@mui/material";
import { Plot } from "../data/plotly";
import type { ColumnProfile } from "../../types/dataset";

interface Props {
  columns: ColumnProfile[];
  /** Optional shared color used for every trace so charts read as one set. */
  color?: string;
  height?: number;
  /** Title for the surrounding card. */
  title?: string;
}

/**
 * Sprint 7 Module 2 — distribution overview as box-whisker traces.
 *
 * We synthesise box traces from the backend's `box_stats` (q1/q3/median/min/max
 * + 1.5·IQR fences) so we never have to ship row-level samples to the browser.
 * Falls back gracefully if a column has no `box_stats`.
 */
export function BoxViolinChart({
  columns,
  color = "#6366f1",
  height = 320,
  title = "Numeric distributions (box & whisker)",
}: Props) {
  const cols = columns.filter((c) => !!c.box_stats);
  if (cols.length === 0) return null;

  const data = cols.map((c) => {
    const b = c.box_stats!;
    return {
      type: "box" as const,
      name: c.name,
      // Plotly draws the box from these summary fields directly when we
      // provide a one-element y array per quartile field via `q1/q3/median/...`.
      q1: [b.q1],
      median: [b.median],
      q3: [b.q3],
      lowerfence: [b.lower_fence],
      upperfence: [b.upper_fence],
      mean: c.mean !== undefined ? [c.mean] : undefined,
      sd: c.std !== undefined ? [c.std] : undefined,
      x: [c.name],
      boxpoints: false as const,
      marker: { color },
      line: { color },
      hovertemplate:
        `<b>${c.name}</b><br>` +
        `min %{lowerfence:.2f}<br>q1 %{q1:.2f}<br>` +
        `median %{median:.2f}<br>q3 %{q3:.2f}<br>` +
        `max %{upperfence:.2f}<extra></extra>`,
    };
  });

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
        Whiskers extend to 1.5 × IQR. Points outside that are flagged as
        outliers in the column cards below.
      </Typography>
      <Plot
        data={data}
        layout={{
          autosize: true,
          height,
          showlegend: false,
          margin: { l: 40, r: 12, t: 10, b: 50 },
          xaxis: {
            tickfont: { size: 11 },
            tickangle: -30,
            automargin: true,
            gridcolor: alpha("#cbd5e1", 0.3),
          },
          yaxis: {
            tickfont: { size: 11 },
            gridcolor: alpha("#cbd5e1", 0.3),
            zeroline: false,
          },
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
