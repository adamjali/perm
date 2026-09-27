import { Fragment } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * PERM decisions by fiscal year as stacked bars, with a legend, a note and
 * every figure in a collapsed table (for a screen reader and a crawler).
 * Shared by employer pages and the city, industry and country pages.
 *
 * Bars rather than a line: each year is a count of decisions DOL made, and a
 * year with none is a real zero worth seeing as a gap, not a point to draw
 * through.
 */

export interface YearCount {
  fy: number;
  certified: number;
  denied: number;
  withdrawn: number;
}

const TONE = {
  certified: "bg-data-good",
  denied: "bg-data-bad",
  withdrawn: "bg-data-none",
} as const;

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Every year from the first to the last, a missing year as zero. */
export function fillYears(years: YearCount[]): YearCount[] {
  if (years.length === 0) return [];
  const first = years[0]!.fy;
  const last = years[years.length - 1]!.fy;
  const byFy = new Map(years.map((y) => [y.fy, y]));
  const out: YearCount[] = [];
  for (let fy = first; fy <= last; fy++) {
    out.push(byFy.get(fy) ?? { fy, certified: 0, denied: 0, withdrawn: 0 });
  }
  return out;
}

export function YearBars({ years, note }: { years: YearCount[]; note?: ReactNode }) {
  const series = fillYears(years);
  if (series.length === 0) return null;
  const first = series[0]!.fy;
  const last = series[series.length - 1]!.fy;
  const totals = series.map((y) => y.certified + y.denied + y.withdrawn);
  const max = Math.max(...totals, 1);
  const total = totals.reduce((a, b) => a + b, 0);
  return (
    <div className="border-2 border-border bg-card p-5 sm:p-6">
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
                <span className="flex w-full flex-col-reverse" style={{ height: `${(t / max) * 100}%` }}>
                  {(["certified", "denied", "withdrawn"] as const).map((k) =>
                    y[k] > 0 ? (
                      <span
                        key={k}
                        className={cn("block w-full", TONE[k])}
                        style={{ height: `${(y[k] / Math.max(t, 1)) * 100}%` }}
                      />
                    ) : null,
                  )}
                </span>
              </span>
            );
          })}
        </div>
        <div className="mt-2 flex min-w-[640px] gap-1.5" aria-hidden="true">
          {series.map((y) => (
            <span key={y.fy} className="flex-1 text-center font-mono text-sm tabular-nums text-foreground/70">
              {/* The space sits inside the label, so the axis never reads as one run. */}
              {(y.fy - first) % 2 === 0 || y.fy === last ? `FY${String(y.fy).slice(2)} ` : " "}
            </span>
          ))}
        </div>
      </div>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {(["certified", "denied", "withdrawn"] as const).map((k) => (
          <Fragment key={k}>
            {" "}
            <li className="flex items-center gap-2">
              <span className={cn("h-3 w-3 border-2 border-border", TONE[k])} aria-hidden="true" />{" "}
              <span className="font-bold capitalize">{k}</span>
            </li>
          </Fragment>
        ))}
      </ul>

      {note ? (
        <p className="mt-4 border-t border-border/40 pt-3 text-sm leading-relaxed text-foreground/70">{note}</p>
      ) : null}

      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-[44px] cursor-pointer items-center font-bold">Every year as a table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[360px] border-collapse text-left tabular-nums">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="py-1.5 pr-4 font-bold">Fiscal year{" "}</th>
                <th className="py-1.5 pr-4 text-right font-bold">Certified{" "}</th>
                <th className="py-1.5 pr-4 text-right font-bold">Denied{" "}</th>
                <th className="py-1.5 text-right font-bold">Withdrawn{" "}</th>
              </tr>
            </thead>
            <tbody>
              {series.map((y) => (
                <tr key={y.fy} className="border-b border-border/30">
                  <td className="py-1 pr-4">FY{y.fy}{" "}</td>
                  <td className="py-1 pr-4 text-right">{fmt(y.certified)}{" "}</td>
                  <td className="py-1 pr-4 text-right">{fmt(y.denied)}{" "}</td>
                  <td className="py-1 text-right">{fmt(y.withdrawn)}{" "}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
