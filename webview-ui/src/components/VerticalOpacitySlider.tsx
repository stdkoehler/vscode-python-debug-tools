import React from "react";
import { Range, Direction } from "react-range";

/**
 * VerticalOpacitySlider (react-range)
 * - value in [0..1], bottom→top
 * - Debounced external onChange (like react-colorful).
 * - Dynamically centers the thumb relative to trackWidth/height.
 */
export default function VerticalOpacitySlider({
  value,
  onChange,
  onLiveChange,
  height = 160,
  trackWidth = 24,
  thumbSize = 18,
  step = 0.01,
  debounceMs = 80, // adjust to taste
  ariaLabel = "Opacity",
}: {
  value: number; // 0..1
  onChange: (v: number) => void; // debounced (and final) change
  onLiveChange?: (v: number) => void; // immediate change on every frame (optional)
  height?: number;
  trackWidth?: number;
  thumbSize?: number;
  step?: number;
  debounceMs?: number;
  ariaLabel?: string;
}) {
  const [vals, setVals] = React.useState([clamp01(value)]);
  const debouncedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(() => {
    setVals([clamp01(value)]);
  }, [value]);

  const emitDebounced = React.useCallback(
    (v: number) => {
      if (debouncedTimer.current) clearTimeout(debouncedTimer.current);
      debouncedTimer.current = setTimeout(() => {
        onChange?.(v);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  const clearDebounce = React.useCallback(() => {
    if (debouncedTimer.current) {
      clearTimeout(debouncedTimer.current);
      debouncedTimer.current = null;
    }
  }, []);

  const borderRadius = Math.max(12, Math.floor(trackWidth * 0.6));

  return (
    <Range
      values={vals}
      min={0}
      max={1}
      step={step}
      direction={Direction.Up}
      onChange={(v) => {
        setVals(v); // local update
        onLiveChange?.(v[0]); // for immediate label/preview updates
        emitDebounced(v[0]); // debounced parent update
      }}
      onFinalChange={(v) => {
        clearDebounce();
        onChange?.(v[0]); // always commit immediately on release
      }}
      renderTrack={({ props, children }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { key, ...rest } = props as Record<string, any>;
        return (
          <div
            key={key}
            {...rest}
            className="vertical-opacity-slider"
            style={{
              ...rest.style,
              height,
              width: trackWidth,
              borderRadius,
              // boxSizing: "border-box",
              // border: "1px solid #dadce0",
              // boxShadow: "inset 0 0 2px rgba(0,0,0,0.15)",
              // checkerboard + vertical black→transparent gradient
              background:
                "linear-gradient(to bottom, rgba(0,0,0,1), rgba(0,0,0,0)), " +
                "repeating-conic-gradient(#d8d8d8 0% 25%, #ffffff 0% 50%) 50% / 12px 12px",
              position: "relative",
              display: "flex",
              alignItems: "stretch",
              justifyContent: "center",
            }}
          >
            {children}
          </div>
        );
      }}
      renderThumb={({ props, value: v }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { key, ...rest } = props as Record<string, any>;
        return (
          <div
            key={key}
            {...rest}
            role="slider"
            aria-label={ariaLabel}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={Number(v.toFixed(2))}
            className="vertical-opacity-slider-thumb"
            style={{
              ...rest.style,
              height: thumbSize,
              width: thumbSize,
              borderRadius: "50%",
              border: "2px solid #ffffff", // white outline
              boxShadow: "0 0 4px rgba(0,0,0,0.25)",
              cursor: "grab",
              display: "grid",
              placeItems: "center",
              left: 0,
              right: 0,
              margin: "auto",
            }}
          ></div>
        );
      }}
    />
  );
}

function clamp01(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
