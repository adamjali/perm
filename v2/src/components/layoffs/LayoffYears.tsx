import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { formatInt, formatShareOf } from "@/lib/format";
import { yearComplete, type LayoffYear } from "@/lib/layoffDisclosures";
import { longDate } from "@/lib/employerStages";

/**
 * Year by year: how many decided applications reported a layoff, and what
 * share of the year's answered applications that was. Two charts, because a
 * count rises with how many cases DOL decided that year and a share doesn't.
 * A year DOL is still publishing is hatched, with the day it reaches.
 */
export function LayoffYears({ years }: { years: readonly LayoffYear[] }) {
  if (years.length === 0) return null;
  const tip = (y: LayoffYear) =>
    [
      `Fiscal year ${y.fy}${yearComplete(y) ? "" : `, decisions to ${y.through ? longDate(y.through) : "date"}`}`,
      `${formatInt(y.yes)} said yes`,
      `${formatShareOf(y.yes, y.answered)} of ${formatInt(y.answered)} answered`,
    ].join("\n");
  const count: Column[] = years.map((y) => ({
    key: `n${y.fy}`,
    value: y.yes,
    label: `FY${y.fy}`,
    tip: tip(y),
    partial: !yearComplete(y),
    top: formatInt(y.yes),
  }));
  // Hundredths of a percent, so the columns carry whole numbers.
  const share: Column[] = years.map((y) => ({
    key: `s${y.fy}`,
    value: y.answered > 0 ? Math.round((y.yes / y.answered) * 10000) : 0,
    label: `FY${y.fy}`,
    tip: tip(y),
    partial: !yearComplete(y),
    top: y.answered > 0 ? formatShareOf(y.yes, y.answered) : "",
  }));
  const first = `FY${years[0]!.fy}`;
  const last = `FY${years[years.length - 1]!.fy}`;
  const newest = years[years.length - 1]!;
  const partialKey = yearComplete(newest) ? undefined : `DOL has published to ${newest.through ? longDate(newest.through) : "date"}`;
  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 [&>*]:min-w-0">
      <div>
        <h3 className="font-heading text-lg font-bold">Applications that said yes</h3>{" "}
        <ColumnChart
          columns={count}
          label="Decided PERM applications that reported a layoff, by fiscal year"
          first={first}
          last={last}
          unit="applications"
          showMax={false}
          topsFrom="xl"
          partialKey={partialKey}
          className="mt-4"
        />
      </div>{" "}
      <div>
        <h3 className="font-heading text-lg font-bold">Share of the year&apos;s applications</h3>{" "}
        <ColumnChart
          columns={share}
          label="Share of answered PERM applications that reported a layoff, by fiscal year"
          first={first}
          last={last}
          unit="hundredths of a percent"
          showMax={false}
          topsFrom="xl"
          partialKey={partialKey}
          className="mt-4"
        />
      </div>
    </div>
  );
}
