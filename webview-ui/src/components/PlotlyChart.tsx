// src/components/PlotlyChart.tsx

import type { PlotType, PlotData } from "plotly.js";
import Plot from "react-plotly.js";
import { useVSCodeThemeColors } from "../hooks/useVSCodeThemeColors";

type Trace = {
  xVar: string;
  yVar: string;
  plotType: "markers" | "lines" | "lines+markers";
  color: string;
  opacity: number;
  data: { x: number[]; y: number[] };
  error?: string | null;
  secondaryYAxis?: boolean; // If true, plot on secondary y-axis
};

type PlotlyChartProps = {
  traces: Trace[];
};

export default function PlotlyChart({ traces }: PlotlyChartProps) {
  const colors = useVSCodeThemeColors();

  const plotlyTraces: Partial<PlotData>[] = traces
    .filter(
      (trace) =>
        trace.data.x.length > 0 && trace.data.y.length > 0 && !trace.error
    )
    .map((trace, idx) => {
      return {
        x: trace.data.x,
        y: trace.data.y,
        type: "scatter" as PlotType,
        mode: trace.plotType,
        marker: { color: trace.color, opacity: trace.opacity },
        line: { color: trace.color, opacity: trace.opacity },
        opacity: trace.opacity,
        name: `Trace ${idx + 1}`,
        yaxis: trace.secondaryYAxis ? "y2" : "y",
      };
    });

  // Determine if any trace uses the secondary y-axis
  const hasSecondaryYAxis = traces.some((trace) => trace.secondaryYAxis);

  return (
    <Plot
      data={plotlyTraces}
      layout={{
        title: {
          text: "",
          font: { color: colors.foreground },
        },
        paper_bgcolor: colors.background,
        plot_bgcolor: colors.background,
        font: { color: colors.foreground },
        autosize: true,
        margin: { l: 50, r: 30, b: 50, t: 50 },
        xaxis: {
          title: { text: "x", font: { color: colors.foreground } },
          color: colors.axisColor,
          gridcolor: colors.gridColor,
        },
        yaxis: {
          title: { text: "y", font: { color: colors.axisColor } },
          color: colors.axisColor,
          gridcolor: colors.gridColor,
        },
        ...(hasSecondaryYAxis && {
          yaxis2: {
            title: { text: "y2", font: { color: colors.secondaryAxisColor } },
            color: colors.secondaryAxisColor,
            gridcolor: colors.secondaryGridColor,
            overlaying: "y",
            side: "right",
          },
        }),
      }}
      useResizeHandler
      style={{ width: "100%", height: "100%" }}
      config={{
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
      }}
    />
  );
}
