import * as d3 from "d3";
import type {
  HierarchyNode,
  CustomHierarchyNode,
  CellData,
  DotData,
} from "../utils/types";
import { isHierarchyNode, isPrimitiveArrayItem } from "../utils/types";
import {
  getNodePath,
  getCellAndDotData,
  pruneExpandedForPage,
  getLinkPath,
} from "./d3Helpers";
import { VIS_CONFIG, getNodeTitleString } from "./d3Layout";

/** Backgrounds and hover effects per cell */
function renderCellBackgrounds(
  parent: d3.Selection<SVGGElement, CustomHierarchyNode, null, undefined>,
  cellData: CellData[],
  node: CustomHierarchyNode,
  dotsData: DotData[],
  DOT_RADIUS: number
) {
  const cellsGroup = parent.append("g").attr("class", "cell-backgrounds");
  const dotAreaWidth = VIS_CONFIG.DOT_RADIUS * 3;
  const leftPadding = 4;
  cellData.forEach((cell, index) => {
    cellsGroup
      .append("line")
      .attr("class", "cell-divider-top")
      .attr("x1", leftPadding)
      .attr("x2", node.width - dotAreaWidth)
      .attr("y1", cell.y)
      .attr("y2", cell.y);

    if (index === cellData.length - 1) {
      cellsGroup
        .append("line")
        .attr("class", "cell-divider-bottom")
        .attr("x1", leftPadding)
        .attr("x2", node.width - dotAreaWidth)
        .attr("y1", cell.y + cell.height)
        .attr("y2", cell.y + cell.height);
    }

    const cellHoverArea = cellsGroup
      .append("rect")
      .attr("class", "cell-hover-area")
      .attr("x", 1)
      .attr("y", cell.y)
      .attr("width", node.width - 2)
      .attr("height", cell.height)
      .attr("fill", "transparent")
      .attr("stroke", "none")
      .style("cursor", cell.hasConnection ? "pointer" : "default");

    const cellBackground = cellsGroup
      .append("rect")
      .attr("class", "cell-background")
      .attr("x", 1)
      .attr("y", cell.y)
      .attr("width", node.width - 2)
      .attr("height", cell.height)
      .attr("opacity", 0)
      .attr("rx", 3);

    const correspondingDot = dotsData.find((dot) => dot.index === index);
    cellHoverArea
      .on("mouseenter", function () {
        cellBackground.transition().duration(150).attr("opacity", 0.8);
        if (correspondingDot) {
          const dot = parent.select(
            `.child-link-dot[data-cell-index="${index}"]`
          );
          dot
            .transition()
            .duration(150)
            .attr("r", DOT_RADIUS + 1);
        }
      })
      .on("mouseleave", function () {
        cellBackground.transition().duration(150).attr("opacity", 0);
        if (correspondingDot) {
          const dot = parent.select(
            `.child-link-dot[data-cell-index="${index}"]`
          );
          dot
            .transition()
            .duration(150)
            .attr("fill", "#9AA0A6")
            .attr("r", DOT_RADIUS);
        }
      });
  });
}

