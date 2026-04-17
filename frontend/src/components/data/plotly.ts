import createPlotlyComponent from "react-plotly.js/factory";
// @ts-expect-error - plotly.js-dist-min has no bundled types
import Plotly from "plotly.js-dist-min";

export const Plot = createPlotlyComponent(Plotly);
