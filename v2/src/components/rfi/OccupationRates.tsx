import { Fragment } from "react";

import type { RfiOccupationCut } from "@/lib/turso/rfi";

/**
 * Open-RFI rate by job title, inside the filing window the RFIs live in.
 *
 * THE SPREAD IS THE FINDING. The rate runs from 0.76% for software engineers
 * to 29.4% for nail technicians against a 1.7% field, and the ordering is
 * identical whichever of three denominators you use: all filings in the
 * window, still-pending filings in the window, or every pending case in the
 * mirror. A ranking that survives its denominator being changed twice is a
 * ranking about the occupations rather than about the arithmetic.
 *
 * EVERY RATE CARRIES ITS INTERVAL, because the populations differ by two
 * orders of magnitude and the point estimates do not say so. Nail technicians
 * are 15 of 51 and software engineers are 14 of 1,848: the same kind of
 * number, one of them far shakier. The interval arrives on the row from the
 * read layer, already computed: this is a SERVER component, and calling
 * RateBars' `wilsonInterval` from here threw at runtime because RateBars is a
 * `"use client"` module. Typecheck and jsdom both missed it.
 *
 * NO DIRECTION COLOUR ON THE MULTIPLE, which is why the shared
 * `BaselineMultiple` from Insight.tsx is not reused here. It paints anything
 * at 2x or more in the denial red, which is correct on the denial-rates page
 * and wrong on this one: the page immediately above this chart establishes
 * that most RFIs end in a certification. Reusing it would have the component
 * quietly contradict the section it sits in. One bar colour for every row,
 * and the number carries the comparison.
 */

/** Below this the bar is a sub-pixel sliver that reads as no bar at all. */
const MIN_BAR_PX = 3;

export function OccupationRates({ cut }: { cut: RfiOccupationCut }) {
  if (cut.rows.length === 0) return null;
  const max = Math.max(cut.baseline, ...cut.rows.map((r) => r.rate));
  const width = (rate: number) => `max(${MIN_BAR_PX}px, ${(rate / max) * 100}%)`;

  return (
    <figure className="m-0">
      <div className="border-2 border-border bg-card p-4 sm:p-5">
        {/*
          The field rate, stated before the ranking rather than under it. A
          list of percentages with no reference point invites the reader to
          treat the top row as normal, and 29% is not normal.
        */}
        <p className="mb-4 border-b-2 border-border pb-3 text-sm">
          <b className="font-bold">
            {cut.baseline.toFixed(2)}% of all {cut.filed.toLocaleString()} cases
            filed between {monthName(cut.from)} and {monthName(cut.to)}
          </b>{" "}
          are sitting at an RFI today. Every rate below is against that.
        </p>

        <ul className="grid gap-2.5">
          {cut.rows.map((r) => (
            <Fragment key={r.title}>{" "}
            <li
              className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 sm:grid-cols-[13rem_minmax(0,1fr)_auto]"
            >
              <span className="truncate font-heading text-sm font-bold sm:order-1">
                {titleCase(r.title)}
              </span>{" "}
              <span className="order-3 col-span-2 sm:order-2 sm:col-span-1">
                <span className="flex h-4 items-center">
                  <span
                    className="block h-full border-2 border-border bg-[var(--data-warn-ink)]"
                    style={{ width: width(r.rate) }}
                  />
                </span>
              </span>{" "}
              <span className="text-right font-mono text-sm tabular-nums sm:order-3">
                <b className="font-bold">{r.rate.toFixed(1)}%</b>{" "}
                <span className="text-muted-foreground">
                  {(r.rate / cut.baseline).toFixed(1)}x
                </span>
              </span>{" "}
              {/*
                The two counts and the employer count are ON the row, not in a
                footnote. A rate is meaningless without its population, and the
                employer count is what separates an occupation from one firm's
                batch of filings.
              */}
              <span className="order-4 col-span-2 font-mono text-[11px] tabular-nums text-muted-foreground sm:col-span-3">
                {r.rfi.toLocaleString()} of {r.filed.toLocaleString()} filed
                {", "}
                {r.rfiEmployers.toLocaleString()} employers
                {r.ci ? (
                  <>
                    {" "}
                    · 95% interval {r.ci.lo.toFixed(1)} to {r.ci.hi.toFixed(1)}%
                  </>
                ) : null}
              </span>
            </li>
            </Fragment>
          ))}
        </ul>
      </div>

      <figcaption className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
        <p>
          {cut.withheld > 0 ? (
            <>
              <b className="font-bold text-foreground">
                {cut.withheld} more{" "}
                {cut.withheld === 1 ? "title is" : "titles are"} left off.
              </b>{" "}
              Each had enough RFIs to rank and fewer than five distinct
              employers using the title, which makes the rate a fact about one
              filer rather than about the job. Ranked without that floor, the
              two highest rates in PERM were dishwashers at 100% and facilities
              mechanics at 90%, and both are a single employer.{" "}
            </>
          ) : null}
          Job titles are free text the employer types, so this groups{" "}
          <span className="font-mono">COOK</span> with{" "}
          <span className="font-mono">Cook</span> and leaves{" "}
          <span className="font-mono">Line Cook</span> separate.
        </p>{" "}
        <p>
          These are RFIs open today. A title whose RFIs get answered and closed
          quickly shows a lower rate than one whose RFIs sit, and nothing in
          the data separates those two.
        </p>
      </figcaption>
    </figure>
  );
}

/** `2025-05` to `May 2025`. */
function monthName(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return ym;
  const names = ["January","February","March","April","May","June","July",
    "August","September","October","November","December"];
  return `${names[Number(m[2]) - 1] ?? ym} ${m[1]}`;
}

/**
 * DOL prints these shouted and the page does not shout.
 *
 * Deliberately does NOT lower-case a token that is already mixed case or is
 * all-consonants-and-caps, so an acronym stays an acronym. The titles here
 * are plain words, but the next quarter's data decides that, not this quarter's.
 */
function titleCase(s: string): string {
  return s
    .split(/(\s+|\/)/)
    .map((w) =>
      /^[A-Z]{2,}$/.test(w) && !/[AEIOU]/.test(w)
        ? w
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
}
