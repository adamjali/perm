"use client";

import { Fragment, useMemo, useState } from "react";
import { ChartTips } from "@/components/data/ChartTips";
import { evenTickIndices } from "@/components/tools/chartTicks";
import { ChartHoverLayer, type HoverPoint } from "@/components/tools/ChartHoverLayer";

import { formatAsOf, formatMonthShort, formatMonth } from "@/lib/dolFormat";
import { cn } from "@/lib/utils";
import { MS_PER_DAY } from "@/lib/time";
import { DataView, ScopeSelect } from "./DataView";

/**
 * DOL's published queue position, drawn over our record of its snapshots.
 *
 * This is the processing-times page's own question — how fast is the line
 * actually moving — answered from the page's own data: every FLAG snapshot we
 * have stored, plotted as a step (a queue position is a step function; a
 * sloped line between readings would claim movement nobody observed).
 *
 * The table beside it is not a second copy of the chart, it is the archive:
 * the date DOL published each reading, the month it named, and how far the
 * line moved since the reading before. DOL overwrites its own page and keeps
 * nothing, so those rows exist here and nowhere else.
 *
 * The drawing gets a min-width and scrolls in its own container: SVG text
 * scales with the viewBox, and 12px labels in a 306px phone column render at
 * 5.5px — measured, not guessed.
 */

export interface QueueSnapshotPoint {
  /** When DOL published the reading, ISO date. */
  asOf: string;
  /** The analyst-review queue month at that reading, "YYYY-MM". */
  frontierMonth: string;
}

export interface QueueHistoryChartProps {
  points: readonly QueueSnapshotPoint[];
  className?: string;
  /**
   * What the points ARE. "readings" (the default): DOL's own published
   * queue month, dated by the day DOL published it. "reconstructed": one
   * point per month of determinations in DOL's disclosure files, at the
   * filing month of their median, `asOf` being that month's first day.
   *
   * The same drawing serves both, and its words must follow the kind: "DOL
   * published" or "Each step is a published DOL reading" over a
   * reconstructed series would present months nobody at DOL ever published as
   * DOL's own readings.
   */
  kind?: QueueSeriesKind;
}

export type QueueSeriesKind = "readings" | "reconstructed";

/** Every word that changes with the series' kind, in one place. */
const KIND_COPY = {
  readings: {
    view: "DOL queue readings",
    select: "Readings",
    hint: "Narrows the chart and the table to the most recent readings.",
    unit: "",
    windows: [6, 12, 26],
    svg: "DOL's analyst review queue month at each published snapshot",
    hover: "Queue month at each reading. Use the arrow keys to step through the readings.",
    caption:
      "Every DOL analyst-review queue reading on record, with the date DOL published it and how far the queue moved since the previous reading",
    dateHead: "DOL published",
    monthHead: "Working filings from",
    figcaption: "Each step is a published DOL reading.",
  },
  reconstructed: {
    view: "Queue position rebuilt from DOL's decisions",
    select: "Months",
    hint: "Narrows the chart and the table to the most recent months of decisions.",
    unit: " months",
    windows: [6, 12, 24],
    svg: "Filing month at the median of each month's PERM determinations, rebuilt from DOL's disclosure files",
    hover: "Median filing month for each month of decisions. Use the arrow keys to step through the months.",
    caption:
      "For each month of PERM determinations in DOL's disclosure files, the filing month at their median, and how far it moved from the month before",
    dateHead: "Decided in",
    monthHead: "Median filing month",
    figcaption:
      "Each step is one month of DOL determinations, at the filing month of their median. Rebuilt from DOL's files: DOL never published these as readings.",
  },
} as const;

/** The date a point is plotted at, as a reader should see it. */
function pointLabel(kind: QueueSeriesKind, asOf: string, short: boolean): string {
  if (kind === "reconstructed") {
    const month = asOf.slice(0, 7);
    return (short ? formatMonthShort(month) : formatMonth(month)) ?? month;
  }
  return short ? formatAsOfShort(asOf) : (formatAsOf(asOf) ?? asOf);
}

