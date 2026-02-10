import type {
  HierarchyNode,
  CustomHierarchyNode,
  CellData,
  DotData,
} from "../utils/types";
import { isHierarchyNode } from "../utils/types";
import * as d3 from "d3";

/**
 * get the correct font width
 */
export function getCharWidthFromCSSVar(char: string = "M"): number {
  // Create a temporary span to get the computed font
  const span = document.createElement("span");
  span.style.visibility = "hidden";
  span.style.position = "absolute";
  span.style.fontFamily = "var(--vscode-font-family, monospace)";
  span.style.fontSize = "var(--vscode-font-size, 13px)"; // match your node font size
  span.textContent = char;
  document.body.appendChild(span);
  const computedFont = getComputedStyle(span).font;
  document.body.removeChild(span);

  // Use canvas to measure
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return 7.5; // fallback
  ctx.font = computedFont;
  return ctx.measureText(char).width;
}

/**
 * Returns a unique path for a node in the hierarchy.
 */
export function getNodePath(
  node: HierarchyNode,
  parentPath: string = ""
): string {
  if (!node || !node.name) return parentPath;
  // If parentPath is empty, just return node.name
  if (!parentPath) return node.name;
  return parentPath + "/" + node.name;
}

/**
 * Builds cell and dot data for a node, with paging for arrays.
 */
export function getCellAndDotData(
  node: CustomHierarchyNode,
  nodePath: string,
  PADDING: number,
  LINE_HEIGHT: number,
  TITLE_SPACING: number,
  arrayPageMap: Record<string, number>,
  pageSize: number
): {
  cellData: CellData[];
  dotsData: DotData[];
  pageInfo?: {
    page: number;
    totalPages: number;
    totalItems: number;
    start: number;
    end: number;
  };
  pagedChildPaths?: string[];
} {
  let yOffset = -node.height / 2 + PADDING + LINE_HEIGHT + TITLE_SPACING;
  const cellData: CellData[] = [];
  const dotsData: DotData[] = [];
  const pagedChildPaths: string[] = [];

  if (node.data.type === "object") {
    if (node.data.fields) {
      node.data.fields.forEach(() => {
        const cellY = yOffset - LINE_HEIGHT / 2;
        const textY = yOffset;
        cellData.push({
          y: cellY,
          height: LINE_HEIGHT,
          hasConnection: false,
          textY,
        });
        yOffset += LINE_HEIGHT;
      });
    }
    if (node.data.children) {
      node.data.children.forEach((child) => {
        const cellY = yOffset - LINE_HEIGHT / 2;
        const textY = yOffset;
        const childPath = getNodePath(child, nodePath);
        cellData.push({
          y: cellY,
          height: LINE_HEIGHT,
          hasConnection: true,
          textY,
          childNode: child,
          childPath,
        });
        dotsData.push({
          index: cellData.length - 1,
          y: textY,
          childNode: child,
          childPath,
        });
        pagedChildPaths.push(childPath);
        yOffset += LINE_HEIGHT;
      });
    }
  } else if (node.data.type === "array" && node.data.items) {
    const totalItems = node.data.items.length;
    const page = arrayPageMap[nodePath] || 0;
    const totalPages = Math.ceil(totalItems / pageSize);
    const start = page * pageSize;
    const end = Math.min(start + pageSize, totalItems);
    const itemsToShow = node.data.items.slice(start, end);
    itemsToShow.forEach((item, idx) => {
      const arrayIndex = start + idx;
      const cellY = yOffset - LINE_HEIGHT / 2;
      const textY = yOffset;
      const hasConnection = isHierarchyNode(item);
      let childNode: HierarchyNode | undefined = undefined;
      let childPath: string | undefined = undefined;
      if (hasConnection) {
        childNode = item;
        childPath = getNodePath(childNode, nodePath);
        pagedChildPaths.push(childPath);
      }
      cellData.push({
        y: cellY,
        height: LINE_HEIGHT,
        hasConnection,
        textY,
        childNode,
        childPath,
        arrayIndex,
      });
      if (hasConnection && childNode && childPath) {
        dotsData.push({
          index: cellData.length - 1,
          y: textY,
          childNode,
          childPath,
        });
      }
      yOffset += LINE_HEIGHT;
    });
    return {
      cellData,
      dotsData,
      pageInfo: { page, totalPages, totalItems, start, end },
      pagedChildPaths,
    };
  }
  return { cellData, dotsData, pagedChildPaths };
}

