import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as d3 from "d3";
import type {
  HierarchyNode,
  CustomHierarchyNode,
  ObjectVisualizationD3Props,
  ObjectVisualizationD3Handle,
} from "../utils/types";
import { isHierarchyNode } from "../utils/types";
import { getNodePath } from "./d3Helpers";

// New modules
import { buildD3Hierarchy, getChildrenForD3 } from "./d3HierarchyBuilder";
import {
  VIS_CONFIG,
  calculateNodeLayout,
  setDynamicY,
  applyColumnarLayout,
} from "./d3Layout";
import { renderObjectVisualizationD3 } from "./d3Renderer";

const ObjectVisualizationD3 = forwardRef<
  ObjectVisualizationD3Handle,
  ObjectVisualizationD3Props
>(function ObjectVisualizationD3({ data, expanded, setExpanded, vscode }, ref) {
  useImperativeHandle(ref, () => ({
    getAllVisibleExpandablePaths: () => {
      const result: string[] = [];
      function traverse(node: HierarchyNode, parentPath: string = "") {
        const path = getNodePath(node, parentPath);
        if (node.type === "object" && node.children) {
          node.children.forEach((child) => {
            const childPath = getNodePath(child, path);
            result.push(childPath);
            traverse(child, path);
          });
        } else if (node.type === "array" && node.items) {
          const page = arrayPageMap[path] || 0;
          const pageSize = VIS_CONFIG.PAGE_SIZE;
          const totalItems = node.items.length;
          const start = page * pageSize;
          const end = Math.min(start + pageSize, totalItems);
          for (let i = start; i < end; i++) {
            const item = node.items[i];
            if (isHierarchyNode(item)) {
              const childPath = getNodePath(item, path);
              result.push(childPath);
              traverse(item, path);
            }
          }
        }
      }
      traverse(data, "");
      return result;
    },
    zoomToFit: () => {
      if (!svgRef.current || !containerRef.current) return;
      const svg = d3.select(svgRef.current);
      const g = svg.select("g");
      const gNode = g.node() as SVGGElement | null;
      if (!gNode || typeof gNode.getBBox !== "function") return;
      const bounds = gNode.getBBox();
      const fullWidth = containerRef.current.clientWidth;
      const fullHeight = containerRef.current.clientHeight;
      const width = bounds.width;
      const height = bounds.height;
      const midX = bounds.x + width / 2;
      const midY = bounds.y + height / 2;
      if (width === 0 || height === 0) return;
      const scale = Math.min(fullWidth / width, fullHeight / height) * 0.9;
      const initialTransform = d3.zoomIdentity
        .translate(fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY)
        .scale(scale);
      svg
        .transition()
        .duration(400)
        .call(
          d3
            .zoom<SVGSVGElement, unknown>()
            .on("zoom", (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
              g.attr("transform", event.transform.toString());
              zoomTransformRef.current = event.transform;
            })
            .scaleExtent([0.1, 3]).transform,
          initialTransform
        );
      zoomTransformRef.current = initialTransform;
    },
  }));

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [arrayPageMap, setArrayPageMap] = useState<Record<string, number>>(
    () => {
      if (vscode && typeof vscode.getState === "function") {
        const state = vscode.getState() as
          | { d3ArrayPageMap?: Record<string, number> }
          | undefined;
        if (
          state &&
          typeof state.d3ArrayPageMap === "object" &&
          state.d3ArrayPageMap !== null
        ) {
          return state.d3ArrayPageMap;
        }
      }
      return {};
    }
  );

  const handleDotClick = useCallback(
    (childPath: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(childPath)) {
          const toRemove = [childPath];
          for (let i = 0; i < toRemove.length; i++) {
            const p = toRemove[i];
            for (const ep of next) {
              if (ep.startsWith(p + "/")) toRemove.push(ep);
            }
          }
          toRemove.forEach((p) => next.delete(p));
        } else {
          next.add(childPath);
        }
        if (vscode && typeof vscode.setState === "function") {
          vscode.setState({
            d3Expanded: Array.from(next),
            d3Zoom: zoomTransformRef.current,
            d3ArrayPageMap: arrayPageMap,
          });
        }
        return next;
      });
    },
    [setExpanded, arrayPageMap, vscode]
  );

  const initialZoomSetRef = useRef<boolean>(false) as React.RefObject<boolean>;
  const zoomTransformRef = useRef<d3.ZoomTransform | null>(
    null
  ) as React.RefObject<d3.ZoomTransform | null>;

  // Restore persisted state once on mount
  useEffect(() => {
    if (vscode && typeof vscode.getState === "function") {
      const state = vscode.getState() as
        | {
            d3Expanded?: string[];
            d3Zoom?: { x: number; y: number; k: number };
            d3ArrayPageMap?: Record<string, number>;
          }
        | undefined;
      if (state) {
        if (
          Array.isArray(state.d3Expanded) &&
          state.d3Expanded.every((v) => typeof v === "string")
        ) {
          setExpanded(new Set(state.d3Expanded));
        } else {
          setExpanded(new Set());
        }
        if (state.d3Zoom && !zoomTransformRef.current) {
          const { x, y, k } = state.d3Zoom;
          zoomTransformRef.current = d3.zoomIdentity.translate(x, y).scale(k);
        }
        if (
          typeof state.d3ArrayPageMap === "object" &&
          state.d3ArrayPageMap !== null
        ) {
          setArrayPageMap(state.d3ArrayPageMap);
        } else {
          setArrayPageMap({});
        }
      } else {
        setExpanded(new Set());
        setArrayPageMap({});
      }
    }
  }, [vscode, setExpanded, setArrayPageMap, zoomTransformRef, data]);

  useEffect(() => {
    setExpanded(new Set(["(root)"]));
    setArrayPageMap({});
  }, [data, setExpanded, setArrayPageMap]);

  // Persist arrayPageMap
  useEffect(() => {
    if (vscode && typeof vscode.setState === "function") {
      vscode.setState({
        d3Expanded: Array.from(expanded),
        d3Zoom: zoomTransformRef.current,
        d3ArrayPageMap: arrayPageMap,
      });
    }
  }, [vscode, expanded, zoomTransformRef, arrayPageMap]);

  useEffect(() => {
    if (!data || !svgRef.current || !containerRef.current) return;

    // 1) Build filtered hierarchy
    const filteredData = buildD3Hierarchy(data, expanded);

    // 2) Convert to d3 hierarchy
    const root: CustomHierarchyNode = d3.hierarchy(
      filteredData,
      getChildrenForD3
    ) as CustomHierarchyNode;

    // 3) Compute sizes and layout
    calculateNodeLayout(root, arrayPageMap);

    // Use d3.tree only to compute basic hierarchy (we'll override positions)
    const treeLayout: d3.TreeLayout<HierarchyNode> = d3
      .tree<HierarchyNode>()
      .nodeSize([220, 0])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));
    treeLayout(root);

    // Dynamic vertical placement based on heights
    setDynamicY(root, 0);

    // Columnar layout (horizontal columns)
    applyColumnarLayout(root);

    // 4) Render
    renderObjectVisualizationD3({
      svg: d3.select(svgRef.current),
      container: containerRef.current,
      root,
      arrayPageMap,
      expanded,
      setArrayPageMap,
      setExpanded,
      zoomTransformRef,
      initialZoomSetRef,
      handleDotClick,
      vscode,
    });

    // Auto zoom-to-fit on changes
    if (
      ref &&
      typeof ref !== "function" &&
      ref.current &&
      ref.current.zoomToFit
    ) {
      ref.current.zoomToFit();
    }
  }, [vscode, data, expanded, arrayPageMap, setExpanded, handleDotClick, ref]);

  return (
    <div ref={containerRef} className="visualization-container">
      <svg ref={svgRef} className="visualization-svg"></svg>
    </div>
  );
});

export default ObjectVisualizationD3;