const W = 720;
const H = 260;
/**
 * `left` is sized to the WIDEST y label, measured rather than guessed.
 *
 * This axis is unusual: the y values are MONTHS ("Nov 2025"), not numbers, so
 * the labels are eight characters wide where most charts here have three or
 * four. At 12px in the mono face that is 57.6px, and the labels are drawn at
 * `left - 8` with `textAnchor="end"`, so they extend leftward from there.
 *
 * At left: 64 they started at x = -1.6 and hung outside the viewBox - measured
 * with `getBBox()` on the live page, which is the only way this repo trusts
 * text metrics after a characters-times-7 estimate reported every label at the
 * wrong place. 76 puts the widest label at x = 10.4, clear of the edge, and
 * costs 12px of a 640px plot.
 */
/**
 * "2026-08-20" to "20 Aug 2026".
 *
 * The x axis carries DOL's own as-of dates. `formatAsOf` gives "August 20,
 * 2026", which is right in prose and 13 characters too wide when three of
 * them share a 720-unit axis - the end ones are anchored to the edges, so a
 * long label there runs straight out of the viewBox. This is the same
 * information at a width the axis can hold.
 */
function formatAsOfShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const name = MONTH_ABBR[Number(m[2]) - 1];
  return name ? `${Number(m[3])} ${name} ${m[1]}` : iso;
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export const Y_LABEL_GAP = 8;
export const PAD = { top: 18, right: 16, bottom: 40, left: 76 };

/**
 * Width of one character of the y labels, at their own font size.
 *
 * MEASURED, not assumed: `getBBox()` on the live chart gave 57.6px for the
 * eight-character "Sep 2025" at `fontSize=12` in `var(--font-mono)`, so the
 * advance is 0.6em. A proportional face would make this meaningless, which is
 * why the labels are mono and why the test below pins both together.
 */
export const Y_LABEL_FONT_PX = 12;
export const MONO_ADVANCE_EM = 0.6;

/** Windows offered are per kind (KIND_COPY); only those the record can fill. */

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

function dayIndex(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY;
}

/**
 * The step drawing itself. Null when the slice cannot carry a chart.
 *
 * It takes the movement maps rather than deriving them, for the same reason
 * the table does: see the hover points below.
 */
