import type {
  HierarchyNode,
  CustomHierarchyNode,
  NodeTitleString,
} from "../utils/types";
import { isHierarchyNode, isPrimitiveArrayItem } from "../utils/types";
import {
  getNodePath,
  getMaxWidthsPerDepth,
  getColumnOffsets,
  applyColumnLayout,
  getCharWidthFromCSSVar,
} from "./d3Helpers";

export const VIS_CONFIG = {
  PADDING: 12,
  LINE_HEIGHT: 18,
  CHAR_WIDTH: getCharWidthFromCSSVar(),
  NODE_MIN_WIDTH: 180,
  NODE_MAX_WIDTH: 400,
  PAGE_SIZE: 10,
  PAGING_BAR_HEIGHT: 32,
  TITLE_SPACING: 18 * 0.3,
  DOT_RADIUS: 4,
  HORIZONTAL_MARGIN: 100,
};

export const getNodeTitleString = (node: {
  data: HierarchyNode;
  parent?: CustomHierarchyNode | null;
}): NodeTitleString => {
  let name = node.data.name;
  if (node.parent && node.parent.data && node.parent.data.type === "array") {
    name = `[${name}]`;
  }
  if (node.data.type === "array") {
    return { title: name, postfix: ": []" };
  } else if (node.data.type === "object") {
    if (node.data.classname) {
      return { title: name + ":", postfix: ` ${node.data.classname}` };
    }
    return { title: name, postfix: ": {}" };
  }
  return { title: name };
};

/**
 * Calculates width/height for each node based on its content and paging state.
 */
export function calculateNodeLayout(
  root: CustomHierarchyNode,
  arrayPageMap: Record<string, number>
): void {
  root.each((node) => {
    const { title, postfix } = getNodeTitleString(node);
    const titleString = title + (postfix || "");
    let maxTextWidth = titleString.length * VIS_CONFIG.CHAR_WIDTH;
    let lineCount = 1;
    let extraHeight = 0;

    if (node.data.type === "object") {
      if (node.data.fields) {
        node.data.fields.forEach((f) => {
          const text = `${f.name}: ${JSON.stringify(f.value)}`;
          maxTextWidth = Math.max(
            maxTextWidth,
            text.length * VIS_CONFIG.CHAR_WIDTH
          );
          lineCount++;
        });
      }
      if (node.data.children) {
        node.data.children.forEach((c) => {
          const { title, postfix } = getNodeTitleString({
            data: c,
            parent: node,
          });
          const text = title + (postfix || "");
          maxTextWidth = Math.max(
            maxTextWidth,
            text.length * VIS_CONFIG.CHAR_WIDTH
          );
          lineCount++;
        });
      }
    } else if (node.data.type === "array" && node.data.items) {
      const nodePath = getNodePath(
        node.data,
        node.parent
          ? getNodePath(
              node.parent.data,
              node.parent.parent ? getNodePath(node.parent.parent.data) : "root"
            )
          : "root"
      );
      const page = arrayPageMap[nodePath] || 0;
      const totalItems = node.data.items.length;
      const start = page * VIS_CONFIG.PAGE_SIZE;
      const end = Math.min(start + VIS_CONFIG.PAGE_SIZE, totalItems);
      const itemsToShow = node.data.items.slice(start, end);
      itemsToShow.forEach((item) => {
        if (isHierarchyNode(item)) {
          const { title, postfix } = getNodeTitleString({
            data: item,
            parent: node,
          });
          const text = title + (postfix || "");
          maxTextWidth = Math.max(
            maxTextWidth,
            text.length * VIS_CONFIG.CHAR_WIDTH
          );
        } else if (isPrimitiveArrayItem(item)) {
          const text = `${JSON.stringify(item.value)}`;
          maxTextWidth = Math.max(
            maxTextWidth,
            text.length * VIS_CONFIG.CHAR_WIDTH
          );
        }
        lineCount++;
      });
      if (totalItems > VIS_CONFIG.PAGE_SIZE)
        extraHeight = VIS_CONFIG.PAGING_BAR_HEIGHT;
    }

    (node as CustomHierarchyNode).width = Math.min(
      Math.max(
        VIS_CONFIG.NODE_MIN_WIDTH,
        maxTextWidth + VIS_CONFIG.PADDING * 2
      ),
      VIS_CONFIG.NODE_MAX_WIDTH
    );
    (node as CustomHierarchyNode).height =
      lineCount * VIS_CONFIG.LINE_HEIGHT +
      VIS_CONFIG.PADDING * 2 +
      VIS_CONFIG.LINE_HEIGHT * 0.3 +
      extraHeight;
  });
}

/**
 * Recursively set x (vertical) positions based on actual node heights.
 */
export function setDynamicY(
  node: CustomHierarchyNode,
  yOffset: number = 0,
  yBuffer: number = 100
): number {
  node.x = yOffset + node.height / 2;
  let currY = yOffset;
  if (node.children && node.children.length > 0) {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i] as CustomHierarchyNode;
      currY = setDynamicY(child, currY);
      currY += yBuffer;
    }
    const firstChild = node.children[0] as CustomHierarchyNode | undefined;
    const lastChild = node.children[node.children.length - 1] as
      | CustomHierarchyNode
      | undefined;
    if (
      firstChild &&
      lastChild &&
      firstChild.x !== undefined &&
      lastChild.x !== undefined
    ) {
      node.x = (firstChild.x + lastChild.x) / 2;
    }
  } else {
    currY += node.height;
  }
  return currY;
}

/**
 * Columnar layout helpers wrapper: computes max widths per depth and applies offsets.
 */
export function applyColumnarLayout(root: CustomHierarchyNode): void {
  const maxWidths = getMaxWidthsPerDepth(root);
  const columnOffsets = getColumnOffsets(
    maxWidths,
    VIS_CONFIG.HORIZONTAL_MARGIN
  );
  applyColumnLayout(root, columnOffsets);
}
