"use client";

/**
 * How fast DOL's queue is actually moving, against where a case sits.
 *
 * This is the page's own question drawn once: the rising line is the filing
 * month DOL was working in each month of determinations, and the dashed line is
 * the visitor's filing month. The estimate is the point where one reaches the
 * other, so the chart shows the reasoning rather than asserting a date.
 *
 * The series exists nowhere else. DOL publishes where the queue stands today
 * and keeps no archive, so the rate it advances at cannot be read from DOL at
 * all. It is reconstructed backwards from determination dates in the quarterly
 * disclosure files: for each month of decisions, the filing month at their
 * median.
 *
 * SVG rather than CSS here because it is a line across two axes. Every label
 * sits outside the plot area in its own gutter, and the viewBox is sized to the
 * content so the drawing fills its column instead of floating in padding.
 */

import { useId } from "react";
import { evenTickIndices, tickAnchor } from "@/components/tools/chartTicks";
import { formatMonth, formatMonthShort } from "@/lib/dolFormat";
import { cn } from "@/lib/utils";

export interface FrontierPoint {
  decisionMonth: string;
  medianFilingMonth: string;
  decisions: number;
}

export interface FrontierProgressChartProps {
  history: readonly FrontierPoint[];
  /** The visitor's filing month, drawn as the target line. */
  filingMonth: string;
  className?: string;
}

/** `2026-08` to an absolute month index, for plotting only. */
function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

// Plot geometry. Gutters exist so no label ever sits on the artwork.
const W = 720;
const H = 320;
const PAD_L = 96; // y labels
const PAD_R = 16;
const PAD_T = 20;
const PAD_B = 44; // x labels

export function FrontierProgressChart({
  history,
  filingMonth,
  className,
}: FrontierProgressChartProps) {
  const gradientId = useId();

  const points = [...history].sort((a, b) =>
    a.decisionMonth.localeCompare(b.decisionMonth),
  );
  if (points.length < 2) return null;

  const xs = points.map((p) => monthIndex(p.decisionMonth));
  const ys = points.map((p) => monthIndex(p.medianFilingMonth));
  const target = monthIndex(filingMonth);

  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  // The visitor's month is included in the y range so the target line is always
  // on the canvas. Without this a recent filing month sits far above the plot
  // and the reference line silently clips.
  const yMin = Math.min(...ys, target);
  const yMax = Math.max(...ys, target);

  const xSpan = Math.max(xMax - xMin, 1);
  const ySpan = Math.max(yMax - yMin, 1);

  const px = (v: number) => PAD_L + ((v - xMin) / xSpan) * (W - PAD_L - PAD_R);
  const py = (v: number) => H - PAD_B - ((v - yMin) / ySpan) * (H - PAD_T - PAD_B);

  const line = points
    .map((_, i) => `${i === 0 ? "M" : "L"}${px(xs[i]!)},${py(ys[i]!)}`)
    .join(" ");
  const area = `${line} L${px(xs[xs.length - 1]!)},${H - PAD_B} L${px(xs[0]!)},${H - PAD_B} Z`;

  // Evenly spaced x labels including both ends. Shared with the priority-date
  // chart, because writing it out twice is how the collision came back.
  const xTickIndices = evenTickIndices(points.length);

  // Three y labels: the ends of the observed range plus the midpoint.
  const yTicks = [yMin, Math.round((yMin + yMax) / 2), yMax].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  const toMonth = (idx: number) =>
    `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;

  const targetReached = target <= ys[ys.length - 1]!;

  return (
    <figure className={cn("m-0", className)}>
      {/* The drawing has a minimum width and scrolls inside this container.
          Fitting it to a 390px phone scales the 13px axis labels to about
          5.5px, which is unreadable; shrinking the viewBox instead would make
          the same labels oversized on a desktop. */}
      <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[36rem]"
        role="img"
        aria-label={`DOL's analyst review queue advanced from ${formatMonth(points[0]!.medianFilingMonth)} to ${formatMonth(points[points.length - 1]!.medianFilingMonth)} between ${formatMonth(points[0]!.decisionMonth)} and ${formatMonth(points[points.length - 1]!.decisionMonth)}.`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Horizontal rules, drawn first so the data sits above them. */}
        {yTicks.map((v) => (
          <line
            key={`grid-${v}`}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={py(v)}
            y2={py(v)}
            stroke="currentColor"
            strokeOpacity="0.14"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill={`url(#${gradientId})`} className="text-primary" />
        <path
          d={line}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-primary"
        />
        {points.map((p, i) => (
          <circle
            key={p.decisionMonth}
            cx={px(xs[i]!)}
            cy={py(ys[i]!)}
            r="4"
            fill="currentColor"
            className="text-primary"
          />
        ))}

        {/* The visitor's filing month. Dashed so it reads as a target rather
            than as another measured series. */}
        <line
          x1={PAD_L}
          x2={W - PAD_R}
          y1={py(target)}
          y2={py(target)}
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="7 5"
          strokeOpacity="0.85"
        />

        {yTicks.map((v) => (
          <text
            key={`y-${v}`}
            x={PAD_L - 10}
            y={py(v) + 4}
            textAnchor="end"
            fontSize="13"
            fill="currentColor"
            fillOpacity="0.7"
          >
            {formatMonthShort(toMonth(v))}
          </text>
        ))}

        {xTickIndices.map((idx, i) => (
          <text
            key={`x-${points[idx]!.decisionMonth}`}
            x={px(monthIndex(points[idx]!.decisionMonth))}
            y={H - PAD_B + 22}
            textAnchor={tickAnchor(i, xTickIndices.length)}
            fontSize="13"
            fill="currentColor"
            fillOpacity="0.7"
          >
            {formatMonthShort(points[idx]!.decisionMonth)}
          </text>
        ))}
      </svg>
      </div>

      <figcaption className="mt-4 space-y-2 text-sm leading-relaxed text-foreground/70">
        <p>
          <span className="font-bold text-foreground">The solid line</span> is the
          filing month DOL was deciding in each month across the bottom.{" "}
          <span className="font-bold text-foreground">The dashed line</span> is
          your filing month,{" "}
          <span className="font-bold text-foreground">{formatMonth(filingMonth)}</span>
          {targetReached
            ? ", which the queue has already passed."
            : ". The queue reaches you where the solid line meets it."}
        </p>{" "}
        <p>
          Reconstructed from determination dates in DOL&apos;s disclosure files.
          DOL publishes today&apos;s position but keeps no history, so this
          series cannot be read from DOL directly.
        </p>
      </figcaption>
    </figure>
  );
}
