import type { HierarchyNode } from "../utils/types";
import { isHierarchyNode } from "../utils/types";
import { getNodePath } from "./d3Helpers";

/**
 * Build a filtered hierarchy based on the current expansion state.
 * It keeps children/items present for label rendering but marks which nodes are actually in the tree (isInTree).
 */
export function buildD3Hierarchy(
  root: HierarchyNode,
  expanded: Set<string>,
  parentPath: string = ""
): HierarchyNode {
  const path = getNodePath(root, parentPath);
  const isRoot = path === "(root)";

  const filtered: HierarchyNode & { isInTree?: boolean } = { ...root };
  filtered.isInTree = isRoot || expanded.has(path);

  if (root.type === "object" && root.children) {
    filtered.children = root.children.map((c) => {
      const childPath = getNodePath(c, path);
      if (expanded.has(childPath)) {
        return buildD3Hierarchy(c, expanded, path);
      }
      return { ...c, isInTree: false, children: undefined, items: undefined };
    });
  } else if (root.type === "array" && root.items) {
    filtered.items = root.items.map((item) => {
      if (isHierarchyNode(item)) {
        const childPath = getNodePath(item, path);
        if (expanded.has(childPath))
          return buildD3Hierarchy(item, expanded, path);
        return {
          ...item,
          isInTree: false,
          children: undefined,
          items: undefined,
        } as HierarchyNode;
      }
      return item;
    });
  }
  return filtered;
}

/**
 * Children accessor for d3.hierarchy construction that respects isInTree marks.
 */
export function getChildrenForD3(
  node: HierarchyNode
): HierarchyNode[] | undefined {
  if (node.type === "object" && node.children) {
    return node.children.filter((c): c is HierarchyNode => Boolean(c.isInTree));
  }
  if (node.type === "array" && node.items) {
    return node.items.filter(
      (i): i is HierarchyNode => isHierarchyNode(i) && Boolean(i.isInTree)
    );
  }
  return undefined;
}
