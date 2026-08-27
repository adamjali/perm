import { Fragment } from "react";
import Link from "next/link";

import {
  isComplete,
  ladderExtent,
  money,
  overlaps,
  type Ladder,
} from "@/lib/wageLadder";
import { cn } from "@/lib/utils";

import { WageAxis } from "./WageAxis";
import { WageLadderKey, WageLadderRow } from "./WageLadderRow";

/**
 * A set of wage ladders on ONE shared axis, one row per subject.
 *
 * The drawing exists to make a comparison unavoidable. Every other wage figure
 * on this site is a median, and a median is exactly the statistic that hides
 * the thing worth seeing here: sorted by filing volume, the busiest PERM
 * occupations alternate between roughly $139k and roughly $26k, and the two
 * groups' distributions do not touch at any percentile. One median per row
 * would show two numbers far apart. Seven rungs per row shows that there is
 * no wage at which the two populations meet.
 *
 * THE ORDER IS THE ARGUMENT, so the caller sorts and this component never
 * re-sorts. Ranked by wage, the same twelve rows are an unremarkable ladder
 * from low-paid to high-paid work.
 */

export interface LadderCombProps {
  ladders: Ladder[];
  /** Where a row's label links, keyed by ladder.key. Optional. */
  href?: (l: Ladder) => string | null;
  /** What one row's `count` counts. */
  unit?: string;
  /** Force a domain instead of deriving one from the set. */
  domain?: [number, number];
  className?: string;
}

export function LadderComb({
  ladders,
  href,
  unit = "certified cases",
  domain,
  className,
}: LadderCombProps) {
  const drawable = ladders.filter(isComplete);
  const extent = domain ?? ladderExtent(drawable);
  if (drawable.length === 0 || !extent) return null;
  // Pad the domain to the next round figure below and above, so the lowest
  // ladder does not start flush against the left edge and read as clipped.
  const [lo, hi] = extent;
  const padded: [number, number] = [
    Math.max(0, Math.floor((lo * 0.94) / 10_000) * 10_000),
    Math.ceil((hi * 1.03) / 10_000) * 10_000,
  ];

  return (
    <div className={className}>
      <WageLadderKey className="mb-6" />{" "}
      <ol className="m-0 list-none p-0">
        {drawable.map((l) => {
          const link = href?.(l) ?? null;
          return (
            // A keyed Fragment with a trailing space: React renders array
            // items with ZERO characters between them, so a separator has to
            // be part of each iteration or every row's text glues to the next.
            <Fragment key={l.key}>
            <li
              className="border-t-2 border-border py-3 first:border-t-0 first:pt-0"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="min-w-0 text-sm font-bold leading-snug">
                  {link ? (
                    <Link
                      href={link}
                      className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                    >
                      {l.label}
                    </Link>
                  ) : (
                    l.label
                  )}
                </p>{" "}
                <p className="font-mono text-xs font-bold tabular-nums text-foreground/60">
                  {money(l.p50 as number)} median ·{" "}
                  {l.count.toLocaleString("en-US")} {unit}
                </p>
              </div>
              <WageLadderRow ladder={l} domain={padded} className="mt-1" />
            </li>{" "}
            </Fragment>
          );
        })}
      </ol>
      <WageAxis domain={padded} className="mt-1" />
    </div>
  );
}

/**
 * The separation claim, stated only when the numbers still support it.
 *
 * A sentence like "the lowest-paid software developers out-earn the
 * highest-paid meat cutters" is true today and is a property of the current
 * disclosure window, not a law. So it is MEASURED at render time from the
 * ladders being drawn: the highest and lowest median in the set, `overlaps`
 * to check the two distributions really are disjoint, and the ratio computed
 * rather than typed. When a future ingest makes them overlap, the paragraph
 * says so instead of repeating a claim that stopped being true.
 */
export function TwoMarketsNote({
  ladders,
  className,
}: {
  ladders: Ladder[];
  className?: string;
}) {
  const drawable = ladders.filter(isComplete);
  if (drawable.length < 2) return null;
  const sorted = [...drawable].sort(
    (a, b) => (a.p50 as number) - (b.p50 as number),
  );
  const low = sorted[0]!;
  const high = sorted[sorted.length - 1]!;
  const disjoint = !overlaps(low, high);
  const floor = low.p95 as number;
  const ratio = floor > 0 ? (high.p5 as number) / floor : null;

  return (
    <p className={cn("text-sm leading-relaxed text-foreground/70", className)}>
      {disjoint && ratio !== null ? (
        <>
          The two ends do not meet. {high.label} open at{" "}
          {money(high.p5 as number)} on the 5th percentile, which is{" "}
          {ratio.toFixed(1)} times what {low.label.toLowerCase()} reach at the
          95th ({money(floor)}). There is no wage at which those two
          populations overlap, and they run through the same federal process at
          the same time.
        </>
      ) : (
        <>
          The highest-paid and lowest-paid occupations in this set now overlap:{" "}
          {high.label} start at {money(high.p5 as number)} on the 5th percentile
          against {money(low.p95 as number)} at the 95th for{" "}
          {low.label.toLowerCase()}.
        </>
      )}
    </p>
  );
}
