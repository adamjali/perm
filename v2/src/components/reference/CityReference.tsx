import Link from "next/link";

import { FigurePlate } from "@/components/tools/FigurePlate";
import { formatDollars, formatInt } from "@/lib/format";
import {
  cityGeo,
  marketPayForArea,
  priceParity,
  wageLevelsForArea,
  wageYearLabel,
} from "@/lib/turso/reference";

import { PayBands, type PayBand } from "./PayBands";

/**
 * Where a worksite city sits and what the jobs filed there pay in its metro.
 *
 * Census places the city in a county and metro area; DOL's own tables put the
 * county in a prevailing wage area. For the jobs filed most in the city, the
 * figure lays BLS's market pay for that metro beside DOL's four levels there.
 * BEA's price level for the metro joins once its key exists. Every part is
 * left out when its source has nothing for this city.
 */

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
/** Small counts as words, the way a sentence says them. */
export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}

/** "Bronx, Kings and New York counties", or the full names when the kinds differ. */
export function countyPhrase(names: string[]): string {
  const bare = names.every((n) => n.endsWith(" County")) ? names.map((n) => n.slice(0, -" County".length)) : names;
  const list = bare.length > 1 ? `${bare.slice(0, -1).join(", ")} and ${bare.at(-1)}` : (bare[0] ?? "");
  return bare === names ? list : `${list} counties`;
}

export interface CityJob {
  code: string;
  title: string;
  slug: string | null;
  n: number;
}

