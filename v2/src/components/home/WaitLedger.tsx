import { cn } from "@/lib/utils";

/**
 * The wait, measured. Twenty months of it.
 *
 * WHAT IT DRAWS. One row per month in which DOL issued determinations. The
 * row's segment runs from the median FILING month of the cases decided that
 * month to the month they were decided in, so the segment's LENGTH is the
 * wait and its POSITION is time marching right. Both ends advance, which is
 * why the field reads as a staircase rather than a bar chart.
 *
 * WHY A SPAN AND NOT A BAR. Waits here run 13 to 17 months. Drawn as bars
 * from a zero baseline they are all within 24% of each other and the shape
 * says nothing; drawn from a min-max baseline the shortest bar collapses to
 * nothing, which reads as "no wait" and is a lie. A span has a true zero (a
 * case filed and decided in the same month is a zero-length segment) and it
 * still separates 13 from 17 by a quarter of the plate.
 *
 * WHY THIS SERIES IS SAFE TO PUBLISH AND A COHORT MEDIAN IS NOT. This
 * conditions on the month a case was DECIDED, not the month it was filed.
 * Every case in a row is therefore fully observed by construction, so the
 * survivorship trap that makes a recent filing-cohort median meaningless
 * (June 2026's raw cohort median is 1 day, because the only cases decided so
 * far are instant withdrawals) cannot reach it. Row counts run 7,505 to
 * 19,787 determinations, and the most recent row is the largest.
 *
 * WHAT IT IS NOT. Not a prediction, not an estimate, and not anyone's
 * personal wait. It is a median over cases DOL has already decided.
 *
 * Presentational and server-renderable: rows in, markup out. Deliberately
 * built from HTML rather than SVG, because SVG text scales with the viewBox
 * and 13px in a wide drawing renders at 5.5px in a phone column.
 */

