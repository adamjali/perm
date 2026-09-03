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
 *
 * Two controls sit on it. The window narrows the drawing to the most recent
 * months, because "how fast is it moving lately" and "how fast has it moved
 * across the record" are different questions and the line answers whichever
 * one you point it at. The table is the same series as figures, with the
 * decision count behind each point: a month at the median of 8,890 decisions
 * and a month at the median of 19,787 are not equally solid, and the line
 * draws both at the same weight. The readout names that count for the point
 * under the cursor; the table is where all of them can be compared at once.
 */

import { Fragment, useId, useMemo, useState } from "react";
import { ChartHoverLayer, type HoverPoint } from "@/components/tools/ChartHoverLayer";
import { evenTickIndices, tickAnchor } from "@/components/tools/chartTicks";
import { DataView, ScopeSelect } from "@/components/tools/DataView";
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

function FrontierSvg({
  points,
  filingMonth,
}: {
  points: FrontierPoint[];
  filingMonth: string;
}) {
  const gradientId = useId();

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

  // What the reader can interrogate: one point per month of determinations,
  // at the same coordinates the circles are drawn at, so the readout cannot
  // drift from the line. The unit named is the one drawn - a month of
  // determinations and the median filing month behind it - and the decision
  // count rides along as the detail, because a median over 8,890 decisions
  // and one over 19,787 are not equally solid and the line draws both at the
  // same weight.
  const hover: HoverPoint[] = points.map((p, i) => ({
    x: px(xs[i]!),
    y: py(ys[i]!),
    label: `Decisions in ${formatMonth(p.decisionMonth)}`,
    value: `Median filing month: ${formatMonth(p.medianFilingMonth)}`,
    detail: `Across ${p.decisions.toLocaleString("en-US")} decisions`,
  }));

  return (
    /* The drawing has a minimum width and scrolls inside this container.
       Fitting it to a 390px phone scales the 13px axis labels to about
       5.5px, which is unreadable; shrinking the viewBox instead would make
       the same labels oversized on a desktop. */
    <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[36rem]"
        role="img"
        aria-label={`DOL's analyst review queue advanced from ${formatMonth(points[0]!.medianFilingMonth)} to ${formatMonth(points[points.length - 1]!.medianFilingMonth)} between ${formatMonth(points[0]!.decisionMonth)} and ${formatMonth(points[points.length - 1]!.decisionMonth)}.`}
      >
      {/*
        Colours are named as `var(--primary)` rather than reached through the
        `text-primary` utility, and that is not a style preference.

        globals.css deliberately remaps `.text-primary` to `--primary-text`
        (#1D8229), the darker green that clears 4.5:1 as TEXT. Correct for
        text; wrong for a graphic mark, where the brand lime #2ECC40 is the
        colour and the 3:1 non-text floor applies. Reaching for the utility
        here shipped a forest-green line while three sibling charts, which
        name the variable, shipped lime.

        The gradient is worse. `currentColor` inside a <stop> resolves against
        the STOP element, not the path referencing the gradient, so a class on
        the path can never reach it: the stops computed rgb(0,0,0) and a lime
        ramp was written while a grey one shipped.
      */}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
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

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.decisionMonth}
            cx={px(xs[i]!)}
            cy={py(ys[i]!)}
            r="4"
            fill="var(--primary)"
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

        {/* Last child on purpose: the hit area has to sit above the line, the
            fill and the target rule, or a pointer lands on the paint instead
            of the readout. */}
        <ChartHoverLayer
          points={hover}
          plot={{
            x: PAD_L,
            y: PAD_T,
            width: W - PAD_L - PAD_R,
            height: H - PAD_T - PAD_B,
          }}
          viewBox={{ width: W, height: H }}
          label="Queue position by month of determinations. Use the arrow keys to step through the months."
        />
      </svg>
    </div>
  );
}

/**
 * The same series as figures. `Advanced` is measured against the month before
 * it in the WHOLE record, never in the window on screen, so narrowing the view
 * cannot change what a row says happened.
 */
