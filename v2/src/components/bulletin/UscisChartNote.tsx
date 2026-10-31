import { CalendarCheckIcon } from "@phosphor-icons/react/ssr";

import { USCIS_CHARTS_URL, type UscisChart, type UscisCharts } from "@/lib/uscisCharts";
import { cn } from "@/lib/utils";
import { monthYear } from "@convex/lib/months";

const MEANS: Record<UscisChart, string> = {
  "Dates for Filing": "A priority date before this chart's cutoff can file now; approval still waits for the Final Action date.",
  "Final Action Dates": "A priority date has to be before the Final Action cutoff to file.",
};

/**
 * Which of the bulletin's two charts USCIS accepts for an I-485 this month,
 * for work-based and family filings, from USCIS's own monthly notice. The
 * bulletin prints both charts; this is the line that says which one decides
 * whether someone can file. Nothing renders when USCIS's page couldn't be
 * read, or when it names a month other than the one this page is about.
 */
export function UscisChartNote({
  charts,
  month,
  only,
  className,
}: {
  charts: UscisCharts | null;
  /** The bulletin month the page is about, `YYYY-MM`; omit to show USCIS's newest. */
  month?: string;
  /** Show one kind of filing alone (the family page shows family). */
  only?: "employment" | "family";
  className?: string;
}) {
  if (!charts || (month && charts.month !== month)) return null;
  const rows = (
    [
      ["employment", "Work-based", charts.employment],
      ["family", "Family", charts.family],
    ] as const
  ).filter(([k, , c]) => c !== null && (!only || only === k)) as [string, string, UscisChart][];
  if (rows.length === 0) return null;
  const label = monthYear(charts.month) ?? charts.month;
  return (
    <section aria-labelledby="uscis-chart-h" className={cn("border-2 border-border bg-card p-5 sm:p-6", className)}>
      <h2 id="uscis-chart-h" className="flex items-center gap-2 font-heading text-lg font-bold">
        <CalendarCheckIcon aria-hidden="true" className="size-6 shrink-0 text-primary-text" weight="bold" />{" "}
        {`Filing an I-485 in ${label}`}
      </h2>{" "}
      <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {rows.map(([k, who, chart]) => (
          <div key={k} className="border-l-4 border-primary pl-3">
            <dt className="text-sm text-muted-foreground">{`${who} categories: USCIS accepts`}</dt>{" "}
            <dd className="font-heading text-xl font-bold">{`${chart} chart`}</dd>{" "}
            <dd className="mt-1 text-sm text-muted-foreground">{MEANS[chart]}</dd>
          </div>
        ))}
      </dl>{" "}
      <p className="mt-3 text-sm text-muted-foreground">
        Applying through a consulate abroad? The visa is issued only once the priority date is before the Final Action
        date.{" "}
      </p>{" "}
      <p className="mt-1 text-sm text-muted-foreground">
        From{" "}
        <a href={USCIS_CHARTS_URL} className="link" target="_blank" rel="noopener noreferrer">
          USCIS&apos;s notice for {label}
        </a>
        .
      </p>
    </section>
  );
}
