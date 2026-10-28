import Link from "next/link";
import { Fragment } from "react";

import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { EB_LINE_COLOURS } from "@/components/queue/ebLineColours";
import { getI140ClassCountry } from "@/lib/db/uscisQuarterly";
import { formatInt, formatShareOf } from "@/lib/format";
import { countryOrder, permLineYears } from "@/lib/uscisQuarterlyShape";

const EB2_FILL = EB_LINE_COLOURS.EB2.fill;
const EB3_FILL = EB_LINE_COLOURS.EB3.fill;
const ALL = "All Countries";

const countryName = (c: string) => (c === ALL ? "Every country" : c);

/**
 * Which line I-140s filed on a PERM actually went to, from USCIS's own quarterly
 * workbook of I-140 receipts by class and country of birth, live inside an
 * article. Without `country`, each country's newest complete fiscal year as a
 * split bar; with it, that country's every year as stacked columns, so a wave
 * of downgrades shows as the year EB-3 jumped. The national interest waiver is
 * left out: it needs no PERM.
 */
export async function EbApprovalsNow({ country }: { country?: string }) {
  const data = await getI140ClassCountry().catch(() => null);
  if (!data || data.years.length < 2) {
    return (
      <p>
        USCIS&apos;s I-140 counts are unavailable for the moment. The{" "}
        <Link href="/i140-awaiting-visa" className="link">
          approved I-140s page
        </Link>{" "}
        carries them.
      </p>
    );
  }
  const newest = data.years[data.years.length - 1]!;
  const fullYear = newest - 1;
  const source = `USCIS, ${data.sourceFile}: I-140s received each fiscal year and approved since, by the beneficiary's country of birth.`;

  if (country) {
    const years = permLineYears(data.cells, country);
    if (years.length < 2) return null;
    const columns: Column[] = years.map((y) => ({
      key: String(y.fy),
      value: y.eb2 + y.eb3,
      label: `FY${y.fy}`,
      tip: `FY${y.fy}${y.fy === newest ? " so far" : ""}\n${formatInt(y.eb2)} EB-2\n${formatInt(y.eb3)} EB-3`,
      partial: y.fy === newest,
      top: `’${String(y.fy).slice(2)}`,
      parts: [
        { value: y.eb2, fill: EB2_FILL },
        { value: y.eb3, fill: EB3_FILL },
      ],
    }));
    return (
      <figure className="not-prose my-8">
        <ColumnChart
          label={`${countryName(country)}: I-140s filed on a PERM and approved, by fiscal year and line`}
          unit="Approved"
          first={`FY${years[0]!.fy}`}
          last={`FY${newest}`}
          columns={columns}
        />{" "}
        <Key />{" "}
        <figcaption className="mt-3 text-sm leading-relaxed text-soft">
          {source} FY{newest} is still filling.
        </figcaption>
      </figure>
    );
  }

  const rows = countryOrder(data.countries)
    .map((c) => ({ country: c, year: permLineYears(data.cells, c).find((y) => y.fy === fullYear) }))
    .filter((r): r is { country: string; year: { fy: number; eb2: number; eb3: number } } => !!r.year && r.year.eb2 + r.year.eb3 > 0);
  if (rows.length === 0) return null;
  return (
    <figure className="not-prose my-8">
      <dl className="grid grid-cols-1 gap-4 [&>*]:min-w-0">
        {rows.map(({ country: c, year }) => {
          const total = year.eb2 + year.eb3;
          return (
            <Fragment key={c}>
              {" "}
              <div>
                <dt className="flex items-baseline justify-between gap-3 text-base font-bold">
                  {countryName(c)} <span className="text-sm font-normal tabular-nums text-soft">{formatInt(total)} approved</span>
                </dt>{" "}
                <dd className="mt-1.5">
                  <div aria-hidden="true" className="flex h-7 w-full border-2 border-border">
                    <span className={`h-full ${EB2_FILL}`} style={{ width: `${(year.eb2 / total) * 100}%` }} />
                    <span className={`h-full ${EB3_FILL}`} style={{ width: `${(year.eb3 / total) * 100}%` }} />
                  </div>
                </dd>{" "}
                <dd className="mt-1 flex justify-between gap-3 text-sm tabular-nums">
                  <span>EB-2 {formatShareOf(year.eb2, total)}</span>{" "}
                  <span>EB-3 {formatShareOf(year.eb3, total)}</span>
                </dd>
              </div>
            </Fragment>
          );
        })}
      </dl>{" "}
      <Key />{" "}
      <figcaption className="mt-3 text-sm leading-relaxed text-soft">
        FY{fullYear}, the newest complete fiscal year. {source}
      </figcaption>
    </figure>
  );
}

function Key() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className={`inline-block size-3 border-2 ${EB_LINE_COLOURS.EB2.edge} ${EB2_FILL}`} /> EB-2, advanced degree{" "}
      </li>{" "}
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className={`inline-block size-3 border-2 ${EB_LINE_COLOURS.EB3.edge} ${EB3_FILL}`} /> EB-3, skilled, professional or other worker{" "}
      </li>
    </ul>
  );
}
