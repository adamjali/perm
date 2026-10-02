import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import type { LotteryYear } from "@/lib/turso/h1bLotteryFoia";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";

/**
 * How one employer fared in the H-1B lottery, FY2021 to FY2024: registrations
 * entered, how many were selected, and what became of the petitions. From
 * USCIS's registration records, released to Bloomberg News under FOIA; the
 * loader checked every year against USCIS's published totals before keeping
 * it. Before FY2025 one person could be registered several times, so a
 * registration is not a person.
 */

const SOURCE = "https://github.com/BloombergGraphics/2024-h1b-immigration-data";

export function H1bLotteryHistory({ years, className }: { years: LotteryYear[] | null; className?: string }) {
  if (!years || years.length === 0) return null;
  const peak = Math.max(...years.map((y) => y.registrations), 1);
  return (
    <section className={cn("mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8", className)}>
      <h2 className="font-heading text-xl font-black sm:text-2xl">In the H-1B lottery, FY{years[0]!.fy} to FY{years[years.length - 1]!.fy}</h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
        Registrations entered and selected, and the petitions that followed. Until FY2025 one person could be registered
        more than once, so a registration isn&apos;t a person.
      </p>{" "}
      <ChartTips label="Lottery registrations by year" className="mt-5">
      <ul className="space-y-3" aria-label="Lottery registrations by year">
        {[...years].reverse().map((y) => {
          const share = y.registrations > 0 ? Math.round((y.selected / y.registrations) * 100) : 0;
          return (
            <Fragment key={y.fy}>
              {" "}
              <li
                data-tip={`FY${y.fy}\n${formatInt(y.selected)} selected (${share}%)\n${formatInt(y.registrations - y.selected)} not selected\n${formatInt(y.registrations)} registrations\n${formatInt(y.petitioned)} petitions filed, ${formatInt(y.approved)} approved, ${formatInt(y.denied)} denied`}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-mono text-sm font-bold">FY{y.fy}</span>{" "}
                  <span className="text-sm tabular-nums text-foreground/80">
                    {formatInt(y.selected)} of {formatInt(y.registrations)} selected ({share}%), {formatInt(y.petitioned)} petitions filed,{" "}
                    {formatInt(y.approved)} approved, {formatInt(y.denied)} denied
                  </span>
                </span>{" "}
                <span className="mt-1 flex h-3 w-full bg-muted" aria-hidden="true">
                  <span className="h-full bg-foreground" style={{ width: `${(y.selected / peak) * 100}%` }} />
                  <span className="h-full bg-foreground/30" style={{ width: `${((y.registrations - y.selected) / peak) * 100}%` }} />
                </span>
              </li>
            </Fragment>
          );
        })}
      </ul>
      </ChartTips>{" "}
      <p className="mt-3 text-sm text-foreground/70">
        Dark: selected. Light: not selected. From USCIS&apos;s registration records, obtained by Bloomberg News under
        FOIA and{" "}
        <a href={SOURCE} rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-primary">
          published by Bloomberg
        </a>{" "}
        (Apache-2.0). USCIS queried them in May 2024; each year matches USCIS&apos;s own registration totals. Matched by
        employer name, like the figures above.
      </p>
    </section>
  );
}
