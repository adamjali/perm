import Link from "next/link";
import * as React from "react";
import { MONTH_ABBR } from "@convex/lib/months";

/**
 * Every bulletin the archive holds, one link each, grouped by year.
 *
 * WHY THIS EXISTS. If the hub links only the newest month and each month page
 * only its neighbours, the rest hang off a long chain of hops from a single
 * link, and Search Console leaves them "Discovered, never crawled". A sitemap
 * entry is not a link; a hub strip, as on the queue page, puts every month
 * one hop from the hub.
 *
 * Plain links, no client JS, so every one is in the HTML a crawler reads.
 * Years descend (the reader wants the recent ones), months ascend inside a
 * year (October first, because the fiscal year starts there and that is how
 * the State Department numbers its folders).
 */

export interface BulletinMonthStripProps {
  /** Every archived bulletin month as `YYYY-MM`, any order. */
  months: readonly string[];
  /** The newest month, marked as the current page target. */
  newest: string;
}

function label(ym: string): string {
  return `${MONTH_ABBR[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

/** Years drawn open; the rest fold, their links still in the HTML. */
const OPEN_YEARS = 3;

function YearRow({ year, held, newest, earliest }: { year: string; held: Set<string>; newest: string; earliest: string }) {
  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-x-3 [&>*]:min-w-0">
      <span className="pt-3 font-mono text-sm font-bold tabular-nums text-muted-foreground">{year}{" "}</span>{" "}
      {/* A calendar row: every month has its cell, so a month the archive
          doesn't hold reads as the gap it is rather than closing up. */}
      <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-12 [&>*]:min-w-0">
        {MONTH_ABBR.map((m, i) => {
          const ym = `${year}-${String(i + 1).padStart(2, "0")}`;
          const current = ym === newest;
          return (
            <React.Fragment key={ym}>
              {" "}
              <li>
                {ym > newest || ym < earliest ? (
                  // Not out yet, or before the archive begins: no cell to read.
                  <span aria-hidden="true" className="block min-h-11" />
                ) : held.has(ym) ? (
                  <Link
                    href={`/visa-bulletin/${ym}`}
                    aria-current={current ? "page" : undefined}
                    // One short class (globals.css): about 240 cells, each in the HTML and again in the page's payload.
                    className="month-cell"
                  >
                    {m}
                    {/* The year is in the row's label for the eye; a crawler and a
                        screen reader get it in the link itself. */}
                    <span className="sr-only">{` ${year}`}</span>
                  </Link>
                ) : (
                  <span
                    title={`${label(ym)}: not held`}
                    className="month-cell-missing"
                  >
                    <span aria-hidden="true">{m}</span>{" "}
                    <span className="sr-only">{`${label(ym)}, not held`}</span>
                  </span>
                )}
              </li>
            </React.Fragment>
          );
        })}
      </ul>
    </li>
  );
}

export function BulletinMonthStrip({ months, newest }: BulletinMonthStripProps) {
  const held = new Set(months);
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].sort().reverse();
  const open = years.slice(0, OPEN_YEARS);
  const folded = years.slice(OPEN_YEARS);
  const foldedCount = months.filter((m) => folded.includes(m.slice(0, 4))).length;
  const earliest = [...months].sort()[0] ?? newest;
  // Months after the newest bulletin, or before the archive's first, are left
  // blank rather than drawn as gaps: there's nothing missing there.
  const rows = (ys: string[]) =>
    ys.map((y) => (
      <React.Fragment key={y}>
        {" "}
        <YearRow year={y} held={held} newest={newest} earliest={earliest} />
      </React.Fragment>
    ));

  return (
    <nav aria-label="Every bulletin held" className="mt-12">
      <h2 className="font-heading text-2xl font-bold tracking-tight">Every bulletin held</h2>{" "}
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-soft">
        {months.length} months, every employment and family cutoff, each on its own page with what moved since the month
        before. A dashed month is one the archive doesn&apos;t hold.
      </p>{" "}
      <ol className="mt-5 flex flex-col gap-3">{rows(open)}</ol>{" "}
      {folded.length > 0 ? (
        <details className="mt-4 bg-sage">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-bold">
            {`Earlier years, ${folded.at(-1)} to ${folded[0]} (${foldedCount} bulletins)`}
          </summary>
          <ol className="flex flex-col gap-3 border-t-2 border-border p-4">{rows(folded)}</ol>
        </details>
      ) : null}
    </nav>
  );
}
