import Link from "next/link";
import { Fragment } from "react";

import { formatInt } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * What one search reaches, drawn as one bar: each program's filings as its
 * share of the whole, then a row per program with its case-number prefixes,
 * its count and the page that lists only it.
 *
 * The four counts had been four equal cards, which drew 413,991 seasonal
 * filings the same size as 4.2 million LCAs. The bar shows the proportion the
 * cards hid; the rows carry the exact numbers, which is what a screen reader
 * gets (the bar is hidden from it).
 */

export interface RecordShare {
  key: string;
  label: string;
  /** The case-number prefixes that mark this program, as DOL prints them. */
  prefixes: string[];
  n: number | null;
  href: string;
  /** A fill for the bar and the row's square. */
  swatch: string;
}

export function RecordShares({ rows, className }: { rows: RecordShare[]; className?: string }) {
  const counted = rows.filter((r): r is RecordShare & { n: number } => r.n !== null && r.n > 0);
  const total = counted.reduce((sum, r) => sum + r.n, 0);
  return (
    <section aria-labelledby="record-shares" className={cn("border border-border bg-card p-5 sm:p-6", className)}>
      <h2 id="record-shares" className="font-heading text-xl font-bold leading-tight">
        {total > 0 ? `${formatInt(total)} filings, four programs` : "Four programs, one search"}
      </h2>{" "}
      {total > 0 ? (
        <div aria-hidden="true" className="mt-4 flex h-9 border border-border">
          {counted.map((r) => (
            <span
              key={r.key}
              className={cn("h-full border-r border-border last:border-r-0", r.swatch)}
              // A floor of 2% keeps the smallest program a visible sliver.
              style={{ width: `${Math.max(2, (r.n / total) * 100)}%` }}
            />
          ))}
        </div>
      ) : null}{" "}
      <ul className="mt-4 divide-y divide-border/20">
        {rows.map((r) => (
          <Fragment key={r.key}>
            {" "}
            <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 py-2.5">
              <span aria-hidden="true" className={cn("mt-1 size-4 border border-border", r.swatch)} />{" "}
              <span className="min-w-0">
                <Link
                  href={r.href}
                  className="font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
                >
                  {r.label}
                </Link>{" "}
                <span className="mt-0.5 flex flex-wrap gap-x-2 font-mono text-sm text-muted-foreground">
                  {/* One unit per prefix, so "P-400" never breaks at its hyphen. */}
                  {r.prefixes.map((x, i) => (
                    <Fragment key={x}>
                      <span className="whitespace-nowrap">{x}{i < r.prefixes.length - 1 ? "," : ""}</span>{" "}
                    </Fragment>
                  ))}
                </span>
              </span>{" "}
              <span className="font-heading text-lg font-bold tabular-nums">{r.n === null ? "—" : formatInt(r.n)}</span>
            </li>
          </Fragment>
        ))}
      </ul>
    </section>
  );
}