/** Cell text rendering */
function renderCellText(
  parent: d3.Selection<SVGGElement, CustomHierarchyNode, null, undefined>,
  node: CustomHierarchyNode,
  cellData: CellData[],
  PADDING: number
) {
  function renderArrayItemCell(cell: CellData, idx: number) {
    let item:
      | HierarchyNode
      | import("../utils/types").PrimitiveArrayItem
      | undefined = cell.childNode;
    if (!item && node.data.items && node.data.items[idx] !== undefined) {
      item = node.data.items[idx];
    }
    if (!item) return;
    if (isPrimitiveArrayItem(item)) {
      const text = parent
        .append("text")
        .attr("class", "node-text node-field")
        .attr("x", PADDING + 10)
        .attr("y", cell.textY)
        .attr("dominant-baseline", "middle");
      text.append("tspan").text(`[${idx}]: `).attr("class", "field-key");
      text
        .append("tspan")
        .text(`${JSON.stringify(item.value)}`)
        .attr("class", "field-value");
    } else if (isHierarchyNode(item)) {
      const postfix =
        item?.classname ??
        (item.type === "object" ? "{}" : "[]");
      const text = parent
        .append("text")
        .attr("class", "node-text node-child-link")
        .attr("x", PADDING + 10)
        .attr("y", cell.textY)
        .attr("dominant-baseline", "middle");
      text.append("tspan").text(`[${idx}]: `);
      text.append("tspan").text(`${postfix}`).attr("font-style", "italic");
    }
  }

  if (node.data.type === "object") {
    if (node.data.fields) {
      node.data.fields.forEach((field, index) => {
        const cell = cellData[index];
        if (!cell) return;
        const text = parent
          .append("text")
          .attr("class", "node-text node-field")
          .attr("x", PADDING + 10)
          .attr("y", cell.textY)
          .attr("dominant-baseline", "middle");
        text.append("tspan").text(`${field.name}: `).attr("class", "field-key");
        text
          .append("tspan")
          .text(`${JSON.stringify(field.value)}`)
          .attr("class", "field-value");
      });
    }
    if (node.data.children) {
      const fieldCount = node.data.fields ? node.data.fields.length : 0;
      node.data.children.forEach((child, index) => {
        const cellIndex = fieldCount + index;
        const cell = cellData[cellIndex];
        if (!cell) return;
        let typeClass = "";
        let postfix = "";
        switch (child.type) {
          case "array":
            postfix = ": []";
            typeClass = "node-text-array";
            break;
          case "object":
            postfix = ": {}";
            typeClass = "node-text-object";
            break;
        }
        if (child.classname !== undefined) postfix = `: ${child.classname}`;
        parent
          .append("text")
          .attr("class", `node-text node-child-link ${typeClass}`)
          .attr("x", PADDING + 10)
          .attr("y", cell.textY)
          .attr("dominant-baseline", "middle")
          .text(`${child.name}`)
          .append("tspan")
          .text(`${postfix}`)
          .attr("font-style", "italic");
      });
    }
  } else if (node.data.type === "array" && cellData.length > 0) {
    cellData.forEach((cell) => {
      const idx = cell.arrayIndex;
      if (idx === undefined) return;
      renderArrayItemCell(cell, idx);
    });
  }
}

/** Dots for child links */
function renderChildDots(
  parent: d3.Selection<SVGGElement, CustomHierarchyNode, null, undefined>,
  node: CustomHierarchyNode,
  dotsData: DotData[],
  expanded: Set<string>,
  handleDotClick: (childPath: string) => void
) {
  const dotsGroup = parent.append("g").attr("class", "child-link-dots");
  dotsData.forEach((dot) => {
    const isExpanded = expanded.has(dot.childPath);
    dotsGroup
      .append("circle")
      .attr(
        "class",
        "child-link-dot" + (isExpanded ? " expanded" : " collapsed")
      )
      .attr("data-cell-index", dot.index)
      .attr("cx", node.width)
      .attr("cy", dot.y)
      .attr("r", VIS_CONFIG.DOT_RADIUS)
      .attr("fill", isExpanded ? "#4285F4" : "#9AA0A6")
      .style("cursor", "pointer")
      .on("click", (event) => {
        event.stopPropagation();
        handleDotClick(dot.childPath);
      });
  });
}

