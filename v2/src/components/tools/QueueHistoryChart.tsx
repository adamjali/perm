"use client";

import { Fragment, useMemo, useState } from "react";

import { formatMonthShort, formatMonth } from "@/lib/dolFormat";
import { cn } from "@/lib/utils";
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
}

const W = 720;
const H = 260;
const PAD = { top: 18, right: 16, bottom: 40, left: 64 };

/** Windows offered, in readings. Only those the record can actually fill. */
const WINDOWS = [6, 12, 26] as const;

function monthIndex(month: string): number {
  return Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
}

function dayIndex(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
}

/** The step drawing itself. Null when the slice cannot carry a chart. */
function QueueHistorySvg({ sorted }: { sorted: QueueSnapshotPoint[] }) {
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

  // Y ticks: every distinct frontier month observed (they are few).
  const yTicks = [...new Set(sorted.map((p) => p.frontierMonth))];
  // X ticks: first, middle, last snapshot dates.
  const mid = sorted[Math.floor(sorted.length / 2)]!;
  const xTicks = [sorted[0]!, mid, sorted[sorted.length - 1]!];

  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full min-w-[560px] border-2 border-border bg-card shadow-hard-sm"
        role="img"
        aria-label="DOL's analyst review queue month at each published snapshot"
      >
        {/* Grid + y labels */}
        {yTicks.map((m) => (
          <g key={m}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={py(m)}
              y2={py(m)}
              stroke="var(--border)"
              strokeOpacity="0.25"
            />
            <text
              x={PAD.left - 8}
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
          </g>
        ))}

        {/* X labels */}
        {xTicks.map((p, i) => (
          <text
            key={p.asOf}
            x={i === 0 ? PAD.left : i === 2 ? W - PAD.right : px(p.asOf)}
            y={H - PAD.bottom + 24}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            fontSize="12"
            fontFamily="var(--font-mono)"
            fontWeight="700"
            fill="var(--foreground)"
            fillOpacity="0.7"
          >
            {p.asOf}
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
}: {
  shown: QueueSnapshotPoint[];
  moved: Map<string, number | null>;
  gapDays: Map<string, number | null>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-2 border-border text-left text-sm shadow-hard-sm">
        <caption className="sr-only">
          Every DOL analyst-review queue reading on record, with the date DOL
          published it and how far the queue moved since the previous reading
        </caption>
        <thead className="bg-foreground text-background">
          <tr>
            <th scope="col" className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider">
              DOL published
            {" "}</th>
            <th scope="col" className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider">
              Working filings from
            {" "}</th>
            <th scope="col" className="px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider">
              Moved
            {" "}</th>
            <th scope="col" className="hidden px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider sm:table-cell">
              Days since last
            </th>
          </tr>
        </thead>
        <tbody className="bg-card">
          {[...shown].reverse().map((p) => {
            const m = moved.get(p.asOf) ?? null;
            const g = gapDays.get(p.asOf) ?? null;
            return (
              <tr key={p.asOf} className="border-t border-border/40">
                <td className="px-3 py-2.5 tabular-nums">{p.asOf}{" "}</td>
                <td className="px-3 py-2.5 font-bold">
                  {formatMonth(p.frontierMonth) ?? p.frontierMonth}
                {" "}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {m === null ? (
                    <span className="text-foreground/40">—</span>
                  ) : m === 0 ? (
                    <span className="text-foreground/50">no change</span>
                  ) : (
                    `${m > 0 ? "+" : ""}${m} month${Math.abs(m) === 1 ? "" : "s"}`
                  )}
                {" "}</td>
                <td className="hidden px-3 py-2.5 text-right tabular-nums text-foreground/70 sm:table-cell">
                  {g === null ? "—" : g}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function QueueHistoryChart({ points, className }: QueueHistoryChartProps) {
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
    ...WINDOWS.filter((w) => w < n).map((w) => ({
      value: String(w),
      label: `Last ${w}`,
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
          label="Readings"
          value={window}
          onChange={setWindow}
          hint="Narrows the chart and the table to the most recent readings."
          options={options}
        />{" "}
        <p className="text-sm text-foreground/70">
          {first.asOf} to {last.asOf}
          {spanMonths > 0 ? (
            <>
              {" "}
              <span className="text-foreground/50">
                (the queue advanced {spanMonths} month{spanMonths === 1 ? "" : "s"} across
                it)
              </span>
            </>
          ) : null}
        </p>
      </Fragment>
    ) : undefined;

  const chart = <QueueHistorySvg sorted={shown} />;

  return (
    <figure className={cn("m-0", className)}>
      <DataView
        label="DOL queue readings"
        controls={rangeControl}
        chart={
          chart ?? (
            <p className="border-2 border-border bg-card p-6 text-base text-foreground/70 shadow-hard-sm">
              The queue month didn’t change across these {shown.length} readings, so
              there’s no step to draw. The table has every reading and its date.
            </p>
          )
        }
        table={<QueueHistoryTable shown={shown} moved={moved} gapDays={gapDays} />}
      />
      <figcaption className="mt-3 text-sm text-foreground/70">
        Each step is a published DOL reading. Flat stretches are weeks where the
        queue month didn’t move.
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
          <ol className="space-y-2">
            {shown.map((p) => (
              <Fragment key={p.month}>
                {" "}
                <li className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[9rem_1fr_5.5rem]">
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
            ))}
          </ol>
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
                  <th scope="col" className="px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider">
                    Month
                  {" "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider">
                    Decisions
                  {" "}</th>
                  <th scope="col" className="px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider">
                    Change
                  {" "}</th>
                  <th scope="col" className="hidden px-3 py-2 text-right font-mono text-xs font-bold uppercase tracking-wider sm:table-cell">
                    Share of window
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
                      </td>
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
