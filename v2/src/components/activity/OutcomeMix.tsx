import { Fragment } from "react";

import type { OutcomeQuarter } from "@/lib/activityStats";

/**
 * What happened to the cases DOL decided, quarter by quarter.
 *
 * SHARES, NOT COUNTS. A count moves with how many cases DOL happened to clear
 * that quarter, and the question here is what happened to them.
 *
 * CERTIFIED IS NOT DRAWN. It runs between 85.8% and 94.6%, so a stacked bar
 * would be one enormous band and two slivers, and the two slivers are the
 * whole story: denial went from 1.18% in 2025-Q1 to 4.97% in the most recent
 * period while withdrawal fell from 8.08% in 2023-Q4. Certified is printed as
 * the remainder next to each bar instead, which is the same information at a
 * scale a reader can actually compare.
 *
 * TWO MEANINGS, TWO COLOURS. Denied and withdrawn are different events and
 * neither is a dimmer version of the other, so they are drawn in the palette's
 * "bad" and "in progress" tokens rather than at two opacities of one hue.
 */

export function OutcomeMix({
  quarters,
  className,
}: {
  quarters: OutcomeQuarter[];
  className?: string;
}) {
  if (quarters.length === 0) return null;
  const max = Math.max(
    1,
    ...quarters.map((q) => Math.max(q.deniedPct, q.withdrawnPct)),
  );
  return (
    <div className={className}>
      <ul className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-foreground/70">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-8 border-2 border-border bg-data-bad-ink" />{" "}
          <span>Denied</span>
        </li>{" "}
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="h-3 w-8 border-2 border-border bg-data-warn-ink" />{" "}
          <span>Withdrawn by the employer</span>
        </li>{" "}
      </ul>{" "}
      <ol className="m-0 list-none p-0">
        {quarters.map((q) => (
          <Fragment key={q.quarter}>
          <li className="border-t-2 border-border py-2.5 first:border-t-0 first:pt-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-sm font-bold tabular-nums">
                {q.quarter}
              </span>{" "}
              <span className="font-mono text-xs font-bold tabular-nums text-foreground/70">
                {q.certifiedPct.toFixed(1)}% certified ·{" "}
                {q.total.toLocaleString("en-US")} decided
              </span>
            </div>
            <div className="mt-1.5 space-y-1">
              {(
                [
                  // -ink on both: --data-warn measures 2.07:1 on the page
                  // and fails the 3:1 graphic floor, and a legend swatch that
                  // does not match its bar is worse than either alone.
                  { pct: q.deniedPct, bg: "bg-data-bad-ink", label: "denied" },
                  { pct: q.withdrawnPct, bg: "bg-data-warn-ink", label: "withdrawn" },
                ] as const
              ).map((row) => (
                <div key={row.label} className="flex items-center gap-2">
                  <div className="h-2.5 min-w-0 flex-1 border-2 border-border bg-background">
                    <div
                      className={`h-full ${row.bg}`}
                      style={{ width: `${(row.pct / max) * 100}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground/60">
                    {row.pct.toFixed(2)}% {row.label}
                  </span>
                </div>
              ))}{" "}
            </div>
          </li>{" "}
          </Fragment>
        ))}
      </ol>
      <p className="mt-4 text-sm leading-relaxed text-foreground/60">
        Both bars share one scale. A quarter is dated by the day the decision
        landed, not the day the case was filed, so a bar shows what DOL did in
        those three months, not how a filing cohort fared. Quarters at the ends
        are partial.
      </p>
    </div>
  );
}
