// src/utils/types.ts
import type * as d3 from "d3";
import type { VSCodeApi } from "src/global";

// Custom hierarchy node interface extending D3's hierarchy node
export interface CustomHierarchyNode extends d3.HierarchyNode<HierarchyNode> {
  width: number;
  height: number;
}

// Imperative handle for ObjectVisualizationD3
export interface ObjectVisualizationD3Handle {
  getAllVisibleExpandablePaths: () => string[];
  zoomToFit: () => void;
}

export interface ObjectVisualizationD3Props {
  data: HierarchyNode;
  expanded: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  vscode?: VSCodeApi;
}

// Type for node title string and postfix (for D3 rendering)
export type NodeTitleString = { title: string; postfix?: string };

// Types for cell and dot data
export interface CellData {
  y: number;
  height: number;
  hasConnection: boolean;
  textY: number;
  childNode?: HierarchyNode;
  childPath?: string;
  arrayIndex?: number; // original array index for paged arrays
}
export interface DotData {
  index: number;
  y: number;
  childNode: HierarchyNode;
  childPath: string;
}

export interface PrimitiveArrayItem {
  name: string;
  value: unknown;
  type: "primitive";
}

export type HierarchyArrayItem =
  | HierarchyNode // for objects/arrays
  | PrimitiveArrayItem;

export interface HierarchyNode {
  name: string;
  type: "object" | "array";
  classname?: string;
  // For objects:
  children?: HierarchyNode[];
  fields?: { name: string; value: unknown }[];
  // For arrays:
  items?: HierarchyArrayItem[];
  // Visualization state:
  isInTree?: boolean;
}

// Type guard for HierarchyNode
export function isHierarchyNode(item: unknown): item is HierarchyNode {
  return (
    (typeof item === "object" &&
      item !== null &&
      "type" in item &&
      (item as { type?: unknown }).type === "object") ||
    (item as { type?: unknown }).type === "array" ||
    (item as { type?: unknown }).type === "class"
  );
}

// Type guard for PrimitiveArrayItem
export function isPrimitiveArrayItem(
  item: unknown
): item is PrimitiveArrayItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "type" in item &&
    (item as { type?: unknown }).type === "primitive"
  );
}
