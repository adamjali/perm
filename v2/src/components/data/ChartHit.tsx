import type { ReactNode } from "react";

/**
 * The hover target for one point or bar of an SVG chart, inside `ChartTips`.
 *
 * A line is a few pixels wide and a short bar may be no height at all, so a
 * reader can't hover either. Each point gets a transparent column the full
 * height of the plot instead, carrying the point's `data-tip`, and a ring at
 * the point itself (or, for a bar chart, the bar passed as `children`). The
 * ring and the bar have no stroke of their own: they inherit the outline
 * ChartTips' CSS gives the active mark, so they show it only while theirs is
 * the one being read. The column says `stroke="none"` so the outline lands on
 * the mark, not around the column.
 *
 * Plain markup with no hooks, so a server-rendered chart stays one. Draw the
 * columns after the lines, so they sit on top and receive the pointer.
 */
export function ChartHit({
  tip,
  x,
  width,
  y,
  height,
  cx,
  cy,
  r = 5,
  children,
}: {
  tip: string;
  /** The column's left edge, in the chart's own units. */
  x: number;
  width: number;
  /** The column's top edge (the plot's top) and its height. */
  y: number;
  height: number;
  /** Where the point is drawn; omit to mark the column alone. */
  cx?: number;
  cy?: number;
  r?: number;
  /** The visible mark (a bar), outlined while this column is active. */
  children?: ReactNode;
}) {
  return (
    <g data-tip={tip}>
      {children}
      <rect x={x} y={y} width={Math.max(0, width)} height={Math.max(0, height)} fill="transparent" stroke="none" />
      {cx !== undefined && cy !== undefined ? <circle cx={cx} cy={cy} r={r} fill="transparent" /> : null}
    </g>
  );
}

/**
 * Evenly spaced columns for points at x(i): each column runs halfway to its
 * neighbours, clamped to the plot's left and right edges.
 */
export function hitSpan(i: number, n: number, x: (i: number) => number, left: number, right: number): { x: number; width: number } {
  const here = x(i);
  const lo = i > 0 ? (x(i - 1) + here) / 2 : left;
  const hi = i < n - 1 ? (here + x(i + 1)) / 2 : right;
  return { x: lo, width: hi - lo };
}
