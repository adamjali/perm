"use client";

import { useCallback, useId, useRef, useState } from "react";

/**
 * A readout for an SVG chart: point at it, or tab to it and use the arrows,
 * and it tells you the value under the cursor.
 *
 * WHY IT EXISTS. Every chart on this site drew a shape and two axis labels and
 * then had no answer to "what is that spike". A reader could see that something
 * happened in July and had no way to ask what. Gridlines at 0 / half / max are
 * a scale, not a readout.
 *
 * ONE LAYER, NOT SIX. Six charts needed the same behaviour, so the geometry
 * stays in each chart (it already knows its own scales) and only the
 * interaction lives here. The chart hands over the points it already plotted.
 *
 * KEYBOARD IS NOT OPTIONAL. This is the craft floor: a hover-only readout hides
 * the data from anyone not using a mouse, which on a phone is everybody. So the
 * layer is focusable, arrow keys step through points, Home and End jump to the
 * ends, and the active value is announced through a live region. On touch, a
 * tap and a drag both work because it listens to pointer events rather than
 * mouse events.
 *
 * THE READOUT NEVER LEAVES THE FRAME. It flips to the other side of the cursor
 * past the midpoint, and clamps vertically, because a tooltip drawn outside the
 * viewBox is simply invisible: an SVG clips at its own edge and there is no
 * scrollbar to reveal it.
 */

export interface HoverPoint {
  /** Plot coordinates, in the parent SVG's own viewBox units. */
  x: number;
  y: number;
  /** What this point IS, e.g. "Week of 14 Jul 2025". */
  label: string;
  /** The value, already formatted, e.g. "3,204 decisions". */
  value: string;
  /** An optional second line, e.g. a share or a comparison. */
  detail?: string;
}

export interface ChartHoverLayerProps {
  points: readonly HoverPoint[];
  /** The plot rectangle in viewBox units: where the pointer is live. */
  plot: { x: number; y: number; width: number; height: number };
  /** The parent viewBox, so the readout can be clamped inside it. */
  viewBox: { width: number; height: number };
  /** Accessible name for the focusable layer. */
  label: string;
  /** Draw a vertical rule through the active point. Off for scatter-like charts. */
  rule?: boolean;
}

const CHAR = 7.4; // JetBrains Mono advance at 13px, measured, for box width.
const LINE = 17;
const PAD = 9;

export function ChartHoverLayer({
  points,
  plot,
  viewBox,
  label,
  rule = true,
}: ChartHoverLayerProps) {
  const [active, setActive] = useState<number | null>(null);
  const ref = useRef<SVGRectElement>(null);
  const liveId = useId();

  const nearest = useCallback(
    (clientX: number) => {
      const el = ref.current;
      if (!el || points.length === 0) return null;
      const box = el.getBoundingClientRect();
      if (box.width === 0) return null;
      // Client pixels back into viewBox units. The rect IS the plot, so its
      // own box is the conversion; no assumption about page scale or zoom.
      const vx = plot.x + ((clientX - box.left) / box.width) * plot.width;
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < points.length; i++) {
        const d = Math.abs(points[i]!.x - vx);
        if (d < bestD) { bestD = d; best = i; }
      }
      return best;
    },
    [points, plot.x, plot.width],
  );

  const step = (delta: number) => {
    setActive((cur) => {
      const next = (cur ?? 0) + delta;
      return Math.max(0, Math.min(points.length - 1, next));
    });
  };

  if (points.length === 0) return null;
  const p = active === null ? null : points[active] ?? null;

  // Box geometry from the longest line, so it fits its own content.
  const lines = p ? [p.label, p.value, ...(p.detail ? [p.detail] : [])] : [];
  const boxW = Math.max(...lines.map((l) => l.length * CHAR), 90) + PAD * 2;
  const boxH = lines.length * LINE + PAD * 2 - 4;
  const flip = p ? p.x > plot.x + plot.width / 2 : false;
  const boxX = p ? (flip ? p.x - boxW - 12 : p.x + 12) : 0;
  const boxY = p
    ? Math.max(2, Math.min(viewBox.height - boxH - 2, p.y - boxH / 2))
    : 0;

  return (
    <g>
      {p ? (
        <g pointerEvents="none">
          {rule ? (
            <line
              x1={p.x}
              x2={p.x}
              y1={plot.y}
              y2={plot.y + plot.height}
              stroke="var(--foreground)"
              strokeWidth="1.5"
              opacity="0.45"
            />
          ) : null}
          <circle
            cx={p.x}
            cy={p.y}
            r="6"
            fill="var(--primary)"
            stroke="var(--foreground)"
            strokeWidth="2.5"
          />
          {/* Inverted panel: it has to read over the line, the fill and the
              gridlines alike, and this is the site's existing high-contrast
              pair rather than a new colour. */}
          <rect
            x={boxX}
            y={boxY}
            width={boxW}
            height={boxH}
            fill="var(--foreground)"
            stroke="var(--foreground)"
            strokeWidth="2"
          />
          {lines.map((l, i) => (
            <text
              key={l + i}
              x={boxX + PAD}
              y={boxY + PAD + 12 + i * LINE}
              fontSize="13"
              className="font-mono"
              fill="var(--background)"
              fontWeight={i === 1 ? 700 : 400}
            >
              {l}
            </text>
          ))}
        </g>
      ) : null}

      <rect
        ref={ref}
        x={plot.x}
        y={plot.y}
        width={plot.width}
        height={plot.height}
        fill="transparent"
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={points.length - 1}
        aria-valuenow={active ?? 0}
        aria-valuetext={p ? `${p.label}, ${p.value}` : label}
        aria-describedby={liveId}
        style={{ cursor: "crosshair", outlineOffset: "2px" }}
        onPointerMove={(e) => {
          const i = nearest(e.clientX);
          if (i !== null) setActive(i);
        }}
        onPointerDown={(e) => {
          // A tap on touch should read out, not just a drag.
          const i = nearest(e.clientX);
          if (i !== null) setActive(i);
        }}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((cur) => cur ?? 0)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
          else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
          else if (e.key === "Home") { e.preventDefault(); setActive(0); }
          else if (e.key === "End") { e.preventDefault(); setActive(points.length - 1); }
          else if (e.key === "Escape") { setActive(null); }
        }}
      />

      {/* The value in text, for a screen reader. `aria-valuetext` covers the
          slider itself; this covers pointer use, where focus never moves. */}
      <foreignObject x={0} y={0} width={1} height={1} aria-hidden="false">
        <span
          id={liveId}
          // eslint-disable-next-line react/no-unknown-property
          {...{ xmlns: "http://www.w3.org/1999/xhtml" }}
          role="status"
          aria-live="polite"
          style={{
            position: "absolute", width: 1, height: 1, overflow: "hidden",
            clip: "rect(0 0 0 0)", whiteSpace: "nowrap",
          }}
        >
          {p ? `${p.label}, ${p.value}${p.detail ? `, ${p.detail}` : ""}` : ""}
        </span>
      </foreignObject>
    </g>
  );
}
