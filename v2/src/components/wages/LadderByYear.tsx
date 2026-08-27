import { Fragment } from "react";

import {
  RUNGS,
  RUNG_LABEL,
  isComplete,
  ladderExtent,
  money,
  type Ladder,
} from "@/lib/wageLadder";
import { cn } from "@/lib/utils";

import { WageAxis } from "./WageAxis";
import { WageLadderKey, WageLadderRow } from "./WageLadderRow";

/**
 * One subject's ladder in each fiscal year it has one, on a shared axis.
 *
 * A median per year answers "did pay move". The whole ladder per year answers
 * "which part of it moved", and those are different: Software Developers'
 * median rose 5.2% across FY2024 to FY2026 while the 95th rose 8.5% and the
 * 90th did not move at all. The top stretched; the middle drifted.
 *
 * THE POPULATION GUARD IS NOT OPTIONAL. `perm_wage_stats` cells are counted
 * per year, and some occupations change size by an order of magnitude between
 * them: Meat, Poultry and Fish Cutters go from 756 certified cases in FY2024
 * to 6,165 in FY2025, and its median falls 10.7% over the same span. Reading
 * that as a pay cut is the mistake. When the count moves this much the
 * component says so instead of describing the shift as if the same population
 * had been measured twice.
 */

/** Above this ratio between the largest and smallest year, say so. */
export const COMPOSITION_RATIO = 2;

export interface LadderByYearProps {
  /** Oldest first. Years with an incomplete ladder are dropped. */
  years: Ladder[];
  /** What one row's count counts. */
  unit?: string;
  className?: string;
}

export function LadderByYear({
  years,
  unit = "certified cases",
  className,
}: LadderByYearProps) {
  const drawable = years.filter(isComplete);
  const extent = ladderExtent(drawable);
  if (drawable.length < 2 || !extent) return null;

  const [lo, hi] = extent;
  const domain: [number, number] = [
    Math.max(0, Math.floor((lo * 0.92) / 5_000) * 5_000),
    Math.ceil((hi * 1.04) / 5_000) * 5_000,
  ];

  const first = drawable[0]!;
  const last = drawable[drawable.length - 1]!;
  const counts = drawable.map((l) => l.count);
  const ratio = Math.max(...counts) / Math.max(1, Math.min(...counts));
  const composition = ratio >= COMPOSITION_RATIO;

  const move = (r: (typeof RUNGS)[number]) => {
    const a = first[r] as number;
    const b = last[r] as number;
    return a > 0 ? ((b - a) / a) * 100 : null;
  };

  return (
    <div className={className}>
      <WageLadderKey className="mb-6" />{" "}
      <ol className="m-0 list-none p-0">
        {drawable.map((l) => (
          // Keyed Fragment with a trailing space: React puts NOTHING between
          // array items, so each row's text glues to the next one's for every
          // extractor that walks the DOM.
          <Fragment key={l.key}>
          <li className="border-t-2 border-border py-3 first:border-t-0 first:pt-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-mono text-sm font-bold uppercase tracking-wider">
                {l.label}
              </p>{" "}
              <p className="font-mono text-xs font-bold tabular-nums text-foreground/60">
                {money(l.p50 as number)} median ·{" "}
                {l.count.toLocaleString("en-US")} {unit}
              </p>
            </div>
            <WageLadderRow ladder={l} domain={domain} className="mt-1" />
          </li>{" "}
          </Fragment>
        ))}
      </ol>
      <WageAxis domain={domain} className="mt-1" />

      {/* Rung by rung, so a reader can see which part of the distribution
          actually moved rather than inferring it from two medians. */}
      <dl className="mt-6 grid [&>*]:min-w-0 grid-cols-2 gap-px border-2 border-border bg-border sm:grid-cols-4">
        {(["p10", "p50", "p90", "p95"] as const).map((r) => {
          const pct = move(r);
          return (
            <div key={r} className="bg-card p-3">
              <dt className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                {RUNG_LABEL[r]}
              </dt>{" "}
              <dd className="mt-1 font-heading text-lg font-black tabular-nums">
                {money(last[r] as number)}
              </dd>{" "}
              {/* No second line at all when the change cannot be computed. A
                  placeholder glyph in a numeric column reads as a value. */}
              {pct === null ? null : (
                <dd className="mt-0.5 font-mono text-xs tabular-nums text-foreground/70">
                  {`${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% since ${first.label}`}
                </dd>
              )}
            </div>
          );
        })}{" "}
      </dl>

      <p
        className={cn(
          "mt-4 text-sm leading-relaxed",
          composition ? "border-2 border-data-warn bg-data-warn/8 p-3 text-foreground/80" : "text-foreground/60",
        )}
      >
        {composition ? (
          <>
            <b className="font-bold text-data-warn-ink">
              These years are not measuring the same group of filings.
            </b>{" "}
            The count moves by {ratio.toFixed(1)} times between the largest year
            and the smallest, so a change in the ladder is at least partly a
            change in which employers filed rather than a change in what the
            work pays. Read the shape, not the difference.
          </>
        ) : (
          <>
            Each row is that fiscal year&apos;s certified filings, counted on
            their own. A percentile is over the year, so a year with far fewer
            cases behind it is a thinner measurement than one with more.
          </>
        )}
      </p>
    </div>
  );
}
