import { Fragment } from "react";

import type { EmployerYear, HistoryCase } from "@/lib/turso/employerHistory";
import { cn } from "@/lib/utils";

/**
 * An employer's PERM record by fiscal year, FY2008 onward, as stacked bars,
 * and its decided cases from FY2020 to FY2023.
 *
 * Bars rather than a line: each year is a count of decisions DOL made, and a
 * year with none is a real zero worth seeing as a gap, not a point to draw
 * through. The numbers sit in a collapsed table under the drawing, so a
 * screen reader and a search engine get them too.
 */

const TONE = {
  certified: "bg-data-good",
  denied: "bg-data-bad",
  withdrawn: "bg-data-none",
} as const;

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function fyLabel(fy: number): string {
  return `FY${String(fy).slice(2)}`;
}

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
  const byFy = new Map(years.map((y) => [y.fy, y]));
  const series: EmployerYear[] = [];
  for (let fy = first; fy <= last; fy++) {
    series.push(byFy.get(fy) ?? { fy, certified: 0, denied: 0, withdrawn: 0 });
  }
  const totals = series.map((y) => y.certified + y.denied + y.withdrawn);
  const max = Math.max(...totals, 1);
  const total = totals.reduce((a, b) => a + b, 0);
  const peak = series[totals.indexOf(Math.max(...totals))];
  const historyTotal = series
    .filter((y) => y.fy >= 2020 && y.fy <= 2023)
    .reduce((a, y) => a + y.certified + y.denied + y.withdrawn, 0);

  return (
    <section className={cn("mt-12", className)}>
      {showChart && peak ? (
        <>
          <h2 className="font-heading text-2xl font-black">
            Year by year since {first}
          </h2>{" "}
          <p className="mt-2 max-w-2xl text-base text-foreground/70">
            {fmt(total)} PERM decisions from FY{first} to FY{last}, busiest in
            FY{peak.fy} with{" "}
            {fmt(peak.certified + peak.denied + peak.withdrawn)}.
          </p>
          <div className="mt-6 border-2 border-border bg-card p-5 sm:p-6">
            <div className="overflow-x-auto">
              <div
                className="flex h-48 min-w-[640px] items-end gap-1.5 border-b-2 border-border"
                role="img"
                aria-label={`Decisions by fiscal year, FY${first} to FY${last}, ${fmt(total)} in all. The table below has every figure.`}
              >
                {series.map((y, i) => {
                  const t = totals[i]!;
                  return (
                    <span
                      key={y.fy}
                      className="flex h-full flex-1 flex-col justify-end"
                      title={`FY${y.fy}: ${fmt(y.certified)} certified, ${fmt(y.denied)} denied, ${fmt(y.withdrawn)} withdrawn`}
                    >
                      <span
                        className="flex w-full flex-col-reverse"
                        style={{ height: `${(t / max) * 100}%` }}
                      >
                        {(["certified", "denied", "withdrawn"] as const).map(
                          (k) =>
                            y[k] > 0 ? (
                              <span
                                key={k}
                                className={cn("block w-full", TONE[k])}
                                style={{
                                  height: `${(y[k] / Math.max(t, 1)) * 100}%`,
                                }}
                              />
                            ) : null,
                        )}
                      </span>
                    </span>
                  );
                })}
              </div>
              <div
                className="mt-2 flex min-w-[640px] gap-1.5"
                aria-hidden="true"
              >
                {series.map((y) => (
                  <span
                    key={y.fy}
                    className="flex-1 text-center font-mono text-sm tabular-nums text-foreground/70"
                  >
                    {(y.fy - first) % 2 === 0 || y.fy === last
                      ? fyLabel(y.fy)
                      : ""}
                  </span>
                ))}
              </div>
            </div>

            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {(["certified", "denied", "withdrawn"] as const).map((k) => (
                <Fragment key={k}>
                  {" "}
                  <li className="flex items-center gap-2">
                    <span
                      className={cn("h-3 w-3 border-2 border-border", TONE[k])}
                      aria-hidden="true"
                    />{" "}
                    <span className="font-bold capitalize">{k}</span>
                  </li>
                </Fragment>
              ))}
            </ul>

            <p className="mt-4 border-t border-border/40 pt-3 text-sm leading-relaxed text-foreground/70">
              Fiscal years run October to September. Older years come from
              DOL&apos;s closed-year files and attach to this page by name, so a
              year the company filed under a name this page doesn&apos;t carry
              is missing rather than zero.
              {lastYearPartial
                ? ` FY${last} is partial: ${lastYearPartial}.`
                : ""}
            </p>

            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-bold">
                Every year as a table
              </summary>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[360px] border-collapse text-left tabular-nums">
                  <thead>
                    <tr className="border-b-2 border-border">
                      <th className="py-1.5 pr-4 font-bold">Fiscal year </th>
                      <th className="py-1.5 pr-4 text-right font-bold">
                        Certified{" "}
                      </th>
                      <th className="py-1.5 pr-4 text-right font-bold">
                        Denied{" "}
                      </th>
                      <th className="py-1.5 text-right font-bold">
                        Withdrawn{" "}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {series.map((y) => (
                      <tr key={y.fy} className="border-b border-border/30">
                        <td className="py-1 pr-4">FY{y.fy} </td>
                        <td className="py-1 pr-4 text-right">
                          {fmt(y.certified)}{" "}
                        </td>
                        <td className="py-1 pr-4 text-right">
                          {fmt(y.denied)}{" "}
                        </td>
                        <td className="py-1 text-right">{fmt(y.withdrawn)} </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
        </>
      ) : null}

      {cases.length > 0 ? (
        <div className="mt-6 border-2 border-border bg-card p-5 sm:p-6">
          <h3 className="font-heading text-lg font-black">
            Decided in FY2020 to FY2023
          </h3>{" "}
          <p className="mt-1 text-sm text-foreground/70">
            {cases.length < historyTotal
              ? `The ${fmt(cases.length)} most recent of ${fmt(historyTotal)}.`
              : `All ${fmt(cases.length)}.`}{" "}
            Case numbers from these years start with A-; look one up for
            DOL&apos;s full record.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm tabular-nums">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="py-1.5 pr-4 font-bold">Case </th>
                  <th className="py-1.5 pr-4 font-bold">Decided </th>
                  <th className="py-1.5 pr-4 font-bold">Outcome </th>
                  <th className="py-1.5 pr-4 font-bold">Job </th>
                  <th className="py-1.5 text-right font-bold">Offered wage </th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr
                    key={c.caseNumber}
                    className="border-b border-border/30 align-top"
                  >
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
                      {c.wage != null
                        ? `$${fmt(Math.round(c.wage))}`
                        : "n/a"}{" "}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}