export async function CityReference({
  cityKey,
  label,
  jobs,
  jobsNoun,
}: {
  cityKey: string;
  label: string;
  jobs: CityJob[];
  /** What `n` counts: "PERM decisions" or "certified LCAs". */
  jobsNoun: string;
}) {
  const geo = await cityGeo(cityKey);
  if (!geo) return null;
  // A city's PERM record reaches back to FY2016, when jobs carried 2010 SOC
  // codes BLS and DOL no longer publish, so look a little further down the
  // list and keep the first six that have current figures.
  const top = jobs.slice(0, 18);
  const area = geo.wageArea;
  const [pay, levels, parity] = await Promise.all([
    area ? marketPayForArea(area, top.map((j) => j.code)) : Promise.resolve([]),
    area ? wageLevelsForArea(area, top.map((j) => j.code)) : Promise.resolve([]),
    geo.cbsa ? priceParity(geo.cbsa) : Promise.resolve(null),
  ]);
  const payBy = new Map(pay.map((p) => [p.soc, p]));
  const levelBy = new Map(levels.map((l) => [l.soc, l]));
  const bands: PayBand[] = top
    .map((j): PayBand | null => {
      const p = payBy.get(j.code.slice(0, 7));
      const l = levelBy.get(j.code.slice(0, 7));
      if (!p && !l) return null;
      return {
        key: j.code,
        label: j.title,
        sub: `${formatInt(j.n)} ${jobsNoun}`,
        tipLabel: j.title,
        p10: p?.p10 ?? null,
        p25: p?.p25 ?? null,
        median: p?.median ?? null,
        p75: p?.p75 ?? null,
        p90: p?.p90 ?? null,
        levels: l ? l.yearly : null,
      };
    })
    .filter((b): b is PayBand => b !== null)
    .slice(0, 6);
  const year = levels[0]?.wageYear ?? null;
  const series = pay[0]?.series ?? null;
  const placed = geo.countyBasis === "nearest-in-state" ? "near" : "in";
  // A city whose counties fall in different wage areas has no one area; the
  // figures are for the one at its center, and the page says so.
  const split = (geo.wageAreas ?? 0) > 1;

  return (
    <>
      <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8" aria-labelledby="city-where">
        <h2 id="city-where" className="font-heading text-xl font-black sm:text-2xl">
          Where {label} sits
        </h2>{" "}
        <dl className="mt-4 grid grid-cols-1 gap-px border-2 border-border bg-border sm:grid-cols-3 [&>*]:min-w-0">
          {geo.counties ? (
            <div className="bg-card p-4">
              <dt className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">Counties</dt>{" "}
              <dd className="mt-1 text-base font-bold">
                {geo.counties.length <= 6 ? countyPhrase(geo.counties) : `${geo.counties.length} counties`}
              </dd>{" "}
              <dd className="mt-1 text-sm text-foreground/70">
                {`Census places ${geo.placeName ?? label} in ${geo.counties.length === 2 ? "both" : `all ${countWord(geo.counties.length)}`}`}
              </dd>
            </div>
          ) : geo.countyName ? (
            <div className="bg-card p-4">
              <dt className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">County</dt>{" "}
              <dd className="mt-1 text-base font-bold">{geo.countyName}</dd>{" "}
              <dd className="mt-1 text-sm text-foreground/70">
                {geo.countyBasis === "nearest"
                  ? "The place spans several counties; this one is nearest its center"
                  : geo.countyBasis === "nearest-in-state"
                    ? "The nearest county; Census lists the place in none current"
                    : `Census places ${geo.placeName ?? label} ${placed} it`}
              </dd>
            </div>
          ) : null}{" "}
          <div className="bg-card p-4">
            <dt className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">Metro area</dt>{" "}
            <dd className="mt-1 text-base font-bold">{geo.cbsaTitle ?? "Outside any metro area"}</dd>{" "}
            {geo.cbsaType ? (
              <dd className="mt-1 text-sm text-foreground/70">
                {geo.cbsaType === "metro" ? "Metropolitan statistical area" : "Micropolitan statistical area"}
              </dd>
            ) : null}
          </div>{" "}
          {geo.wageAreaName ? (
            <div className="bg-card p-4">
              <dt className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">DOL wage area</dt>{" "}
              <dd className="mt-1 text-base font-bold">{geo.wageAreaName}</dd>{" "}
              <dd className="mt-1 text-sm text-foreground/70">
                {split
                  ? `For ${geo.countyName ?? "the county"}, at the city's center; its counties sit in ${countWord(geo.wageAreas ?? 0)} wage areas`
                  : geo.wageYear
                    ? `The area DOL sets prevailing wages for, wage year ${wageYearLabel(geo.wageYear)}`
                    : "The area DOL sets prevailing wages for"}
              </dd>
            </div>
          ) : null}
        </dl>
        {parity?.all != null ? (
          <p className="mt-4 max-w-3xl text-base leading-relaxed">
            <span className="font-heading text-2xl font-black tabular-nums">{parity.all.toFixed(1)}</span>{" "}
            is BEA&apos;s price level for the {geo.cbsaTitle} metro area in {parity.year}, against 100 for the country
            as a whole
            {parity.housing != null ? `; for housing rents it's ${parity.housing.toFixed(1)}` : ""}. A salary here buys
            about {Math.round(10000 / parity.all)}% of what the same salary buys at the national price level.
          </p>
        ) : null}
      </section>

      {bands.length ? (
        <FigurePlate
          n="05"
          title={`What these jobs pay in ${geo.wageAreaName ?? geo.cbsaTitle ?? label}`}
          subject={`${series ? `BLS ${series}` : "BLS"}${year ? `, DOL wage year ${wageYearLabel(year)}` : ""}`}
          caption={`The jobs filed most in ${label}: what employers in the metro report paying everyone in each, and DOL's four prevailing wage levels there.${split ? ` ${label} spans ${countWord(geo.wageAreas ?? 0)} of DOL's wage areas; these figures are for ${geo.wageAreaName}, which takes in its center.` : ""}`}
          source="BLS Occupational Employment and Wage Statistics; DOL OFLC wage tables"
          className="mt-10"
        >
          <PayBands bands={bands} scale="auto" label={`Market pay and DOL wage levels in ${label}`} />
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-base">
              <caption className="sr-only">Market pay and DOL wage levels for the jobs filed most here</caption>
              <thead>
                <tr className="border-b-2 border-border font-mono text-sm uppercase tracking-wider text-foreground/70">
                  <th className="py-2 pr-4 font-bold">Job</th>
                  <th className="py-2 pr-4 text-right font-bold">BLS median</th>
                  {["I", "II", "III", "IV"].map((l) => (
                    <th key={l} className="py-2 pr-4 text-right font-bold">
                      {`Level ${l}`}{" "}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bands.map((b) => {
                  const job = top.find((j) => j.code === b.key);
                  return (
                    <tr key={b.key} className="border-b border-border/60">
                      <td className="py-2 pr-4">
                        {job?.slug ? (
                          <Link href={`/perm-wages/${job.slug}`} className={LINK}>
                            {b.label}
                          </Link>
                        ) : (
                          b.label
                        )}{" "}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{b.median != null ? formatDollars(b.median) : "—"}{" "}</td>
                      {[0, 1, 2, 3].map((i) => (
                        <td key={i} className="py-2 pr-4 text-right tabular-nums">
                          {b.levels?.[i] != null ? formatDollars(b.levels[i] as number) : "—"}{" "}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {area ? (
            <p className="mt-3 text-sm text-foreground/70">
              <Link href="/tools/wage-levels" className={LINK}>
                Any job in any area, and every wage year since 2021-22, in the wage-level tool
              </Link>
              .
            </p>
          ) : null}
        </FigurePlate>
      ) : null}
    </>
  );
}