export function renderObjectVisualizationD3({
  svg,
  container,
  root,
  arrayPageMap,
  expanded,
  setArrayPageMap,
  setExpanded,
  zoomTransformRef,
  initialZoomSetRef,
  handleDotClick,
  vscode,
}: {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  container: HTMLDivElement;
  root: CustomHierarchyNode;
  arrayPageMap: Record<string, number>;
  expanded: Set<string>;
  setArrayPageMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
  zoomTransformRef: React.RefObject<d3.ZoomTransform | null>;
  initialZoomSetRef: React.RefObject<boolean>;
  handleDotClick: (childPath: string) => void;
  vscode?: { setState?: (s: unknown) => void };
}): void {
  const {
    PADDING,
    LINE_HEIGHT,
    DOT_RADIUS,
    TITLE_SPACING,
    PAGE_SIZE,
    PAGING_BAR_HEIGHT,
  } = VIS_CONFIG;

  svg.selectAll("*").remove();
  const g = svg.append("g");

  svg
    .append("defs")
    .selectAll("marker")
    .data(["arrowhead"]) // single marker
    .join("marker")
    .attr("id", "arrowhead")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 8)
    .attr("refY", 0)
    .attr("orient", "auto")
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("class", "arrowhead-path");

  const linkGroup = g.append("g").attr("class", "d3-link-group");
  const nodeGroup = g.append("g").attr("class", "nodes");

  const node = nodeGroup
    .selectAll<SVGGElement, CustomHierarchyNode>("g")
    .data(root.descendants() as CustomHierarchyNode[])
    .join("g")
    .attr("transform", (d) => `translate(${d.y},${d.x})`)
    .attr("class", "node-group");

  node
    .append("rect")
    .attr("class", (d) =>
      d.data.type === "object" ? "object-box" : "array-box"
    )
    .attr("width", (d) => d.width)
    .attr("height", (d) => d.height)
    .attr("x", 0)
    .attr("y", (d) => -d.height / 2)
    .attr("rx", 6);

  node
    .append("text")
    .attr("class", "node-text node-title")
    .attr("x", PADDING)
    .attr("y", (d) => -d.height / 2 + PADDING + 5)
    .each(function (d) {
      const { title, postfix } = getNodeTitleString(d);
      const text = d3.select(this);
      text.text(title);
      if (postfix)
        text.append("tspan").text(postfix).attr("font-style", "italic");
    });

  node.each(function (this: SVGGElement, d: CustomHierarchyNode) {
    const parent = d3.select<SVGGElement, CustomHierarchyNode>(this);
    const nodePath = getNodePath(
      d.data,
      (() => {
        const names: string[] = [];
        let current = d.parent;
        while (current) {
          names.unshift(current.data.name);
          current = current.parent;
        }
        return names.length ? names.join("/") : "";
      })()
    );
    const { cellData, dotsData, pageInfo } = getCellAndDotData(
      d,
      nodePath,
      PADDING,
      LINE_HEIGHT,
      TITLE_SPACING,
      arrayPageMap,
      PAGE_SIZE
    );

    renderCellBackgrounds(parent, cellData, d, dotsData, DOT_RADIUS);
    renderCellText(parent, d, cellData, PADDING);
    renderChildDots(parent, d, dotsData, expanded, handleDotClick);

    if (
      d.data.type === "array" &&
      d.data.items &&
      d.data.items.length > PAGE_SIZE &&
      pageInfo
    ) {
      const btnBarY = d.height / 2 - PAGING_BAR_HEIGHT - PADDING;
      const btnSpacing = 24;
      const btnBarGroup = parent.append("g");

      function renderBtn(
        label: string,
        x: number,
        enabled: boolean,
        onClick: () => void
      ) {
        const g = btnBarGroup
          .append("g")
          .style("cursor", enabled ? "pointer" : "not-allowed");
        g.append("rect")
          .attr("x", x)
          .attr("y", 0)
          .attr("width", 20)
          .attr("height", 20)
          .attr("rx", 4)
          .attr(
            "class",
            enabled ? "array-page-btn-rect" : "array-page-btn-rect disabled"
          );
        g.append("text")
          .attr("x", x + 10)
          .attr("y", 14)
          .attr("text-anchor", "middle")
          .attr("font-size", 14)
          .attr(
            "class",
            enabled ? "array-page-btn-text" : "array-page-btn-text disabled"
          )
          .text(label);
        if (enabled) {
          g.on("click", (event: MouseEvent) => {
            event.stopPropagation();
            onClick();
          });
        }
      }

      function handlePageChange(newPage: number) {
        const newPagedChildPaths: string[] = [];
        if (d.data.type === "array" && d.data.items) {
          const totalItems = d.data.items.length;
          const start = newPage * PAGE_SIZE;
          const end = Math.min(start + PAGE_SIZE, totalItems);
          for (let i = start; i < end; i++) {
            const item = d.data.items[i];
            if (isHierarchyNode(item))
              newPagedChildPaths.push(getNodePath(item, nodePath));
          }
        }
        setArrayPageMap((prev) => ({ ...prev, [nodePath]: newPage }));
        setExpanded((prev) =>
          pruneExpandedForPage(prev, nodePath, newPagedChildPaths)
        );
      }

      renderBtn("|<", 0, pageInfo.page > 0, () => handlePageChange(0));
      renderBtn("<", btnSpacing, pageInfo.page > 0, () =>
        handlePageChange(pageInfo.page - 1)
      );
      renderBtn(
        ">",
        btnSpacing * 2,
        pageInfo.page < pageInfo.totalPages - 1,
        () => handlePageChange(pageInfo.page + 1)
      );
      renderBtn(
        ">|",
        btnSpacing * 3,
        pageInfo.page < pageInfo.totalPages - 1,
        () => handlePageChange(pageInfo.totalPages - 1)
      );

      btnBarGroup
        .append("text")
        .attr("x", (btnSpacing * 4) / 2)
        .attr("y", 34)
        .attr("text-anchor", "middle")
        .attr("font-size", 13)
        .attr("class", "array-page-text")
        .text(`Page ${pageInfo.page + 1}/${pageInfo.totalPages}`);

      setTimeout(() => {
        const groupNode = btnBarGroup.node();
        if (groupNode) {
          const bbox = groupNode.getBBox();
          const groupX = d.width / 2 - bbox.width / 2;
          btnBarGroup.attr("transform", `translate(${groupX},${btnBarY})`);
        }
      }, 0);
    }
  });

  // Links
  linkGroup
    .selectAll<SVGPathElement, d3.HierarchyLink<HierarchyNode>>("path")
    .data(root.links())
    .join("path")
    .attr("class", "link")
    .attr("marker-end", "url(#arrowhead)")
    .attr("d", (d: d3.HierarchyLink<HierarchyNode>) => {
      const sourceNode = d.source as CustomHierarchyNode;
      const targetNode = d.target as CustomHierarchyNode;
      if (sourceNode.data.type === "array" && sourceNode.data.items) {
        const nodePath = getNodePath(
          sourceNode.data,
          (() => {
            const names: string[] = [];
            let current = sourceNode.parent;
            while (current) {
              names.unshift(current.data.name);
              current = current.parent;
            }
            return names.length ? names.join("/") : "";
          })()
        );
        const page = arrayPageMap[nodePath] || 0;
        const start = page * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, sourceNode.data.items.length);
        let pagedIdx = -1;
        for (let i = start; i < end; i++) {
          const item = sourceNode.data.items[i];
          if (isHierarchyNode(item) && item.name === targetNode.data.name) {
            pagedIdx = i - start;
            break;
          }
        }
        if (pagedIdx !== -1) {
          const cellDotData = getCellAndDotData(
            sourceNode,
            nodePath,
            12,
            18,
            18 * 0.3,
            arrayPageMap,
            PAGE_SIZE
          );
          const dot = cellDotData.dotsData.find(
            (dot) => dot.childNode.name === targetNode.data.name
          );
          if (dot) {
            const y = sourceNode.y ?? 0;
            const sourceX = y + sourceNode.width;
            const sourceY = (sourceNode.x ?? 0) + dot.y;
            const tY = targetNode.y ?? 0;
            const tX = targetNode.x ?? 0;
            const c1x = sourceX + 40;
            const c1y = sourceY;
            const c2x = tY - 40;
            const c2y = tX;
            return `M${sourceX},${sourceY}C${c1x},${c1y},${c2x},${c2y},${tY},${tX}`;
          }
          return getLinkPath(d, 12, 18, 18 * 0.3);
        }
      }
      return getLinkPath(d, PADDING, LINE_HEIGHT, TITLE_SPACING);
    });

  // Zoom & pan
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 3])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
      zoomTransformRef.current = event.transform;
    })
    .on("end", (event) => {
      if (vscode && typeof vscode.setState === "function") {
        vscode.setState({
          d3Expanded: Array.from(expanded),
          d3Zoom: event.transform,
          d3ArrayPageMap: arrayPageMap,
        });
      }
    });
  svg.call(zoom);

  function applyZoomTransform() {
    const bounds = (g.node() as SVGGElement).getBBox();
    const fullWidth = container.clientWidth;
    const fullHeight = container.clientHeight;
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;
    if (width === 0 || height === 0) {
      requestAnimationFrame(applyZoomTransform);
      return;
    }
    const scale = Math.min(fullWidth / width, fullHeight / height) * 0.9;
    const initialTransform = d3.zoomIdentity
      .translate(fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY)
      .scale(scale);
    if (!initialZoomSetRef.current) {
      if (zoomTransformRef.current) {
        svg.call(zoom.transform, zoomTransformRef.current);
      } else {
        svg.call(zoom.transform, initialTransform);
        zoomTransformRef.current = initialTransform;
      }
      initialZoomSetRef.current = true;
    } else if (zoomTransformRef.current) {
      svg.call(zoom.transform, zoomTransformRef.current);
    }
  }
  applyZoomTransform();
}
