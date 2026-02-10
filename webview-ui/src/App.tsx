// src/App.tsx
import { useState, useMemo, useEffect, useRef } from "react";
import { isToWebviewMessage } from "@common/messages.ts";
import type {
  ToWebviewMessage,
  SetJsonMessage,
  SetWorkspaceVariablesMessage,
} from "@common/messages.ts";
import JsonEditor from "./components/JsonEditor";
import ObjectVisualizationD3 from "./components/ObjectVisualizationD3";
import DataPlotPane from "./components/DataPlotPane";

import { buildHierarchy } from "./utils/parser";
import "./styles/App.css";
import type { HierarchyNode, ObjectVisualizationD3Handle } from "./utils/types";
import type { VSCodeApi } from "./global";

// Acquire VS Code API only once and reuse
const vscode: VSCodeApi | undefined =
  typeof window !== "undefined" && window.acquireVsCodeApi
    ? window.acquireVsCodeApi()
    : undefined;

const initialJson = {
  orderId: "A-789",
  customer: {
    name: "Jane Doe",
    contact: {
      email: "jane.d@email.com",
      phone: "555-1234",
    },
  },
  items: [
    {
      product: "Widget",
      quantity: 2,
    },
    {
      product: "Gadget",
      quantity: 1,
      data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
      mixeddata2: [
        1,
        2,
        3,
        4,
        5,
        6,
        7,
        8,
        9,
        10,
        11,
        12,
        13,
        14,
        15,
        16,
        { __class__: "Test", a: 1 },
      ],
      classarray: [
        { __class__: "Test", a: 1 },
        { __class__: "Test", a: 1 },
      ],
    },
    "Note: Expedite",
  ],
  numbers: [1, 2, 3, 4, 5],
  classarray: [
    { __class__: "Test", a: 1 },
    { __class__: "Test", a: 1 },
  ],
};
function getEmptyHierarchy(): HierarchyNode {
  return {
    name: "(root)",
    type: "object",
    children: [],
  };
}

// Extend the Window interface for type safety
declare global {
  interface Window {
    initialView?: "json" | "plot";
  }
}

function App() {
  // Determine which view to show: 'json' or 'plot'.
  // This should be set by the extension via a global variable injected in the HTML:
  // <script>window.initialView = 'json';</script> or 'plot'
  // Fallback to 'json' if not set.
  const initialView: "json" | "plot" =
    (typeof window !== "undefined" && window.initialView) || "plot";
  const [viewMode] = useState<"json" | "plot">(initialView);

  // Shared state for both modes
  const [jsonString, setJsonString] = useState<string | null>(null);
  const [workspaceVariables, setWorkspaceVariables] = useState<string[]>([]);

  useEffect(() => {
    if (!vscode) {
      setJsonString(JSON.stringify(initialJson, null, 2));
      setWorkspaceVariables(["dummy_time", "dummy_value"]); // fallback for debug
      return;
    }

    vscode?.postMessage({ type: "ready" });

    const handler = (event: MessageEvent) => {
      try {
        if (!isToWebviewMessage(event.data)) {
          // Log invalid messages for debugging
          console.warn("Received invalid message:", event.data);
          return;
        }
        const message = event.data as ToWebviewMessage;
        switch (message.type) {
          case "set-json": {
            const msg = message as SetJsonMessage;
            setJsonString(JSON.stringify(msg.payload, null, 2));
            break;
          }
          case "set-workspace-variables": {
            const msg = message as SetWorkspaceVariablesMessage;
            setWorkspaceVariables(
              Array.isArray(msg.payload) ? msg.payload : []
            );
            break;
          }
          // Add more cases as needed
          default:
            // Log unknown message types for debugging
            console.warn(
              "Received unknown message type:",
              message.type,
              message
            );
        }
      } catch (err) {
        console.error("Error handling message event:", err, event);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Only used for JSON Visualizer
  const { graphData, error } = useMemo(() => {
    if (jsonString === null) {
      return {
        graphData: getEmptyHierarchy(),
        error: null,
      };
    }

    try {
      const parsedJson = JSON.parse(jsonString);
      return { graphData: buildHierarchy(parsedJson), error: null };
    } catch (e) {
      const err = e as Error;
      return {
        graphData: getEmptyHierarchy(),
        error: err.message,
      };
    }
  }, [jsonString]);

  // Only used for JSON Visualizer
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["(root)"])
  );
  const d3VisRef = useRef<ObjectVisualizationD3Handle | null>(null);

  const handleExpandAll = () => {
    if (d3VisRef.current?.getAllVisibleExpandablePaths) {
      const allPaths = d3VisRef.current.getAllVisibleExpandablePaths();
      const newExpanded = new Set(["(root)", ...allPaths]);
      setExpanded(newExpanded);
    }
  };

  const handleCollapseAll = () => {
    const newExpanded = new Set(["(root)"]);
    setExpanded(newExpanded);
  };

  const handleZoomToFit = () => {
    d3VisRef.current?.zoomToFit?.();
  };

  // Ensure zoomToFit is called after expanded changes (for plot view only)
  useEffect(() => {
    if (viewMode === "plot" && d3VisRef.current?.zoomToFit) {
      d3VisRef.current.zoomToFit();
    }
  }, [expanded, viewMode]);

  // Render only the relevant pane based on viewMode
  return (
    <div className="app-container">
      {viewMode === "json" && (
        <>
          <main>
            <div className="editor-pane">
              <div className="editor-wrapper">
                <JsonEditor
                  value={jsonString!}
                  onChange={setJsonString}
                  error={error}
                />
              </div>
            </div>
            <div className="visualization-pane">
              <div className="json-controls">
                <button onClick={handleExpandAll} style={{ marginRight: 8 }}>
                  Expand All
                </button>
                <button onClick={handleCollapseAll} style={{ marginRight: 8 }}>
                  Collapse All
                </button>
                <button onClick={handleZoomToFit}>Zoom to Fit</button>
              </div>
              <ObjectVisualizationD3
                ref={d3VisRef}
                data={graphData}
                expanded={expanded}
                setExpanded={setExpanded}
                vscode={vscode}
              />
            </div>
          </main>
        </>
      )}
      {viewMode === "plot" && (
        <main>
          <DataPlotPane
            workspaceVariables={workspaceVariables}
            vscode={vscode}
          />
        </main>
      )}
    </div>
  );
}
export default App;
