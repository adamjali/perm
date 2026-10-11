import { CaretRightIcon } from "@phosphor-icons/react/ssr";

import type { EmployerYear, HistoryCase } from "@/lib/turso/employerHistory";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";

import { YearBars, fillYears } from "./YearBars";

/**
 * An employer's PERM record by fiscal year, FY2008 onward (the shared
 * YearBars chart), and its decided cases from FY2016 to FY2023.
 */

export function EmployerYears({
  years,
  cases,
  lastYearPartial,
  className,
}: {
  years: EmployerYear[];
  cases: HistoryCase[];
  /** e.g. "DOL's file runs through June 2026", for the newest bar. */
  lastYearPartial?: string;
  className?: string;
}) {
  if (years.length === 0 && cases.length === 0) return null;
  // One year of filings is a single bar, which says nothing the page's own
  // headline doesn't; the chart needs a span to show a track record.
  const showChart =
    years.length > 0 && years[years.length - 1]!.fy > years[0]!.fy;
  if (!showChart && cases.length === 0) return null;
  const first = years[0]?.fy ?? 0;
  const last = years[years.length - 1]?.fy ?? 0;
  const series: EmployerYear[] = fillYears(years);
  const totals = series.map((y) => y.certified + y.denied + y.withdrawn);
  const total = totals.reduce((a, b) => a + b, 0);
  const peak = series[totals.indexOf(Math.max(...totals))];
  const historyTotal = series
    .filter((y) => y.fy >= 2016 && y.fy <= 2023)
    .reduce((a, y) => a + y.certified + y.denied + y.withdrawn, 0);

  return (
    <section className={cn("mt-12", className)}>
      {showChart && peak ? (
        <>
          <h2 className="font-heading text-2xl font-black">
            Year by year since {first}
          </h2>{" "}
          <p className="mt-2 max-w-2xl text-base text-foreground/70">
            {formatInt(total)} PERM decisions from FY{first} to FY{last}, busiest in
            FY{peak.fy} with{" "}
            {formatInt(peak.certified + peak.denied + peak.withdrawn)}.
          </p>
          <div className="mt-6">
            <YearBars
              years={series}
              note={
                <>
                  Fiscal years, October to September. A year filed under
                  another name is missing, not zero.
                  {lastYearPartial ? ` FY${last} is partial: ${lastYearPartial}.` : ""}
                </>
              }
            />
          </div>
        </>
      ) : null}

      {cases.length > 0 ? (
        <div className="mt-6 border-2 border-border bg-card p-5 sm:p-6">
          <h3 className="font-heading text-lg font-black">
            Decided in FY2016 to FY2023
          </h3>{" "}
          <p className="mt-1 text-sm text-foreground/70">
            {cases.length < historyTotal
              ? `The ${formatInt(cases.length)} most recent of ${formatInt(historyTotal)}.`
              : `All ${formatInt(cases.length)}.`}{" "}
            Case numbers from these years start with A-; look one up for
            DOL&apos;s full record.
          </p>
          <CaseTable cases={cases.slice(0, SHOWN_CASES)} />{" "}
          {cases.length > SHOWN_CASES ? (
            <details className="group mt-3">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
                <CaretRightIcon aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                The other {formatInt(cases.length - SHOWN_CASES)}{" "}
              </summary>
              <CaseTable cases={cases.slice(SHOWN_CASES)} head={false} />
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Rows shown before the fold: the newest decisions, then the rest on a click. */
const SHOWN_CASES = 8;

function CaseTable({ cases, head = true }: { cases: HistoryCase[]; head?: boolean }) {
  return (
    <div className="mt-4 overflow-x-auto">
      {/* Fixed columns, so the folded rows line up under the shown ones. */}
      <table className="w-full min-w-[44rem] table-fixed border-collapse text-left text-sm tabular-nums">
        <colgroup>
          <col className="w-[9.5rem]" />
          <col className="w-[7rem]" />
          <col className="w-[6.5rem]" />
          <col />
          <col className="w-[7rem]" />
        </colgroup>
        {head ? (
          <thead>
            <tr className="border-b-2 border-border">
              <th className="py-1.5 pr-4 font-bold">Case </th>
              <th className="py-1.5 pr-4 font-bold">Decided </th>
              <th className="py-1.5 pr-4 font-bold">Outcome </th>
              <th className="py-1.5 pr-4 font-bold">Job </th>
              <th className="py-1.5 text-right font-bold">Offered wage </th>
            </tr>
          </thead>
        ) : null}
        <tbody>
          {cases.map((c) => (
            <tr key={c.caseNumber} className="border-b border-border/30 align-top">
              <td className="py-1.5 pr-4 font-mono">
                <a
                  href={`/perm-case-status?case=${encodeURIComponent(c.caseNumber)}`}
                  className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  {c.caseNumber}
                </a>{" "}
              </td>
              <td className="py-1.5 pr-4">{c.decisionDate ?? "n/a"} </td>
              <td className="py-1.5 pr-4 capitalize">{c.status} </td>
              <td className="py-1.5 pr-4">
                {c.jobTitle ?? "n/a"}
                {c.state ? `, ${c.state}` : ""}{" "}
              </td>
              <td className="py-1.5 text-right">
                {c.wage != null ? `$${formatInt(Math.round(c.wage))}` : "n/a"}{" "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
