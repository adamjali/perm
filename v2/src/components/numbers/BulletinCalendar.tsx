import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import type { BulletinYear } from "@/lib/byTheNumbers";
import { MONTH_ABBR, MONTH_NAMES } from "@convex/lib/months";
import { cn } from "@/lib/utils";

/**
 * The visa bulletin archive as a calendar: a row per year, a square per
 * month, filled where the bulletin is held and blank where it is missing.
 * A month outside the archive's span draws nothing. Each held month opens its
 * own page.
 */
export function BulletinCalendar({ years, className }: { years: readonly BulletinYear[]; className?: string }) {
  if (years.length === 0) return null;
  return (
    <div className={className}>
      <div className="grid grid-cols-[2.75rem_repeat(12,minmax(0,1fr))] gap-[3px] text-sm text-muted-foreground" aria-hidden="true">
        <span />
        {MONTH_ABBR.map((m) => (
          <span key={m} className="text-center">{m.slice(0, 1)}{" "}</span>
        ))}
      </div>{" "}
      <ChartTips label="Visa bulletins held, by month">
        <div
          className="mt-1 grid gap-[2px]"
          role="img"
          aria-label={`Visa bulletins held from ${years[0]!.year} to ${years[years.length - 1]!.year}; a blank square is a month not held.`}
        >
          {years.map((y) => (
            <div key={y.year} className="grid grid-cols-[2.75rem_repeat(12,minmax(0,1fr))] items-center gap-[3px] leading-none">
              <span className="text-sm leading-none tabular-nums text-muted-foreground">{y.year}{" "}</span>
              {y.months.map((held, i) => {
                const ym = `${y.year}-${String(i + 1).padStart(2, "0")}`;
                if (held === null) return <span key={ym} className="h-2.5" />;
                return (
                  <span
                    key={ym}
                    data-tip={`${MONTH_NAMES[i]} ${y.year}\n${held ? "Held" : "Not held"}`}
                    data-href={held ? `/visa-bulletin/${ym}` : undefined}
                    className={cn(
                      "block h-2.5",
                      // Dark green on the tint and white beside it: 3:1 or better for a mark a reader needs.
                      held ? "bg-data-good-ink dark:bg-chart-green" : "bg-card",
                    )}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </ChartTips>
      <div className="sr-only">
        <ul>
          {years.map((y) => (
            <Fragment key={y.year}>
              <li>
                {y.year}: {y.months.filter((m) => m === true).length} held
                {y.months.some((m) => m === false) ? `, ${y.months.filter((m) => m === false).length} not held` : ""}
                {" "}
              </li>
            </Fragment>
          ))}
        </ul>
      </div>
    </div>
  );
}
