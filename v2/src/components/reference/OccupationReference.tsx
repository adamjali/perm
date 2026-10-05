import Link from "next/link";

import { BarRows } from "@/components/data/BarRows";
import { FinePrint } from "@/components/data/FinePrint";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { formatDollars, formatInt } from "@/lib/format";
import type { FacetRow } from "@/lib/turso/entityDetail";
import {
  HOURS_PER_YEAR,
  cityGeoMany,
  dolBasisFor,
  marketPayIn,
  marketPayNational,
  occupationSlugs,
  onetForSoc,
  projectionFor,
  soc7,
  wageLevelHistory,
  wageYearLabel,
  type MarketPay,
} from "@/lib/turso/reference";

import { PayBands, type PayBand } from "./PayBands";

/**
 * The occupation outside PERM: what O*NET says the job is and takes, what BLS
 * says it pays and where it's heading, and DOL's own wage levels for it, in
 * the metros where its PERM filings are.
 *
 * Every part is optional: a section whose source has nothing for this SOC code
 * is left out, and the PERM page above stands on its own.
 */

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";
const LEVELS = ["I", "II", "III", "IV"] as const;
const yearly = (h: number | null) => (h == null ? null : Math.round(h * HOURS_PER_YEAR));

/** Up to `n` metros (DOL wage areas) where this job's PERM filings sit, busiest first. */
async function filingAreas(cities: FacetRow[], n: number) {
  const geo = await cityGeoMany(cities.map((c) => c.key ?? "").filter(Boolean));
  const seen = new Map<string, { area: string; name: string; filings: number; cities: string[] }>();
  for (const c of cities) {
    const g = c.key ? geo.get(c.key) : undefined;
    if (!g?.wageArea || !g.wageAreaName) continue;
    const e = seen.get(g.wageArea) ?? { area: g.wageArea, name: g.wageAreaName, filings: 0, cities: [] };
    e.filings += c.n;
    if (e.cities.length < 3) e.cities.push(c.label.replace(/, [A-Z]{2}$/, ""));
    seen.set(g.wageArea, e);
  }
  return [...seen.values()].sort((a, b) => b.filings - a.filings).slice(0, n);
}

function band(key: string, label: string, sub: string | undefined, pay: MarketPay | null, levels: (number | null)[] | null, perm?: number | null): PayBand | null {
  if (!pay && !levels) return null;
  return {
    key,
    label,
    sub,
    tipLabel: label,
    p10: pay?.p10 ?? null,
    p25: pay?.p25 ?? null,
    median: pay?.median ?? null,
    p75: pay?.p75 ?? null,
    p90: pay?.p90 ?? null,
    levels,
    perm: perm ?? null,
  };
}

