import { cn } from "@/lib/utils";

import { ArrowRight } from "./icons";

/**
 * The wait, measured. Every month DOL has decided cases in.
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
 * WHY THE MOVEMENT IS PRINTED AND NOT LEFT TO BE READ OFF THE FIELD. A
 * quarter of the plate is a real difference and it is still not a GLANCE.
 * Reading 17 down to 13 out of the staircase means comparing two segment
 * lengths thirty rows apart while both ends are also sliding right, which is
 * a measurement, not a first impression. So the two rows the headline
 * actually cites are named at the top at display size and marked in the
 * field. The staircase is the evidence; the readout is the statement.
 *
 * WHY THE ROW PITCH IS COMPUTED AND NOT WRITTEN DOWN. This series grows by a
 * month every time DOL publishes, and the first version of this figure was
 * 33 fixed-height rows: 660px of plate that ran past the fold, pushed the
 * page's two primary calls to action below it, and would have been 900px by
 * next summer. An unbounded series in a hero is a layout that breaks on a
 * schedule. `plateMetrics` spends a fixed height and divides it by however
 * many rows there are, so the plate is the same size at 33 rows and at 60
 * and no data is dropped to achieve that.
 *
 * WHY ONLY SOME ROWS CARRY NUMBERS. A 13px label in a 10px row pitch
 * overlaps its neighbours. The month and the wait are printed on the axis
 * rows plus the two marked rows, which `labelRows` keeps three rows apart;
 * every row keeps its full value in the screen-reader text regardless.
 *
 * WHY THIS SERIES IS SAFE TO PUBLISH AND A COHORT MEDIAN IS NOT. This
 * conditions on the month a case was DECIDED, not the month it was filed.
 * Every case in a row is therefore fully observed by construction, so the
 * survivorship trap that makes a recent filing-cohort median meaningless
 * (June 2026's raw cohort median is 1 day, because the only cases decided so
 * far are instant withdrawals) cannot reach it.
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

/**
 * Row height and gap for a series of `n` rows, so the plate is a fixed size
 * however long the series gets.
 *
 * The alternative, a written-down row height, makes the figure grow by one
 * row every time DOL publishes. That is a layout that breaks on a schedule
 * rather than on a change, which is the kind nobody is watching for.
 */
export function plateMetrics(n: number): { rowH: number; gapH: number } {
  /** Total px the plate spends on rows, gaps included. */
  const TARGET = 330;
  const gapH = n > 40 ? 2 : 3;
  const rowH = Math.max(
    4,
    Math.min(9, Math.round(TARGET / Math.max(1, n)) - gapH),
  );
  return { rowH, gapH };
}

/**
 * Which rows carry a printed month and wait: the evenly spaced axis rows,
 * plus `pinned` rows that must be labelled whatever the spacing works out to.
 *
 * A pinned row always wins. An axis tick within `MIN_GAP` rows of one is
 * dropped rather than nudged, because two labels a row apart in a 10px pitch
 * print on top of each other, and a moved tick is no longer an axis.
 */
