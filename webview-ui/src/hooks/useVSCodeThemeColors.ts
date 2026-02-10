// src/hooks/useVSCodeThemeColors.ts
import { useEffect, useState } from "react";

export function useVSCodeThemeColors() {
  // Utility to convert hex/rgb to rgba with alpha
  function toRgbaWithAlpha(color: string, alpha: number): string {
    color = color.trim();
    // Hex format
    if (/^#([\da-f]{3}){1,2}$/i.test(color)) {
      let hex = color.substring(1);
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map((c) => c + c)
          .join("");
      }
      const num = parseInt(hex, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `rgba(${r},${g},${b},${alpha})`;
    }
    // rgb or rgba already
    const rgbMatch = color.match(/^rgb\s*\((\d+),\s*(\d+),\s*(\d+)\)$/i);
    if (rgbMatch) {
      return `rgba(${rgbMatch[1]},${rgbMatch[2]},${rgbMatch[3]},${alpha})`;
    }
    // fallback: just return color
    return color;
  }

  const getColors = () => {
    const styles = getComputedStyle(document.body);
    const gridBase =
      styles.getPropertyValue("--vscode-editorHint-foreground").trim() ||
      "#888888";
    const secondaryGridBase =
      styles.getPropertyValue("--vscode-descriptionForeground").trim() ||
      "#8888cc";
    return {
      background:
        styles.getPropertyValue("--vscode-editor-background").trim() ||
        "#ffffff",
      foreground:
        styles.getPropertyValue("--vscode-editor-foreground").trim() ||
        "#000000",
      axisColor:
        styles.getPropertyValue("--vscode-editorHint-foreground").trim() ||
        "#888888",
      gridColor: toRgbaWithAlpha(gridBase, 0.6),
      secondaryAxisColor:
        styles.getPropertyValue("--vscode-descriptionForeground").trim() ||
        "#8888cc",
      secondaryGridColor: toRgbaWithAlpha(secondaryGridBase, 0.6),
      lineColor1:
        styles
          .getPropertyValue("--vscode-editorBracketHighlight-foreground1")
          .trim() || "#ff6188",
      lineColor2:
        styles
          .getPropertyValue("--vscode-editorBracketHighlight-foreground2")
          .trim() || "#fc9867",
      lineColor3:
        styles
          .getPropertyValue("--vscode-editorBracketHighlight-foreground3")
          .trim() || "#ffd866",
      lineColor4:
        styles
          .getPropertyValue("--vscode-editorBracketHighlight-foreground4")
          .trim() || "#a9dc76",
      lineColor5:
        styles
          .getPropertyValue("--vscode-editorBracketHighlight-foreground5")
          .trim() || "#78dce8",
      lineColor6:
        styles
          .getPropertyValue("--vscode-editorBracketHighlight-foreground6")
          .trim() || "#ab9df2",
    };
  };

  const [colors, setColors] = useState(getColors);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColors(getColors());
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "class"],
      subtree: false,
    });

    return () => observer.disconnect();
  }, []);

  return colors;
}
