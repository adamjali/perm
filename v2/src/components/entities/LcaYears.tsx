import { formatInt } from "@/lib/format";

import { YearBars, fillYears, type YearCount } from "./YearBars";

/**
 * An employer's H-1B LCAs by fiscal year, FY2008 on (lib/db/lcaYears.ts), on the PERM chart's bars. One year
 * says nothing the page's headline doesn't, so it needs a span.
 */
export function LcaYears({ years, className }: { years: YearCount[]; className?: string }) {
  const series = fillYears(years);
  if (series.length < 2) return null;
  const first = series[0]!.fy;
  const last = series[series.length - 1]!.fy;
  const totals = series.map((y) => y.certified + y.denied + y.withdrawn);
  const total = totals.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const peak = series[totals.indexOf(Math.max(...totals))]!;
  return (
    <section className={className}>
      <h3 className="font-heading text-lg font-bold">H-1B LCAs year by year since {first}</h3>{" "}
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        {formatInt(total)} H-1B LCAs DOL decided from FY{first} to FY{last}, busiest in FY{peak.fy} with{" "}
        {formatInt(peak.certified + peak.denied + peak.withdrawn)}.
      </p>
      <div className="mt-4">
        <YearBars
          years={series}
          label="H-1B LCAs by fiscal year"
          noun="H-1B LCAs"
          note={
            <>
              From DOL&apos;s H-1B disclosure files, matched to this page by the employer&apos;s spellings. An LCA
              certified and then withdrawn counts as withdrawn. Fiscal years, October to September; the newest is
              partial.
            </>
          }
        />
      </div>
    </section>
  );
}
