import React, { useRef, useEffect, useLayoutEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import ReactDOM from "react-dom";
import VerticalOpacitySlider from "./VerticalOpacitySlider";

interface ColorPickerPopoverProps {
  color: string;
  opacity: number;
  onChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  presetColors: string[];
}

export const ColorPickerPopover: React.FC<ColorPickerPopoverProps> = ({
  color,
  opacity,
  onChange,
  onOpacityChange,
  onClose,
  anchorRef,
  presetColors,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  // liveOpacity state removed (no longer needed)

  useLayoutEffect(() => {
    function updatePosition() {
      if (anchorRef.current) {
        const rect = anchorRef.current.getBoundingClientRect();
        setStyle({
          position: "absolute",
          left: rect.left + window.scrollX,
          top: rect.bottom + 4 + window.scrollY,
          zIndex: 1000,
          minWidth: rect.width,
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        });
      }
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchorRef]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose, anchorRef]);

  const popover = (
    <div ref={popoverRef} style={style} className="color-picker-popover">
      <div className="color-picker-main-row">
        <HexColorPicker color={color} onChange={onChange} />
        <div className="color-picker-opacity-vertical">
          <div className="color-picker-opacity-slider-row">
            <div className="color-picker-opacity-slider-col">
              {/* Debounced vertical slider */}
              <VerticalOpacitySlider
                value={opacity}
                onChange={onOpacityChange}
                height={185}
                trackWidth={24}
                thumbSize={26}
                step={0.01}
                debounceMs={80}
                ariaLabel="Opacity"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="color-picker-presets">
        {presetColors.map((preset) => (
          <button
            key={preset}
            className="color-picker-preset"
            style={{ background: preset }}
            onClick={() => onChange(preset)}
            aria-label={`Select color ${preset}`}
          />
        ))}
      </div>

      <button className="vscode-btn color-picker-close" onClick={onClose}>
        Close
      </button>
    </div>
  );

  return ReactDOM.createPortal(popover, document.body);
};