export async function OccupationReference({
  code,
  name,
  permMedian,
  cities,
}: {
  code: string | null;
  name: string;
  permMedian: number | null;
  cities: FacetRow[];
}) {
  const soc = soc7(code);
  if (!soc) return null;
  const [onet, national, projection, basis, areas] = await Promise.all([
    onetForSoc(soc),
    marketPayNational(soc),
    projectionFor(soc),
    dolBasisFor(soc),
    filingAreas(cities, 5),
  ]);
  const [areaPay, histories, related] = await Promise.all([
    marketPayIn(soc, areas.map((a) => a.area)),
    Promise.all(areas.map((a) => wageLevelHistory(soc, a.area))),
    occupationSlugs((onet?.occupations[0]?.related ?? []).map((r) => r.code)),
  ]);
  const payByArea = new Map(areaPay.map((p) => [p.area, p]));
  const newestLevels = (i: number) => {
    const h = histories[i] ?? [];
    const last = h[h.length - 1];
    return last ? { year: last.wageYear, levels: last.levels.map(yearly), label: last.label } : null;
  };

  const bands = [
    band("us", "United States", national ? `${formatInt(national.employment ?? 0)} jobs` : undefined, national, null, permMedian),
    ...areas.map((a, i) =>
      band(a.area, a.name, a.cities.join(", "), payByArea.get(a.area) ?? null, newestLevels(i)?.levels ?? null),
    ),
  ].filter((b): b is PayBand => b !== null);
  const levelYear = areas.map((_, i) => newestLevels(i)?.year).find((y) => y != null) ?? null;
  const main = onet?.occupations[0] ?? null;
  const zone = main?.jobZone != null ? onet?.zones[String(main.jobZone)] : undefined;
  const series = national?.series ?? areaPay[0]?.series ?? null;
  const busiest = areas[0];
  const history = (busiest ? histories[0] : undefined) ?? [];

  if (!main && !bands.length && !projection) return null;

  return (
    <>
      {bands.length ? (
        <FigurePlate
          n="04"
          title="What the job pays outside PERM"
          subject={`${series ? `BLS ${series}` : "BLS"}${levelYear ? `, DOL wage year ${wageYearLabel(levelYear)}` : ""}`}
          caption={
            <>
              The block is the middle half of what employers report paying everyone in this job, citizen or not; the
              ticks under it are DOL&apos;s four prevailing wage levels for that metro, the floors a PERM or H-1B offer
              is held to.
              {permMedian != null ? " The marker on the national line is the median PERM offer above." : ""}
            </>
          }
          source="BLS Occupational Employment and Wage Statistics; DOL OFLC wage tables"
          className="mt-10"
        >
          <PayBands bands={bands} label={`${name}: market pay and DOL wage levels`} />
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-base">
              <caption className="sr-only">Market pay and DOL wage levels, by area</caption>
              <thead>
                <tr className="border-b-2 border-border font-mono text-sm uppercase tracking-wider text-foreground/70">
                  <th className="py-2 pr-4 font-bold">Area</th>
                  <th className="py-2 pr-4 text-right font-bold">BLS median</th>
                  {LEVELS.map((l) => (
                    <th key={l} className="py-2 pr-4 text-right font-bold">
                      {`Level ${l}`}{" "}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bands.map((b) => (
                  <tr key={b.key} className="border-b border-border/60">
                    <td className="py-2 pr-4">{b.label}{" "}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{b.median != null ? formatDollars(b.median) : "—"}{" "}</td>
                    {LEVELS.map((l, i) => (
                      <td key={l} className="py-2 pr-4 text-right tabular-nums">
                        {b.levels?.[i] != null ? formatDollars(b.levels[i] as number) : b.key === "us" ? "" : "—"}{" "}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <FinePrint summary="How these figures fit together" className="mt-3">
            <p>
              BLS surveys employers on what they pay everyone in a job; DOL builds its four levels from the same survey a
              year later (the July 2026 wage year uses BLS&apos;s May 2025 estimates). DOL publishes levels by area, not
              nationally, so the United States line has none. Levels are hourly in DOL&apos;s tables; here they&apos;re
              shown a year at 2,080 hours, as DOL computes them. The metros are the ones holding the most of this
              job&apos;s PERM filings, placed by Census&apos;s county files.
            </p>
          </FinePrint>
        </FigurePlate>
      ) : null}

      {busiest && history.length >= 2 ? (
        <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8" aria-labelledby="occ-dol-years">
          <h2 id="occ-dol-years" className="font-heading text-xl font-black sm:text-2xl">
            DOL&apos;s levels for this job in {busiest.name}, year by year
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
            Each July DOL resets the four levels from BLS&apos;s newest survey. A determination keeps the figures of
            the year it was issued in.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-base">
              <caption className="sr-only">DOL wage levels by wage year, {busiest.name}</caption>
              <thead>
                <tr className="border-b-2 border-border font-mono text-sm uppercase tracking-wider text-foreground/70">
                  <th className="py-2 pr-4 font-bold">Wage year</th>
                  {LEVELS.map((l) => (
                    <th key={l} className="py-2 pr-4 text-right font-bold">
                      {`Level ${l}`}{" "}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((y, i) => (
                  <tr key={y.wageYear} className={i === 0 ? "border-b border-border/60 font-bold" : "border-b border-border/60"}>
                    <td className="py-2 pr-4 tabular-nums">{wageYearLabel(y.wageYear)}{" "}</td>
                    {y.levels.map((v, j) => (
                      <td key={j} className="py-2 pr-4 text-right tabular-nums">
                        {v != null ? formatDollars(yearly(v) as number) : y.label ? y.label : "—"}{" "}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-foreground/70">
            <Link href={`/tools/wage-levels?soc=${soc}`} className={LINK}>
              Every area and both wage tables in the wage-level tool
            </Link>
            .
          </p>
        </section>
      ) : null}

      {main ? (
        <section className="mt-12" aria-labelledby="occ-onet">
          <h2 id="occ-onet" className="font-heading text-2xl font-black">
            What the job is
          </h2>{" "}
          <p className="mt-3 max-w-3xl text-lg leading-relaxed">{main.description}</p>{" "}
          <dl className="mt-6 grid grid-cols-1 gap-px border-2 border-border bg-border sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            {zone ? (
              <div className="bg-card p-4">
                <dt className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">Preparation</dt>{" "}
                <dd className="mt-1 text-base font-bold">{zone.name.replace(/^Job Zone [\w-]+: /, "")}</dd>{" "}
                <dd className="mt-1 text-sm text-foreground/70">{`O*NET Job Zone ${main.jobZone === 2 ? "1-2" : main.jobZone}`}</dd>
              </div>
            ) : null}{" "}
            {basis?.education ? (
              <div className="bg-card p-4">
                <dt className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">DOL&apos;s education basis</dt>{" "}
                <dd className="mt-1 text-base font-bold">{basis.education}</dd>{" "}
                <dd className="mt-1 text-sm text-foreground/70">
                  {`Wage year ${wageYearLabel(basis.wageYear)}${basis.appendixA ? ", on DOL's Appendix A list" : ""}`}
                </dd>
              </div>
            ) : null}{" "}
            {projection?.changePct != null ? (
              <div className="bg-card p-4">
                <dt className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">
                  {`Jobs, ${projection.baseYear} to ${projection.projYear}`}
                </dt>{" "}
                <dd className="mt-1 text-base font-bold">
                  {`${projection.changePct > 0 ? "+" : ""}${projection.changePct.toFixed(1)}%`}
                </dd>{" "}
                <dd className="mt-1 text-sm text-foreground/70">
                  {projection.openings != null ? `About ${formatInt(Math.round(projection.openings * 1000))} openings a year (BLS)` : "BLS projection"}
                </dd>
              </div>
            ) : null}{" "}
            {projection?.education ? (
              <div className="bg-card p-4">
                <dt className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">Typical entry</dt>{" "}
                <dd className="mt-1 text-base font-bold">{projection.education}</dd>{" "}
                <dd className="mt-1 text-sm text-foreground/70">
                  {projection.experience && projection.experience !== "None" ? `${projection.experience} of related work (BLS)` : "BLS"}
                </dd>
              </div>
            ) : null}
          </dl>
          {main.bright.length ? (
            <p className="mt-4 text-base">
              <span className="mr-2 inline-block border-2 border-border bg-tint-primary px-2 py-0.5 font-bold">Bright Outlook</span>{" "}
              O*NET OnLine lists this job for {main.bright.map((b) => b.toLowerCase()).join(" and ")}.
            </p>
          ) : null}
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 [&>*]:min-w-0">
            {main.tasks.length ? (
              <div>
                <h3 className="font-heading text-lg font-black">The work, most important first</h3>{" "}
                <ol className="mt-3 list-decimal space-y-2 pl-6 text-base leading-relaxed">
                  {main.tasks.map((t) => (
                    <li key={t}>{t}{" "}</li>
                  ))}
                </ol>
              </div>
            ) : null}{" "}
            <div className="space-y-8">
              {main.education.length ? (
                <div>
                  <h3 className="font-heading text-lg font-black">The education workers in it report</h3>{" "}
                  <BarRows
                    className="mt-3"
                    label="Required education reported by workers"
                    rows={main.education.map((e) => ({ key: e.level, label: e.level, value: e.pct, text: `${e.pct}%` }))}
                  />
                </div>
              ) : null}{" "}
              {main.titles.length ? (
                <div>
                  <h3 className="font-heading text-lg font-black">Titles people use for it</h3>{" "}
                  <p className="mt-2 text-base leading-relaxed text-foreground/80">{main.titles.join(", ")}.</p>
                </div>
              ) : null}
            </div>
          </div>
          {onet && onet.occupations.length > 1 ? (
            <p className="mt-6 max-w-3xl text-base text-foreground/70">
              O*NET also describes{" "}
              {onet.occupations.slice(1).map((o, i, a) => `${o.title}${i < a.length - 2 ? ", " : i === a.length - 2 ? " and " : ""}`)}{" "}
              under this SOC code.
            </p>
          ) : null}
          {main.related.length ? (
            <p className="mt-4 max-w-3xl text-base">
              <span className="font-bold">Related jobs: </span>
              {main.related.map((r, i) => {
                const slug = related.get(r.code.slice(0, 7));
                return (
                  <span key={r.code}>
                    {slug ? (
                      <Link href={`/perm-wages/${slug}`} className={LINK}>
                        {r.title}
                      </Link>
                    ) : (
                      r.title
                    )}
                    {i < main.related.length - 1 ? ", " : "."}{" "}
                  </span>
                );
              })}
            </p>
          ) : null}
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-foreground/70">
            This section includes information from the{" "}
            <a href="https://www.onetcenter.org/database.html" className={LINK} rel="noopener">
              {`O*NET${onet?.version ? ` ${onet.version}` : ""} Database`}
            </a>{" "}
            and O*NET OnLine by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA), used
            under the{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/" className={LINK} rel="noopener license">
              CC BY 4.0 license
            </a>
            . O*NET® is a trademark of USDOL/ETA. PERM Tracker has modified some of this information (the shares are
            rounded and only the top tasks are shown);{" "}
            <Link href="/methodology#onet" className={LINK}>
              what changed
            </Link>
            . USDOL/ETA has not approved, endorsed, or tested these modifications.
          </p>
        </section>
      ) : null}
    </>
  );
}