function QueueHistorySvg({
  sorted,
  moved,
  gapDays,
  kind,
}: {
  sorted: QueueSnapshotPoint[];
  moved: Map<string, number | null>;
  gapDays: Map<string, number | null>;
  kind: QueueSeriesKind;
}) {
  if (sorted.length < 2) return null;

  const x0 = dayIndex(sorted[0]!.asOf);
  const x1 = dayIndex(sorted[sorted.length - 1]!.asOf);
  const months = sorted.map((p) => monthIndex(p.frontierMonth));
  const yMin = Math.min(...months);
  const yMax = Math.max(...months);
  if (x1 === x0 || yMax === yMin) return null;

  const px = (iso: string) =>
    PAD.left + ((dayIndex(iso) - x0) / (x1 - x0)) * (W - PAD.left - PAD.right);
  const py = (month: string) =>
    H - PAD.bottom -
    ((monthIndex(month) - yMin) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);

  // Step path: hold the old level until the reading that moved it.
  let d = `M ${px(sorted[0]!.asOf).toFixed(1)} ${py(sorted[0]!.frontierMonth).toFixed(1)}`;
  for (let i = 1; i < sorted.length; i += 1) {
    const p = sorted[i]!;
    d += ` H ${px(p.asOf).toFixed(1)} V ${py(p.frontierMonth).toFixed(1)}`;
  }

  /*
   * GRIDLINES at every observed level, LABELS on a subset.
   *
   * Labelling every distinct frontier month fails as the series grows: few at
   * two snapshots, thirty at thirty, and consecutive months overprint into a
   * smear. The lines still mark every
   * level the queue actually sat at, because that is information; only the
   * labels are thinned, using the same helper every other chart on the site
   * uses rather than a fourth private copy of the arithmetic.
   */
  const levels = [...new Set(sorted.map((p) => p.frontierMonth))].sort();
  const labelled = new Set(
    evenTickIndices(levels.length, 6).map((i) => levels[i]!),
  );

  /*
   * X ticks: first, middle, last - DE-DUPLICATED.
   *
   * With two snapshots `Math.floor(2 / 2)` is 1, so "middle" IS the last
   * point, and without de-duplication the same date renders twice at the
   * right-hand edge: once centred on its own x, once anchored to the frame. A
   * thin series is a common state, not an edge case.
   */
  /*
   * DE-DUPLICATING WAS NOT ENOUGH: two DIFFERENT dates can still collide.
   *
   * De-duplication stops the same date printing twice. It does not stop the
   * middle tick landing on top of an edge one, because the ticks are chosen by
   * INDEX and drawn by DATE, and those only agree when the readings are evenly
   * spaced in time. DOL's are not: readings a week apart and then a day apart
   * put the middle tick at 87.5% of the span, 40 units from a right-hand label
   * anchored to the frame.
   *
   * So the middle tick has to EARN its place: it is kept only when its box
   * clears both edge labels, and dropped when it cannot. A solver that places
   * a label it knows collides is the same defect as one that never checked.
   *
   * The width is derived from the label's own length rather than assumed, and
   * the per-character figure errs HIGH on purpose: over-estimating drops a
   * tick, under-estimating overlaps two, and only one of those is visible to
   * a reader as a bug.
   */
  const CHAR_W = 12 * 0.62; // 12px mono, conservative advance
  const GAP = 12;
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const mid = sorted[Math.floor(sorted.length / 2)]!;

  const tick = (p: QueueSnapshotPoint) => pointLabel(kind, p.asOf, true);
  const leftEdge = PAD.left + tick(first).length * CHAR_W;
  const rightEdge = W - PAD.right - tick(last).length * CHAR_W;
  const midHalf = (tick(mid).length * CHAR_W) / 2;
  const midX = px(mid.asOf);
  const midFits =
    midX - midHalf >= leftEdge + GAP && midX + midHalf <= rightEdge - GAP;

  const xTicks = [
    ...new Map(
      (midFits ? [first, mid, last] : [first, last]).map(
        (p) => [p.asOf, p] as const,
      ),
    ).values(),
  ];

  /*
   * THE POINTS A READER CAN INTERROGATE: one per READING, not one per step.
   *
   * A reading where the queue did not move is a fact about the queue - which
   * is why the table keeps every one of them - and it is drawn, as the length
   * of the flat tread. Every point sits exactly on the path, because the step
   * turns the corner at (px(asOf), py(frontierMonth)) for every i including
   * the first, so these are the same two scale functions `d` is built from
   * rather than a second copy of the arithmetic.
   *
   * MOVEMENT COMES FROM THE PARENT'S MAPS, NOT FROM `sorted`. Those are
   * computed over the WHOLE record. Deriving them here would recompute them
   * over the window, so narrowing to the last six readings would make the
   * oldest one on screen read "first reading" in the tooltip while the table
   * three inches away still said "+2 months". That is precisely the defect the
   * table's own test guards against, one surface over.
   *
   * The strings are the axes' own: the date exactly as the x axis prints it,
   * the month exactly as the y axis prints it, the movement exactly as the
   * table prints it. A readout in a fourth format is a fourth figure to
   * reconcile.
   */
  const hover: HoverPoint[] = sorted.map((p) => {
    const m = moved.get(p.asOf) ?? null;
    const g = gapDays.get(p.asOf) ?? null;
    // A month-by-month series is a month apart by construction; "over 31
    // days" would only restate the axis.
    const span =
      kind === "readings" && g !== null && g > 0 ? ` over ${g} day${g === 1 ? "" : "s"}` : "";
    return {
      x: px(p.asOf),
      y: py(p.frontierMonth),
      label: kind === "readings" ? p.asOf : `Decided in ${tick(p)}`,
      value: `${kind === "readings" ? "Working filings from" : "Median filing month"} ${formatMonthShort(p.frontierMonth) ?? p.frontierMonth}`,
      detail:
        m === null
          ? undefined
          : m === 0
            ? `No change${span}`
            : `${m > 0 ? "+" : ""}${m} month${Math.abs(m) === 1 ? "" : "s"}${span}`,
    };
  });

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[560px] border-2 border-border bg-card shadow-hard-sm"
        role="img"
        aria-label={KIND_COPY[kind].svg}
      >
        {/* Grid + y labels */}
        {levels.map((m) => (
          <g key={m}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={py(m)}
              y2={py(m)}
              stroke="var(--border)"
              strokeOpacity="0.25"
            />
            {labelled.has(m) ? (
              <text
                x={PAD.left - Y_LABEL_GAP}
                y={py(m) + 4}
                textAnchor="end"
                fontSize="12"
                fontFamily="var(--font-mono)"
                fontWeight="700"
                fill="var(--foreground)"
                fillOpacity="0.7"
              >
                {formatMonthShort(m) ?? m}
              </text>
            ) : null}
          </g>
        ))}

        {/* X labels */}
        {xTicks.map((p, i) => (
          <text
            key={p.asOf}
            x={
              i === 0
                ? PAD.left
                : i === xTicks.length - 1
                  ? W - PAD.right
                  : px(p.asOf)
            }
            y={H - PAD.bottom + 24}
            textAnchor={
              i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"
            }
            fontSize="12"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            fill="var(--foreground)"
            fillOpacity="0.7"
          >
            {/* FORMATTED, not the raw ISO string. These are DOL's own as-of
                dates and they were rendering as "2026-08-20" - the only raw
                ISO dates anywhere on the site, against `formatAsOf` used
                everywhere else. Short form, because three of these sit under
                a 720-unit axis and the full "August 20, 2026" collides. */}
            {tick(p)}
          </text>
        ))}

        {/* The step line, primary over an ink underlay for weight. */}
        <path d={d} fill="none" stroke="var(--border)" strokeWidth="6" />
        <path d={d} fill="none" stroke="var(--primary)" strokeWidth="3.5" />

        {/* Reading dots at each step change only. */}
        {sorted
          .filter((p, i) => i === 0 || p.frontierMonth !== sorted[i - 1]!.frontierMonth)
          .map((p) => (
            <circle
              key={p.asOf}
              cx={px(p.asOf)}
              cy={py(p.frontierMonth)}
              r="5"
              fill="var(--primary)"
              stroke="var(--border)"
              strokeWidth="2"
            />
          ))}

        {/* LAST, after every painted element: the hit area is a transparent
            rect over the whole plot, so anything drawn after it would take the
            pointer instead. */}
        <ChartHoverLayer
          points={hover}
          plot={{
            x: PAD.left,
            y: PAD.top,
            width: W - PAD.left - PAD.right,
            height: H - PAD.top - PAD.bottom,
          }}
          viewBox={{ width: W, height: H }}
          label={KIND_COPY[kind].hover}
        />
      </svg>
    </div>
  );
}