function FrontierTable({
  rows,
  advance,
  filingMonth,
}: {
  rows: FrontierPoint[];
  advance: Map<string, number | null>;
  filingMonth: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-2 border-border text-left text-sm shadow-hard-sm">
        <caption className="sr-only">
          The filing month DOL was deciding in each month of determinations,
          with the number of decisions behind each figure
        </caption>
        <thead className="bg-foreground text-background">
          <tr>
            <th scope="col" className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider">
              Decisions in
            {" "}</th>
            <th scope="col" className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider">
              Median filing month
            {" "}</th>
            <th scope="col" className="px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Advanced
            {" "}</th>
            <th scope="col" className="hidden px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider sm:table-cell">
              Decisions
            </th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {[...rows].reverse().map((p) => {
            const a = advance.get(p.decisionMonth) ?? null;
            const isTarget = p.medianFilingMonth === filingMonth;
            return (
              <tr
                key={p.decisionMonth}
                className={cn(
                  "border-t border-border/40",
                  isTarget && "bg-tint-primary",
                )}
              >
                <td className="px-3 py-2.5 tabular-nums">
                  {formatMonth(p.decisionMonth)}
                {" "}</td>
                <td className="px-3 py-2.5 font-bold">
                  {formatMonth(p.medianFilingMonth)}
                {" "}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {a === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : a === 0 ? (
                    <span className="text-muted-foreground">no change</span>
                  ) : (
                    `${a > 0 ? "+" : ""}${a} month${Math.abs(a) === 1 ? "" : "s"}`
                  )}
                {" "}</td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-foreground/70 sm:table-cell">
                  {p.decisions.toLocaleString("en-US")}
                {" "}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Windows offered, in months of determinations. */
const FRONTIER_WINDOWS = [6, 12] as const;

export function FrontierProgressChart({
  history,
  filingMonth,
  className,
}: FrontierProgressChartProps) {
  const [window, setWindow] = useState<string>("all");

  const points = useMemo(
    () => [...history].sort((a, b) => a.decisionMonth.localeCompare(b.decisionMonth)),
    [history],
  );

  const advance = useMemo(() => {
    const out = new Map<string, number | null>();
    points.forEach((p, i) => {
      const prev = i > 0 ? points[i - 1] : undefined;
      out.set(
        p.decisionMonth,
        prev
          ? monthIndex(p.medianFilingMonth) - monthIndex(prev.medianFilingMonth)
          : null,
      );
    });
    return out;
  }, [points]);

  if (points.length < 2) return null;

  const n = points.length;
  const take = window === "all" ? n : Number(window);
  const shown = points.slice(Math.max(0, n - take));

  // Only offer a window the record can fill. An option that returns the same
  // chart is a control that does nothing.
  const options = [
    ...FRONTIER_WINDOWS.filter((w) => w < n).map((w) => ({
      value: String(w),
      label: `Last ${w} months`,
    })),
    { value: "all", label: `All ${n} months` },
  ];

  const first = shown[0]!;
  const last = shown[shown.length - 1]!;
  const movedAcross =
    monthIndex(last.medianFilingMonth) - monthIndex(first.medianFilingMonth);
  const elapsed = monthIndex(last.decisionMonth) - monthIndex(first.decisionMonth);

  const controls =
    options.length > 1 ? (
      <Fragment>
        <ScopeSelect
          label="Window"
          value={window}
          onChange={setWindow}
          hint="Narrows the chart and the table to the most recent months of determinations."
          options={options}
        />{" "}
        <p className="text-sm text-foreground/70">
          {formatMonth(first.decisionMonth)} to {formatMonth(last.decisionMonth)}
          {elapsed > 0 ? (
            <>
              {" "}
              <span className="text-muted-foreground">
                ({movedAcross} month{movedAcross === 1 ? "" : "s"} of queue in {elapsed}{" "}
                month{elapsed === 1 ? "" : "s"} of calendar)
              </span>
            </>
          ) : null}
        </p>
      </Fragment>
    ) : undefined;

  return (
    <figure className={cn("m-0", className)}>
      <DataView
        label="Queue advance"
        controls={controls}
        chart={<FrontierSvg points={shown} filingMonth={filingMonth} />}
        table={
          <FrontierTable rows={shown} advance={advance} filingMonth={filingMonth} />
        }
      />

      {/* A legend and a provenance line. What each mark MEANS cannot be read
          off the drawing, so it stays; what the reader is looking AT is now
          answered by pointing at it, and "the queue has already passed your
          month" is the overdue hero's own heading two sections up. */}
      <figcaption className="mt-4 space-y-2 text-sm leading-relaxed text-foreground/70">
        <p>
          <span className="font-bold text-foreground">Solid line</span>: the
          filing month DOL was deciding.{" "}
          <span className="font-bold text-foreground">Dashed</span>: yours,{" "}
          <span className="font-bold text-foreground">{formatMonth(filingMonth)}</span>.
        </p>{" "}
        <p>
          Reconstructed from determination dates in DOL&apos;s disclosure files.
          DOL publishes today&apos;s position but keeps no history, so this
          series can’t be read from DOL directly.
        </p>
      </figcaption>
    </figure>
  );
}
