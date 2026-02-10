// src/utils/parser.ts
import type { HierarchyNode, HierarchyArrayItem } from "./types";

/**
 * Recursively builds a hierarchical data structure from JSON for d3.tree.
 */
export function buildHierarchy(json: unknown): HierarchyNode {
  const visited = new Set<object>(); // To handle circular references

  function traverse(
    data: Record<string, unknown> | unknown[],
    name: string
  ): HierarchyNode {
    if (typeof data !== "object" || data === null) {
      throw new Error("Root must be an object or array");
    }

    if (visited.has(data as object)) {
      return {
        name,
        type: Array.isArray(data) ? "array" : "object",
        fields: [{ name: "[Circular]", value: "[Circular Reference]" }],
      };
    }
    visited.add(data as object);

    const isArray = Array.isArray(data);

    if (isArray) {
      const items: HierarchyArrayItem[] = [];
      const arr = data as unknown[];
      for (let i = 0; i < arr.length; i++) {
        const value = arr[i];
        if (typeof value === "object" && value !== null) {
          items.push(
            traverse(value as Record<string, unknown> | unknown[], String(i))
          );
        } else {
          items.push({ name: String(i), value, type: "primitive" });
        }
      }
      visited.delete(data as object);
      return {
        name,
        type: "array",
        items,
      };
    } else {
      const children: HierarchyNode[] = [];
      const fields: { name: string; value: unknown }[] = [];
      let classname: string | undefined;
      const obj = data as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (typeof value === "object" && value !== null) {
          children.push(
            traverse(value as Record<string, unknown> | unknown[], key)
          );
        } else {
          if (key === "__class__") {
            classname = value as string;
          } else {
            fields.push({ name: key, value });
          }
        }
      }
      visited.delete(data as object);
      const node: HierarchyNode = {
        name,
        type: "object",
        ...(classname != null && { classname }),
      };
      if (children.length > 0) node.children = children;
      if (fields.length > 0) node.fields = fields;
      return node;
    }
  }

  return traverse(json as Record<string, unknown> | unknown[], "(root)");
}
