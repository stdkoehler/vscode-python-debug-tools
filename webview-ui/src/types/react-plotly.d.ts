declare module "react-plotly.js" {
  import * as React from "react";

  interface PlotParams {
    data: Partial<Plotly.PlotData>[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    className?: string;
    onInitialized?: (
      figure: Readonly<Plotly.Figure>,
      graphDiv: HTMLDivElement
    ) => void;
    onUpdate?: (
      figure: Readonly<Plotly.Figure>,
      graphDiv: HTMLDivElement
    ) => void;
    onPurge?: (graphDiv: HTMLDivElement) => void;
    onError?: (err: Error) => void;
    debug?: boolean;
  }

  const Plot: React.FC<PlotParams>;

  export default Plot;
}
