import { useState, useEffect, useRef, useMemo } from "react";
import { ColorPickerPopover } from "./ColorPickerPopover";
import debounce from "lodash/debounce";
import PlotlyChart from "./PlotlyChart";
import { useVSCodeThemeColors } from "../hooks/useVSCodeThemeColors";
import type { VSCodeApi } from "src/global";

interface DataPlotPaneProps {
  workspaceVariables: string[];
  vscode: VSCodeApi | undefined;
}

type Trace = {
  xVar: string;
  yVar: string;
  plotType: "markers" | "lines" | "lines+markers";
  color: string;
  opacity: number;
  data: { x: number[]; y: number[] };
  error?: string | null;
  requestIds: { x?: string; y?: string };
  secondaryYAxis?: boolean;
};

export default function DataPlotPane({
  workspaceVariables,
  vscode,
}: DataPlotPaneProps) {
  const VSCODE_THEME_COLORS = useVSCodeThemeColors();

  console.log(VSCODE_THEME_COLORS);

  const DEFAULT_COLORS = useMemo(() => {
    const colors = [
      VSCODE_THEME_COLORS.lineColor1,
      VSCODE_THEME_COLORS.lineColor2,
      VSCODE_THEME_COLORS.lineColor3,
      VSCODE_THEME_COLORS.lineColor4,
      VSCODE_THEME_COLORS.lineColor5,
      VSCODE_THEME_COLORS.lineColor6,
    ].filter((color) => {
      if (!color) return false;
      const c = color.trim().toUpperCase();
      if (c === "#FFF" || c === "#FFFFFF") return false;
      const cNoSpace = c.replace(/\s+/g, "");
      if (cNoSpace === "RGBA(0,0,0,0)") return false;
      return true;
    });
    // Fallback to a safe palette if theme yields nothing usable
    return colors.length
      ? colors
      : ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b"];
  }, [VSCODE_THEME_COLORS]);

  // Color picker state
  const [colorPickerIdx, setColorPickerIdx] = useState<number | null>(null);
  const colorBtnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Default trace template (use first default color or fallback)
  const DEFAULT_TRACE: Trace = {
    xVar: "None",
    yVar: "None",
    plotType: "lines+markers",
    color: DEFAULT_COLORS[0] ?? "#1f77b4",
    opacity: 1,
    data: { x: [], y: [] },
    error: null,
    requestIds: {},
    secondaryYAxis: false,
  };

  // Load traces from VSCode state if available
  const [traces, setTraces] = useState<Trace[]>(() => {
    if (vscode && typeof vscode.getState === "function") {
      const state = vscode.getState() as { traces?: Trace[] } | undefined;
      if (state && Array.isArray(state.traces) && state.traces.length) {
        return state.traces;
      }
    }
    return [DEFAULT_TRACE];
  });

  // Store partial variable values for each trace until both x and y are received
  const pendingValues = useRef<Record<number, { x?: number[]; y?: number[] }>>(
    {}
  );

  // Add a new trace
  const handleAddTrace = () => {
    setTraces((prev: Trace[]) => {
      const nextColor =
        DEFAULT_COLORS[prev.length % DEFAULT_COLORS.length] ??
        DEFAULT_TRACE.color;
      const newTrace: Trace = { ...DEFAULT_TRACE, color: nextColor };
      const newTraces = [...prev, newTrace];
      if (vscode && typeof vscode.setState === "function") {
        vscode.setState({ traces: newTraces });
      }
      return newTraces;
    });
  };

  // Remove a trace
  const handleRemoveTrace = (idx: number) => {
    setTraces((prev: Trace[]) => {
      const newTraces =
        prev.length === 1 ? prev : prev.filter((_, i) => i !== idx);
      if (vscode && typeof vscode.setState === "function") {
        vscode.setState({ traces: newTraces });
      }
      // Clear pending cache for shifted indices
      const newPending: Record<number, { x?: number[]; y?: number[] }> = {};
      newTraces.forEach((_, i) => {
        if (pendingValues.current[i]) newPending[i] = pendingValues.current[i];
      });
      pendingValues.current = newPending;
      return newTraces;
    });
  };

  // Debounced color change handler
  const debouncedColorChange = useRef(
    debounce((idx: number, value: string) => {
      setTraces((prev) => {
        const updated = [...prev];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], color: value };
          if (vscode && typeof vscode.setState === "function") {
            vscode.setState({ traces: updated });
          }
        }
        return updated;
      });
    }, 200)
  ).current;

  useEffect(() => {
    return () => {
      // Clean up any pending debounced calls on unmount
      debouncedColorChange.cancel();
    };
  }, [debouncedColorChange]);

  // Handle trace property change
  const handleTraceChange = (
    idx: number,
    key: keyof Trace,
    value: string | number | boolean
  ) => {
    setTraces((prev: Trace[]) => {
      const updated = [...prev];
      const current = updated[idx];
      if (!current) return prev;

      // Base update
      let nextTrace: Trace = current;
      if (key === "opacity") {
        nextTrace = {
          ...current,
          opacity:
            typeof value === "string"
              ? parseFloat(value as string)
              : (value as number),
        };
      } else {
        nextTrace = { ...current, [key]: value } as Trace;
      }

      // If axis selection changes, reset data/error and (re)request values
      if (key === "xVar" || key === "yVar") {
        // Reset data/error for a fresh fetch
        nextTrace = {
          ...nextTrace,
          data: { x: [], y: [] },
          error: null,
        };

        // Clear any pending cache for this trace
        delete pendingValues.current[idx];

        // Build fresh requestIds for both axes that are not "None"
        const newRequestIds: { x?: string; y?: string } = {};

        // Request X if selected
        if (nextTrace.xVar !== "None") {
          const requestIdX = `x-${idx}-${Date.now()}-${Math.random()}`;
          newRequestIds.x = requestIdX;
          vscode?.postMessage({
            type: "request-variable-value",
            variable: nextTrace.xVar,
            requestId: requestIdX,
          });
        }

        // Request Y if selected
        if (nextTrace.yVar !== "None") {
          const requestIdY = `y-${idx}-${Date.now()}-${Math.random()}`;
          newRequestIds.y = requestIdY;
          vscode?.postMessage({
            type: "request-variable-value",
            variable: nextTrace.yVar,
            requestId: requestIdY,
          });
        }

        nextTrace = { ...nextTrace, requestIds: newRequestIds };
      }

      updated[idx] = nextTrace;

      if (vscode && typeof vscode.setState === "function") {
        vscode.setState({ traces: updated });
      }
      return updated;
    });
  };

  // Listen for variable values and update traces
  useEffect(() => {
    if (!vscode) return;

    const handler = (event: MessageEvent) => {
      const data = (event as MessageEvent).data;
      if (data?.type !== "variable-value") return;

      setTraces((prev: Trace[]) => {
        // Find the trace index for this message
        const traceIdx = prev.findIndex(
          (trace) =>
            (data.variable === trace.xVar &&
              data.requestId === trace.requestIds.x) ||
            (data.variable === trace.yVar &&
              data.requestId === trace.requestIds.y)
        );
        if (traceIdx === -1) return prev;

        const trace = prev[traceIdx];

        // Error handling
        if (data.error) {
          const updated = [...prev];
          updated[traceIdx] = {
            ...trace,
            error: `Error fetching variable '${data.variable}': ${data.error}`,
            data: { x: [], y: [] },
          };
          delete pendingValues.current[traceIdx];
          if (vscode && typeof vscode.setState === "function") {
            vscode.setState({ traces: updated });
          }
          return updated;
        }

        // Store the received value in pendingValues
        if (!pendingValues.current[traceIdx])
          pendingValues.current[traceIdx] = {};
        if (
          data.variable === trace.xVar &&
          data.requestId === trace.requestIds.x
        ) {
          pendingValues.current[traceIdx].x = data.value;
        }
        if (
          data.variable === trace.yVar &&
          data.requestId === trace.requestIds.y
        ) {
          pendingValues.current[traceIdx].y = data.value;
        }

        // Check readiness
        const xReady =
          trace.xVar === "None" ||
          Array.isArray(pendingValues.current[traceIdx].x);
        const yReady =
          trace.yVar === "None" ||
          Array.isArray(pendingValues.current[traceIdx].y);

        if (
          (trace.xVar !== "None" &&
            trace.yVar !== "None" &&
            xReady &&
            yReady) ||
          (trace.xVar === "None" && yReady) ||
          (trace.yVar === "None" && xReady)
        ) {
          let xArr: number[] = [];
          let yArr: number[] = [];
          let error: string | null = null;

          if (trace.xVar !== "None" && trace.yVar !== "None") {
            xArr = pendingValues.current[traceIdx].x as number[];
            yArr = pendingValues.current[traceIdx].y as number[];
            if (!Array.isArray(xArr) || !Array.isArray(yArr)) {
              error =
                "Selected variables are not arrays or are invalid for plotting.";
              xArr = [];
              yArr = [];
            } else if (xArr.length !== yArr.length) {
              error =
                "Selected variables have different lengths and cannot be plotted together.";
              xArr = [];
              yArr = [];
            }
          } else if (trace.xVar === "None" && yReady) {
            yArr = pendingValues.current[traceIdx].y as number[];
            if (!Array.isArray(yArr)) {
              error =
                "Selected variable is not an array or is invalid for plotting.";
              yArr = [];
            } else {
              xArr = Array.from({ length: yArr.length }, (_, i) => i);
            }
          } else if (trace.yVar === "None" && xReady) {
            // x-only is not supported; prompt for y
            error = "Please select a variable for the y-axis.";
            xArr = [];
          }

          const updated = [...prev];
          updated[traceIdx] = { ...trace, data: { x: xArr, y: yArr }, error };

          // Clear pending values for this trace
          delete pendingValues.current[traceIdx];

          if (vscode && typeof vscode.setState === "function") {
            vscode.setState({ traces: updated });
          }
          return updated;
        }

        // Otherwise, wait for the other value
        return prev;
      });
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [vscode]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          overflowY: "auto",
          maxHeight: "32vh",
          minHeight: 0,
        }}
      >
        <div style={{ marginTop: 32 }}>
          {traces.map((trace, idx) => (
            <div key={idx} className="trace-row">
              <label className="plotly-axis-label">x:</label>
              <select
                className="plotly-axis-select"
                value={trace.xVar}
                onChange={(e) => handleTraceChange(idx, "xVar", e.target.value)}
              >
                <option value="None">None</option>
                {workspaceVariables.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>

              <label className="plotly-axis-label">y:</label>
              <select
                className="plotly-axis-select"
                value={trace.yVar}
                onChange={(e) => handleTraceChange(idx, "yVar", e.target.value)}
              >
                <option value="None">None</option>
                {workspaceVariables.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>

              <label className="plotly-axis-label">Type:</label>
              <select
                className="plotly-axis-select"
                value={trace.plotType}
                onChange={(e) =>
                  handleTraceChange(idx, "plotType", e.target.value)
                }
              >
                <option value="lines">Line</option>
                <option value="markers">Markers</option>
                <option value="lines+markers">Line + Markers</option>
              </select>

              <label className="plotly-axis-label">Color:</label>
              <button
                type="button"
                ref={(el) => {
                  colorBtnRefs.current[idx] = el;
                }}
                className="trace-color-input"
                style={{
                  background: trace.color,
                  border: "1px solid #ccc",
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  cursor: "pointer",
                }}
                onClick={() => setColorPickerIdx(idx)}
                aria-label="Pick color"
              />
              {colorPickerIdx === idx && colorBtnRefs.current[idx] && (
                <ColorPickerPopover
                  color={trace.color}
                  opacity={trace.opacity}
                  onChange={(color) => debouncedColorChange(idx, color)}
                  onOpacityChange={(opacity) =>
                    handleTraceChange(idx, "opacity", opacity)
                  }
                  onClose={() => setColorPickerIdx(null)}
                  anchorRef={{
                    current: colorBtnRefs.current[idx] as HTMLElement,
                  }}
                  presetColors={DEFAULT_COLORS}
                />
              )}

              <label
                className="plotly-axis-label"
                title="Plot on secondary y-axis (right)"
              >
                y2:
              </label>
              <input
                type="checkbox"
                checked={!!trace.secondaryYAxis}
                onChange={(e) =>
                  handleTraceChange(idx, "secondaryYAxis", e.target.checked)
                }
                title="Plot this trace on the secondary y-axis (right)"
                style={{ marginLeft: 2, marginRight: 8 }}
              />

              <button
                className="vscode-btn trace-remove-btn"
                onClick={() => handleRemoveTrace(idx)}
                disabled={traces.length === 1}
                title="Remove Trace"
              >
                🗑️
              </button>

              {trace.error && (
                <span className="trace-error">{trace.error}</span>
              )}
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8, marginLeft: 32 }}>
          <button
            className="vscode-btn"
            onClick={handleAddTrace}
            style={{ marginBottom: 8 }}
          >
            Add Trace
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
        <PlotlyChart traces={traces} />
      </div>
    </div>
  );
}