/**
 * Removes expanded children that are not visible in the current page.
 */
export function pruneExpandedForPage(
  expanded: Set<string>,
  nodePath: string,
  visibleChildPaths: string[]
): Set<string> {
  const next = new Set(expanded);
  for (const ep of expanded) {
    if (ep.startsWith(nodePath + "/")) {
      const directChild = ep
        .split("/")
        .slice(0, nodePath.split("/").length + 1)
        .join("/");
      if (!visibleChildPaths.includes(directChild)) {
        next.delete(ep);
      }
    }
  }
  return next;
}

/**
 * Calculates the SVG path for a link between two nodes.
 */
export function getLinkPath(
  d: d3.HierarchyLink<HierarchyNode>,
  PADDING: number,
  LINE_HEIGHT: number,
  TITLE_SPACING: number
) {
  const sourceNode = d.source as d3.HierarchyNode<HierarchyNode> & {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const targetNode = d.target as d3.HierarchyNode<HierarchyNode> & {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  const targetX = targetNode.y;
  const targetY = targetNode.x;
  let adjustedSourceY = sourceNode.x;
  const parentData = sourceNode.data;
  if (parentData.type === "object" && parentData.children) {
    const childIndex = parentData.children.findIndex(
      (child) => child.name === targetNode.data.name
    );
    if (childIndex !== -1) {
      const fieldsCount = parentData.fields ? parentData.fields.length : 0;
      const totalIndex = fieldsCount + childIndex;
      adjustedSourceY =
        sourceNode.x -
        sourceNode.height / 2 +
        PADDING +
        LINE_HEIGHT +
        TITLE_SPACING +
        totalIndex * LINE_HEIGHT;
    }
  } else if (parentData.type === "array" && parentData.items) {
    const childIndex = parentData.items.findIndex((item) => {
      if (isHierarchyNode(item)) {
        return item.name === targetNode.data.name;
      }
      return false;
    });
    if (childIndex !== -1) {
      adjustedSourceY =
        sourceNode.x -
        sourceNode.height / 2 +
        PADDING +
        LINE_HEIGHT +
        TITLE_SPACING +
        childIndex * LINE_HEIGHT;
    }
  }
  const sourceX = sourceNode.y + sourceNode.width;
  const c1x = sourceX + 40;
  const c1y = adjustedSourceY;
  const c2x = targetX - 40;
  const c2y = targetY;
  return `M${sourceX},${adjustedSourceY}C${c1x},${c1y},${c2x},${c2y},${targetX},${targetY}`;
}

export function getMaxWidthsPerDepth(root: CustomHierarchyNode): number[] {
  const maxWidths: number[] = [];
  root.each((node) => {
    const depth = node.depth;
    maxWidths[depth] = Math.max(maxWidths[depth] || 0, node.width);
  });
  return maxWidths;
}

export function getColumnOffsets(
  maxWidths: number[],
  margin: number
): number[] {
  const offsets: number[] = [];
  let cumulativeOffset = 0;
  for (let i = 0; i < maxWidths.length; i++) {
    offsets[i] = cumulativeOffset;
    cumulativeOffset += maxWidths[i] + margin;
  }
  return offsets;
}

export function applyColumnLayout(
  root: CustomHierarchyNode,
  offsets: number[]
): void {
  root.each((node) => {
    node.y = offsets[node.depth];
  });
}