export function labelRows(
  n: number,
  count: number,
  pinned: number[],
): number[] {
  const MIN_GAP = 3;
  const pins = [
    ...new Set(pinned.filter((i) => Number.isInteger(i) && i >= 0 && i < n)),
  ];
  const out = new Set(pins);
  for (const t of evenTicks(n, count))
    if (pins.every((p) => Math.abs(p - t) >= MIN_GAP)) out.add(t);
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

/**
 * One end of the movement: a wait in months, and the month it was measured in.
 *
 * The peak reading is deliberately quieter than the current one. They are the
 * same kind of fact and only one of them is true today.
 */
function Reading({
  label,
  wait,
  month,
  current,
}: {
  label: string;
  wait: number;
  month: string;
  current?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[13px] font-semibold uppercase tracking-[0.1em] text-black/70">
        {label}
      </p>{" "}
      <p
        className={cn(
          "mt-1 font-heading font-black leading-none tracking-[-0.03em]",
          current ? "text-black" : "text-black/60",
        )}
      >
        <span className="text-[2.5rem] sm:text-[3rem]">{wait}</span>{" "}
        <span className="font-mono text-[15px] font-semibold tracking-normal">
          months
        </span>
      </p>{" "}
      <p className="mt-1 font-mono text-[13px] font-semibold text-black/70">
        decided {shortLabel(month)}
      </p>
    </div>
  );
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
  const nowIndex = items.length - 1;
  const now = items[nowIndex]!;
  let peakIndex = 0;
  for (let i = 1; i < items.length; i++)
    if (items[i]!.wait > items[peakIndex]!.wait) peakIndex = i;
  const peak = items[peakIndex]!;
  // A series that has not come down yet states one reading rather than
  // dressing a flat or rising line up as a descent.
  const descended = peakIndex !== nowIndex && peak.wait > now.wait;

  const { rowH, gapH } = plateMetrics(items.length);
  // EVERY row at the maximum is drawn heavy, not just the first one. A series
  // this long ties at its peak, and marking one of two identical 17s makes the
  // other look like a mistake. The readout names the FIRST, because "the peak"
  // is when it got there.
  const isMarked = new Set<number>([nowIndex]);
  if (descended)
    items.forEach((it, i) => {
      if (it.wait === peak.wait) isMarked.add(i);
    });
  // Labels are pinned to the two rows the readout names, and to those only:
  // a run of tied peaks sits on consecutive rows, and consecutive labels
  // print on top of each other.
  const labelled = new Set(
    labelRows(items.length, 7, descended ? [peakIndex, nowIndex] : [nowIndex]),
  );

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
            {shortLabel(now.row.decisionMonth)}
          </span>
        </div>

        {/* The statement. Two readings the field below is the evidence for. */}
        <div className="flex items-end gap-6 border-b-2 border-black/25 py-4 sm:gap-9">
          {descended ? (
            <>
              <Reading
                label="Peak"
                wait={peak.wait}
                month={peak.row.decisionMonth}
              />{" "}
              <ArrowRight className="mb-[1.35rem] shrink-0 text-[22px] text-black/55" />{" "}
            </>
          ) : null}
          <Reading
            label="Now"
            wait={now.wait}
            month={now.row.decisionMonth}
            current
          />
        </div>

        <p className="sr-only">
          Median months from filing to determination, for cases decided in each
          month. One entry per month of determinations.
        </p>

        <ul className="mt-4 flex flex-col" style={{ gap: `${gapH}px` }}>
          {items.map((item, i) => {
            const isCurrent = i === nowIndex;
            const mark = isMarked.has(i);
            const shows = labelled.has(i);
            return (
              <li
                key={item.row.decisionMonth}
                className="flex items-center gap-2 sm:gap-3"
                style={{ height: `${rowH}px` }}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-[52px] shrink-0 text-right font-mono text-[13px] leading-none sm:w-[58px]",
                    mark
                      ? "font-black text-black"
                      : "font-semibold text-black/65",
                  )}
                >
                  {shows ? shortLabel(item.row.decisionMonth) : ""}
                </span>{" "}
                <span
                  aria-hidden="true"
                  className="relative h-full min-w-0 flex-1"
                >
                  <span
                    className={cn(
                      "wl-seg absolute block",
                      isCurrent
                        ? // Lime on manila measures 1.73:1, so this bar is
                          // defined by its edge, never by its fill.
                          "border-2 border-black bg-primary"
                        : mark
                          ? "bg-black"
                          : "bg-black/80",
                    )}
                    style={
                      {
                        left: `${item.left}%`,
                        width: `${item.width}%`,
                        // A marked row eats its own gap so it reads heavier
                        // than the field without moving anything below it.
                        height: `${mark ? rowH + gapH : rowH}px`,
                        top: `${mark ? -gapH / 2 : 0}px`,
                        "--i": i,
                      } as React.CSSProperties
                    }
                  />
                </span>{" "}
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-[26px] shrink-0 text-right font-mono leading-none",
                    mark
                      ? "text-[15px] font-black text-black"
                      : "text-[13px] font-semibold text-black/65",
                  )}
                >
                  {shows ? item.wait : ""}
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
