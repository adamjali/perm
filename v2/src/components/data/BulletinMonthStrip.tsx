import Link from "next/link";
import * as React from "react";

/**
 * Every bulletin the archive holds, one link each, grouped by year.
 *
 * WHY THIS EXISTS (2026-09-22). The hub linked exactly ONE month page, the
 * newest, and each month page linked only its neighbours, so the other 96
 * month pages hung off an eighteen-hop chain from a single link. Search
 * Console read the current month itself as "Discovered, never crawled".
 * Same defect as the `/perm-queue/<month>` family in September, one layer up:
 * those were in no sitemap, these were in the sitemap but link-deep. A hub
 * strip is the fix the queue page already uses.
 *
 * Plain links, no client JS, so every one is in the HTML a crawler reads.
 * Years descend (the reader wants the recent ones), months ascend inside a
 * year (October first, because the fiscal year starts there and that is how
 * the State Department numbers its folders).
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export interface BulletinMonthStripProps {
  /** Every archived bulletin month as `YYYY-MM`, any order. */
  months: readonly string[];
  /** The newest month, marked as the current page target. */
  newest: string;
}

function label(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

export function BulletinMonthStrip({ months, newest }: BulletinMonthStripProps) {
  const byYear = new Map<string, string[]>();
  for (const ym of [...months].sort()) {
    const y = ym.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), ym]);
  }
  const years = [...byYear.keys()].sort().reverse();

  return (
    <nav aria-label="Every bulletin held" className="mt-12">
      <h2 className="font-heading text-2xl font-black tracking-tight">Every bulletin held</h2>{" "}
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/85">
        {months.length} months, every employment and family cutoff, each on its own page with what moved since the month before.
      </p>{" "}
      <ol className="mt-5 flex flex-col gap-3">
        {years.map((y) => (
          <React.Fragment key={y}>
            {" "}
            <li className="flex flex-wrap items-baseline gap-x-3 gap-y-2">
              <span className="w-12 shrink-0 font-mono text-sm font-bold tabular-nums text-muted-foreground">{y}{" "}</span>{" "}
              <ul className="flex flex-wrap gap-2">
                {byYear.get(y)!.map((ym) => {
                  const current = ym === newest;
                  return (
                    <React.Fragment key={ym}>
                      {" "}
                      <li>
                        <Link
                          href={`/visa-bulletin/${ym}`}
                          aria-current={current ? "page" : undefined}
                          className={
                            "inline-flex min-h-11 items-center border-2 border-border px-3 font-mono text-sm font-semibold tabular-nums transition-colors " +
                            (current
                              ? "bg-primary text-primary-foreground shadow-hard-sm"
                              : "bg-card hover:bg-primary/15 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary")
                          }
                        >
                          {label(ym)}
                        </Link>
                      </li>
                    </React.Fragment>
                  );
                })}
              </ul>
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  );
}