export interface WaitLedgerRow {
  /** Month DOL issued the determinations, "YYYY-MM". */
  decisionMonth: string;
  /** Median filing month of the cases decided that month, "YYYY-MM". */
  medianFilingMonth: string;
  /** How many determinations that month. Sample size for the median. */
  decisions: number;
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-06" to an absolute month number. Returns null on anything else. */
export function monthIndex(value: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return Number(m[1]) * 12 + (month - 1);
}

/** "2026-06" to "Jun 26". */
export function shortLabel(value: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  const year = m?.[1];
  const month = m?.[2];
  if (!year || !month) return value;
  const name = MONTHS[Number(month) - 1];
  if (!name) return value;
  return `${name} ${year.slice(2)}`;
}

/**
 * `count` indices spread evenly across 0..n-1, both ends included.
 *
 * Taking every nth index and then appending the last one leaves the final
 * pair adjacent, which is how two labels end up printed on top of each other
 * while the rest of the axis looks fine.
 */
export function evenTicks(n: number, count: number): number[] {
  if (n <= 0) return [];
  if (n === 1 || count <= 1) return [0];
  const take = Math.min(count, n);
  const out = new Set<number>();
  for (let i = 0; i < take; i++)
    out.add(Math.round((i * (n - 1)) / (take - 1)));
  return [...out].sort((a, b) => a - b);
}

interface Measured {
  row: WaitLedgerRow;
  /** Whole months from filing to determination. */
  wait: number;
  /** Segment start as a percentage of the axis. */
  left: number;
  /** Segment length as a percentage of the axis. */
  width: number;
}

/**
 * Turns rows into positioned segments on one shared axis.
 *
 * Exported so the arithmetic can be asserted without rendering. Rows whose
 * months do not parse, or whose determination precedes its own filing month,
 * are dropped rather than drawn at a nonsense position.
 */
export function measure(rows: WaitLedgerRow[]): {
  items: Measured[];
  axisStart: number;
  axisEnd: number;
} | null {
  const parsed = rows
    .map((row) => {
      const from = monthIndex(row.medianFilingMonth);
      const to = monthIndex(row.decisionMonth);
      return from != null && to != null && to >= from
        ? { row, from, to }
        : null;
    })
    .filter(
      (r): r is { row: WaitLedgerRow; from: number; to: number } => r !== null,
    );

  if (parsed.length === 0) return null;

  const axisStart = Math.min(...parsed.map((p) => p.from));
  const axisEnd = Math.max(...parsed.map((p) => p.to));
  const span = axisEnd - axisStart;
  if (span <= 0) return null;

  return {
    axisStart,
    axisEnd,
    items: parsed.map((p) => ({
      row: p.row,
      wait: p.to - p.from,
      left: ((p.from - axisStart) / span) * 100,
      width: ((p.to - p.from) / span) * 100,
    })),
  };
}

export function WaitLedger({
  rows,
  className,
}: {
  rows: WaitLedgerRow[];
  className?: string;
}) {
  const data = measure(rows);
  if (!data) return null;

  const { items } = data;
  const current = items[items.length - 1]!;
  const ticks = new Set(evenTicks(items.length, 7));

  return (
    <figure
      className={cn(
        // The bed. Manila is 1.18:1 against the light page ground, so the
        // hard border is what makes this read as a separate surface, not
        // the fill. That is how every layer in this system is defined.
        "relative border-3 border-border bg-manila text-black shadow-hard-lg",
        className,
      )}
    >
      {/* Survey-sheet registration ticks. Geometric, and they say "measured
          document" without adding an illustration. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-3 border-t-3 border-black/70"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r-3 border-t-3 border-black/70"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b-3 border-l-3 border-black/70"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-3 border-r-3 border-black/70"
      />

      <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-black/25 pb-3">
          <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.1em] text-black/75">
            Filing to determination
          </span>{" "}
          <span className="font-mono text-[13px] font-semibold text-black/70">
            {shortLabel(items[0]!.row.decisionMonth)} to{" "}
            {shortLabel(current.row.decisionMonth)}
          </span>
        </div>

        <p className="sr-only">
          Median months from filing to determination, for cases decided in each
          month. One entry per month of determinations.
        </p>

        <ul className="mt-3 flex flex-col gap-[5px] sm:gap-[7px]">
          {items.map((item, i) => {
            const isCurrent = i === items.length - 1;
            return (
              <li
                key={item.row.decisionMonth}
                className="flex items-center gap-2 sm:gap-3"
              >
                <span
                  aria-hidden="true"
                  className="w-[52px] shrink-0 text-right font-mono text-[13px] font-semibold leading-none text-black/65 sm:w-[58px]"
                >
                  {ticks.has(i) ? shortLabel(item.row.decisionMonth) : ""}
                </span>{" "}
                <span
                  aria-hidden="true"
                  className="relative h-[7px] min-w-0 flex-1 sm:h-[9px]"
                >
                  <span
                    className={cn(
                      "wl-seg absolute inset-y-0 block",
                      isCurrent
                        ? // Lime on manila measures 1.73:1, so this bar is
                          // defined by its edge, never by its fill.
                          "border-2 border-black bg-primary"
                        : "bg-black/80",
                    )}
                    style={
                      {
                        left: `${item.left}%`,
                        width: `${item.width}%`,
                        "--i": i,
                      } as React.CSSProperties
                    }
                  />
                </span>{" "}
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-[26px] shrink-0 text-right font-mono leading-none",
                    isCurrent
                      ? "text-[15px] font-black text-black"
                      : "text-[13px] font-semibold text-black/65",
                  )}
                >
                  {item.wait}
                </span>{" "}
                <span className="sr-only">
                  Cases decided in {shortLabel(item.row.decisionMonth)} had a
                  median wait of {item.wait} months, from{" "}
                  {item.row.decisions.toLocaleString("en-US")} determinations.
                </span>
              </li>
            );
          })}
        </ul>

        <figcaption className="mt-4 border-t-2 border-black/25 pt-3 font-mono text-[13px] leading-relaxed text-black/70">
          Months in the queue, by the month DOL decided the case. Medians over{" "}
          {items
            .reduce((sum, i) => sum + i.row.decisions, 0)
            .toLocaleString("en-US")}{" "}
          determinations in DOL&apos;s published disclosure files.
        </figcaption>
      </div>
    </figure>
  );
}