/**
 * The archive as rows. Movement is measured against the reading before it in
 * the WHOLE record, not the slice on screen, so narrowing the window never
 * changes what a row says happened.
 */
function QueueHistoryTable({
  shown,
  moved,
  gapDays,
  kind,
}: {
  shown: QueueSnapshotPoint[];
  moved: Map<string, number | null>;
  gapDays: Map<string, number | null>;
  kind: QueueSeriesKind;
}) {
  const copy = KIND_COPY[kind];
  // Days between readings is a fact about DOL's publishing; between calendar
  // months it is always 28 to 31 and says nothing.
  const showGap = kind === "readings";
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-2 border-border text-left text-sm shadow-hard-sm">
        <caption className="sr-only">{copy.caption}</caption>
        <thead className="bg-foreground text-background">
          <tr>
            <th scope="col" className="px-3 py-2 font-mono text-sm font-bold uppercase tracking-wider">
              {copy.dateHead}
            {" "}</th>
            <th scope="col" className="px-3 py-2 font-mono text-sm font-bold uppercase tracking-wider">
              {copy.monthHead}
            {" "}</th>
            <th scope="col" className="px-3 py-2 text-right font-mono text-sm font-bold uppercase tracking-wider">
              Moved
            {" "}</th>
            {showGap ? (
              <th scope="col" className="hidden px-3 py-2 text-right font-mono text-sm font-bold uppercase tracking-wider sm:table-cell">
                Days since last{" "}
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="bg-card">
          {[...shown].reverse().map((p) => {
            const m = moved.get(p.asOf) ?? null;
            const g = gapDays.get(p.asOf) ?? null;
            return (
              <tr key={p.asOf} className="border-t border-border/40">
                <td className="px-3 py-2.5 tabular-nums">
                  {kind === "readings" ? p.asOf : pointLabel(kind, p.asOf, false)}
                {" "}</td>
                <td className="px-3 py-2.5 font-bold">
                  {formatMonth(p.frontierMonth) ?? p.frontierMonth}
                {" "}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {m === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : m === 0 ? (
                    <span className="text-muted-foreground">no change</span>
                  ) : (
                    `${m > 0 ? "+" : ""}${m} month${Math.abs(m) === 1 ? "" : "s"}`
                  )}
                {" "}</td>
                {showGap ? (
                  <td className="hidden px-3 py-2.5 text-right tabular-nums text-foreground/70 sm:table-cell">
                    {g === null ? "—" : g}
                  {" "}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function QueueHistoryChart({ points, className, kind = "readings" }: QueueHistoryChartProps) {
  const copy = KIND_COPY[kind];
  // Oldest first. The chart de-duplicates visually by drawing steps; the table
  // keeps every reading, because "DOL published the same month again" is
  // itself a fact about the queue.
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.asOf.localeCompare(b.asOf)),
    [points],
  );

  const [window, setWindow] = useState<string>("all");

  // Movement and the gap that produced it, computed once over the full record.
  const { moved, gapDays } = useMemo(() => {
    const m = new Map<string, number | null>();
    const g = new Map<string, number | null>();
    sorted.forEach((p, i) => {
      const prev = i > 0 ? sorted[i - 1] : undefined;
      m.set(p.asOf, prev ? monthIndex(p.frontierMonth) - monthIndex(prev.frontierMonth) : null);
      g.set(p.asOf, prev ? Math.round(dayIndex(p.asOf) - dayIndex(prev.asOf)) : null);
    });
    return { moved: m, gapDays: g };
  }, [sorted]);

  if (sorted.length < 2) return null;

  const n = sorted.length;
  const take = window === "all" ? n : Number(window);
  const shown = sorted.slice(Math.max(0, n - take));

  // Only offer a window the record can actually fill. A "last 26 readings"
  // option over 9 readings is a control that does nothing, which is worse
  // than no control.
  const options = [
    ...copy.windows.filter((w) => w < n).map((w) => ({
      value: String(w),
      label: `Last ${w}${copy.unit}`,
    })),
    { value: "all", label: `All ${n}` },
  ];

  const first = shown[0]!;
  const last = shown[shown.length - 1]!;
  const spanMonths =
    monthIndex(last.frontierMonth) - monthIndex(first.frontierMonth);

  const rangeControl =
    options.length > 1 ? (
      <Fragment>
        <ScopeSelect
          label={copy.select}
          value={window}
          onChange={setWindow}
          hint={copy.hint}
          options={options}
        />{" "}
        <p className="text-sm text-foreground/70">
          {pointLabel(kind, first.asOf, false)} to{" "}
          {pointLabel(kind, last.asOf, false)}
          {spanMonths > 0 ? (
            <>
              {" "}
              <span className="text-muted-foreground">
                (the queue advanced {spanMonths} month{spanMonths === 1 ? "" : "s"} across
                it)
              </span>
            </>
          ) : null}
        </p>
      </Fragment>
    ) : undefined;

  const chart = <QueueHistorySvg sorted={shown} moved={moved} gapDays={gapDays} kind={kind} />;

  return (
    <figure className={cn("m-0", className)}>
      <DataView
        label={copy.view}
        controls={rangeControl}
        chart={
          chart ?? (
            <p className="border-2 border-border bg-card p-6 text-base text-foreground/70 shadow-hard-sm">
              The queue month didn’t change across these {shown.length} readings, so
              there’s no step to draw. The table has every reading and its date.
            </p>
          )
        }
        table={<QueueHistoryTable shown={shown} moved={moved} gapDays={gapDays} kind={kind} />}
      />
      {/* Provenance only. The second sentence used to describe the flat
          stretches; the readout now names each one, with its length in days. */}
      <figcaption className="mt-3 text-sm text-foreground/70">
        {copy.figcaption}
      </figcaption>
    </figure>
  );
}

/**
 * How many PERM cases DOL actually decided, month by month.
 *
 * It sits in this file because it answers the same page's other half of the
 * same question. The step chart above is where the queue stands; this is how
 * much work went through it to get there. Both are the processing-times
 * page's record of the queue over time, and keeping them together is what
 * stopped the tick and window logic being written out twice.
 *
 * DIFFERENT SOURCE, AND IT MATTERS. The readings above come from DOL's weekly
 * FLAG page. These counts come from the quarterly disclosure files, which are
 * a different publication on a different cadence, so the caller labels them
 * separately rather than letting a reader assume one freshness for the page.
 *
 * Bars in HTML rather than SVG, for the same reason the prevailing-wage
 * backlog uses them: a horizontal bar chart cannot overflow its container and
 * needs no viewBox arithmetic.
 */

export interface DecisionMonthPoint {
  /** "YYYY-MM". */
  month: string;
  decisions: number;
}

export interface DecisionsByMonthProps {
  points: readonly DecisionMonthPoint[];
  className?: string;
}

const DECISION_WINDOWS = [6, 12] as const;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2 : s[mid] ?? 0;
}

export function DecisionsByMonth({ points, className }: DecisionsByMonthProps) {
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.month.localeCompare(b.month)),
    [points],
  );

  const [window, setWindow] = useState<string>("all");

  const changes = useMemo(() => {
    const out = new Map<string, number | null>();
    sorted.forEach((p, i) => {
      const prev = i > 0 ? sorted[i - 1] : undefined;
      out.set(p.month, prev ? p.decisions - prev.decisions : null);
    });
    return out;
  }, [sorted]);

  if (sorted.length < 2) return null;

  const n = sorted.length;
  const take = window === "all" ? n : Number(window);
  const shown = sorted.slice(Math.max(0, n - take));

  const options = [
    ...DECISION_WINDOWS.filter((w) => w < n).map((w) => ({
      value: String(w),
      label: `Last ${w} months`,
    })),
    { value: "all", label: `All ${n} months` },
  ];

  const max = Math.max(...shown.map((p) => p.decisions), 1);
  const windowTotal = shown.reduce((s, p) => s + p.decisions, 0);
  const med = median(sorted.map((p) => p.decisions));

  // A month that collapses to almost nothing is a real thing in this record
  // and it looks exactly like a broken chart. Name it with both figures and
  // stop there: why it happened is not in the files, and guessing would be
  // the one thing on this page that is not measured.
  const lowest = sorted.reduce((a, b) => (b.decisions < a.decisions ? b : a));
  const collapsed = med > 0 && lowest.decisions < med * 0.1 ? lowest : null;

  return (
    <figure className={cn("m-0", className)}>
      <DataView
        label="PERM decisions per month"
        controls={
          options.length > 1 ? (
            <Fragment>
              <ScopeSelect
                label="Window"
                value={window}
                onChange={setWindow}
                hint="Narrows the bars and the table to the most recent months of decisions."
                options={options}
              />{" "}
              <p className="text-sm text-foreground/70">
                {shown.length.toLocaleString("en-US")} months,{" "}
                {windowTotal.toLocaleString("en-US")} decisions
              </p>
            </Fragment>
          ) : undefined
        }
        chart={
          <ChartTips label="PERM decisions per month">
          <ol className="space-y-2">
            {shown.map((p) => {
              const c = changes.get(p.month) ?? null;
              return (
              <Fragment key={p.month}>
                {" "}
                <li
                  data-tip={[
                    formatMonth(p.month) ?? p.month,
                    `${p.decisions.toLocaleString("en-US")} decisions`,
                    c === null ? null : `${c > 0 ? "+" : ""}${c.toLocaleString("en-US")} on the month before`,
                    windowTotal > 0 ? `${((p.decisions / windowTotal) * 100).toFixed(1)}% of the window` : null,
                  ]
                    .filter(Boolean)
                    .join("\n")}
                  className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[9rem_1fr_5.5rem]"
                >
                  <span className="text-sm text-foreground/70">
                    {formatMonth(p.month)}
                  </span>{" "}
                  <span className="h-6 w-full border-2 border-border bg-muted">
                    <span
                      className="block h-full bg-primary"
                      style={{
                        width: `${Math.max((p.decisions / max) * 100, 1.5)}%`,
                      }}
                    />
                  </span>{" "}
                  <span className="text-right text-sm tabular-nums text-foreground/70">
                    {p.decisions.toLocaleString("en-US")}
                  </span>
                </li>
              </Fragment>
              );
            })}
          </ol>
          </ChartTips>
        }
        table={
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-2 border-border text-left text-sm shadow-hard-sm">
              <caption className="sr-only">
                PERM determinations recorded in DOL&apos;s disclosure files, by month
                of decision
              </caption>
              <thead className="bg-foreground text-background">
                <tr>
                  <th scope="col" className="px-3 py-2 font-mono text-sm font-bold uppercase tracking-wider">
                    Month
                  {" "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-mono text-sm font-bold uppercase tracking-wider">
                    Decisions
                  {" "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-mono text-sm font-bold uppercase tracking-wider">
                    Change
                  {" "}</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-mono text-sm font-bold uppercase tracking-wider sm:table-cell">
                    Share of window{" "}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-card">
                {[...shown].reverse().map((p) => {
                  const c = changes.get(p.month) ?? null;
                  return (
                    <tr key={p.month} className="border-t border-border/40">
                      <td className="px-3 py-2.5 font-bold">{formatMonth(p.month)}{" "}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {p.decisions.toLocaleString("en-US")}
                      {" "}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-foreground/70">
                        {c === null
                          ? "—"
                          : `${c > 0 ? "+" : ""}${c.toLocaleString("en-US")}`}
                      {" "}</td>
                      <td className="hidden px-3 py-2.5 text-right tabular-nums text-foreground/70 sm:table-cell">
                        {windowTotal > 0
                          ? `${((p.decisions / windowTotal) * 100).toFixed(1)}%`
                          : "—"}
                      {" "}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        }
      />
      <figcaption className="mt-3 space-y-2 text-sm leading-relaxed text-foreground/70">
        <p>
          Determinations recorded in DOL&apos;s quarterly disclosure files, counted
          by the month the decision was issued. The median month in this record
          carries {Math.round(med).toLocaleString("en-US")} decisions.
        </p>
        {collapsed ? (
          <p>
            {formatMonth(collapsed.month)} carries{" "}
            {collapsed.decisions.toLocaleString("en-US")}. That’s what the files
            contain for that month, and the files don’t say why.
          </p>
        ) : null}
      </figcaption>
    </figure>
  );
}
