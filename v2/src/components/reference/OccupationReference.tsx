import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";

import { BarRows } from "@/components/data/BarRows";
import { FinePrint } from "@/components/data/FinePrint";
import { SocCodeText } from "@/components/data/SocCodeText";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { OnetCredit } from "./OnetCredit";
import { ScrollBox } from "@/components/ui/scroll-box";
import { formatDollars, formatInt } from "@/lib/format";
import type { FacetRow } from "@/lib/db/entityDetail";
import {
  cityGeoMany,
  dolBasisFor,
  marketPayIn,
  marketPayNational,
  occupationSlugs,
  onetForSoc,
  projectionFor,
  wageLevelHistory,
  wageYearLabel,
  type MarketPay,
} from "@/lib/db/reference";

import { socGroup } from "@/lib/socCode";
import { predecessorNote } from "@/lib/socCrosswalk";
import { PayBands, type PayBand } from "./PayBands";
import { entityHref } from "@/lib/entityPayload";

/**
 * The occupation outside PERM: what O*NET says the job is and takes, what BLS
 * says it pays and where it's heading, and DOL's own wage levels for it, in
 * the metros where its PERM filings are.
 *
 * Every part is optional: a section whose source has nothing for this SOC code
 * is left out, and the PERM page above stands on its own.
 */

const LEVELS = ["I", "II", "III", "IV"] as const;

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
  const soc = socGroup(code);
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
    return last ? { year: last.wageYear, levels: last.yearly, label: last.label } : null;
  };

  const bands = [
    band("us", "United States", national ? `${formatInt(national.employment ?? 0)} jobs` : undefined, national, null, permMedian),
    ...areas.map((a, i) =>
      band(a.area, a.name, a.cities.join(", "), payByArea.get(a.area) ?? null, newestLevels(i)?.levels ?? null),
    ),
  ].filter((b): b is PayBand => b !== null);
  const levelYear = areas.map((_, i) => newestLevels(i)?.year).find((y) => y != null) ?? null;
  // BLS publishes no figure for some areas; a column empty in every row is left out.
  const anyBlsMedian = bands.some((b) => b.median != null);
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
          <ScrollBox label="Market pay and DOL wage levels, by area" className="mt-6">
            <table className="w-full min-w-[40rem] text-left text-base">
              <caption className="sr-only">Market pay and DOL wage levels, by area{" "}</caption>
              <thead>
                <tr className="border-b-2 border-border text-sm text-muted-foreground">
                  <th className="py-2 pr-4 font-bold">Area{" "}</th>
                  {anyBlsMedian ? <th className="py-2 pr-4 text-right font-bold">BLS median{" "}</th> : null}
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
                    {anyBlsMedian ? (
                      <td className="py-2 pr-4 text-right tabular-nums">{b.median != null ? formatDollars(b.median) : "—"}{" "}</td>
                    ) : null}
                    {LEVELS.map((l, i) => (
                      <td key={l} className="py-2 pr-4 text-right tabular-nums">
                        {b.levels?.[i] != null ? formatDollars(b.levels[i] as number) : b.key === "us" ? "" : "—"}{" "}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollBox>
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
        <section className="mt-10 border-2 border-border bg-sage p-5 shadow-hard-sm sm:p-6" aria-labelledby="occ-dol-years">
          <h3 id="occ-dol-years" className="font-heading text-lg font-bold">
            DOL&apos;s levels for this job in {busiest.name}, year by year
          </h3>{" "}
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Each July DOL resets the four levels from BLS&apos;s newest survey; a determination keeps its year&apos;s.
          </p>
          {(() => {
            const years = [...history].sort((a, b) => b.wageYear - a.wageYear || (a.asCode ?? "").localeCompare(b.asCode ?? ""));
            // The newest four years show; the rest fold under one line, in a table with the same columns.
            const SHOWN = 4;
            const table = (rows: typeof years, head: boolean, label: string) => (
              <ScrollBox label={label} className="mt-3">
                <table className="w-full min-w-[34rem] table-fixed text-left text-base">
                  <caption className="sr-only">{label}, {busiest.name}{" "}</caption>
                  <colgroup>
                    <col className="w-[28%]" />
                    {LEVELS.map((l) => (
                      <col key={l} />
                    ))}
                  </colgroup>
                  {head ? (
                    <thead>
                      <tr className="border-b-2 border-border text-sm text-muted-foreground">
                        <th className="py-2 pr-4 font-bold">Wage year{" "}</th>
                        {LEVELS.map((l) => (
                          <th key={l} className="py-2 pr-4 text-right font-bold">
                            {`Level ${l}`}{" "}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {rows.map((y) => (
                      <tr key={`${y.wageYear}-${y.asCode ?? ""}`} className={y === years[0] ? "border-b border-border/60 font-bold" : "border-b border-border/60"}>
                        <td className="py-2 pr-4 tabular-nums">
                          {wageYearLabel(y.wageYear)}
                          {y.asCode ? <span className="block text-sm font-normal text-muted-foreground">as {y.asCode}, {y.asTitle}</span> : null}{" "}
                        </td>
                        {y.yearly.map((v, j) => (
                          <td key={j} className="py-2 pr-4 text-right tabular-nums">
                            {v != null ? formatDollars(v) : j === 0 && y.label ? y.label : "—"}{" "}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollBox>
            );
            return (
              <>
                {table(years.slice(0, SHOWN), true, "DOL wage levels by wage year")}{" "}
                {years.length > SHOWN ? (
                  // A plain fold, not FinePrint: its indented note text would shift the table's columns.
                  <details className="group mt-1">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <CaretRightIcon aria-hidden="true" weight="bold" className="size-3.5 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
                      {`The ${years.length - SHOWN} earlier years, back to ${wageYearLabel(years[years.length - 1]!.wageYear)}`}
                    </summary>
                    {table(years.slice(SHOWN), false, "Earlier DOL wage levels by wage year")}
                  </details>
                ) : null}
              </>
            );
          })()}
          {history.some((y) => y.asCode) ? (
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              <SocCodeText text={predecessorNote(soc) ?? ""} />
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            <Link href={`/tools/wage-levels?soc=${soc}`} className="link">
              Every area and both wage tables in the wage-level tool
            </Link>
            .
          </p>
        </section>
      ) : null}

      {main ? (
        <section className="mt-12" aria-labelledby="occ-onet">
          <h2 id="occ-onet" className="font-heading text-2xl font-bold">
            What the job is
          </h2>{" "}
          <p className="mt-3 max-w-3xl text-lg leading-relaxed">{main.description}</p>{" "}
          <dl className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 [&>*]:min-w-0">
            {zone ? (
              <div className="bg-sage p-4">
                <dt className="text-sm font-bold text-muted-foreground">Preparation</dt>{" "}
                <dd className="mt-1 text-base font-bold">{zone.name.replace(/^Job Zone [\w-]+: /, "")}</dd>{" "}
                <dd className="mt-1 text-sm text-muted-foreground">{`O*NET Job Zone ${main.jobZone === 2 ? "1-2" : main.jobZone}`}</dd>
              </div>
            ) : null}{" "}
            {basis?.education ? (
              <div className="bg-sage p-4">
                <dt className="text-sm font-bold text-muted-foreground">DOL&apos;s education basis</dt>{" "}
                <dd className="mt-1 text-base font-bold">{basis.education}</dd>{" "}
                <dd className="mt-1 text-sm text-muted-foreground">
                  {`Wage year ${wageYearLabel(basis.wageYear)}${basis.appendixA ? ", on DOL's Appendix A list" : ""}`}
                </dd>
              </div>
            ) : null}{" "}
            {projection?.changePct != null ? (
              <div className="bg-sage p-4">
                <dt className="text-sm font-bold text-muted-foreground">
                  {`Jobs, ${projection.baseYear} to ${projection.projYear}`}
                </dt>{" "}
                <dd className="mt-1 text-base font-bold">
                  {`${projection.changePct > 0 ? "+" : ""}${projection.changePct.toFixed(1)}%`}
                </dd>{" "}
                <dd className="mt-1 text-sm text-muted-foreground">
                  {projection.openings != null ? `About ${formatInt(Math.round(projection.openings * 1000))} openings a year (BLS)` : "BLS projection"}
                </dd>
              </div>
            ) : null}{" "}
            {projection?.education ? (
              <div className="bg-sage p-4">
                <dt className="text-sm font-bold text-muted-foreground">Typical entry</dt>{" "}
                <dd className="mt-1 text-base font-bold">{projection.education}</dd>{" "}
                <dd className="mt-1 text-sm text-muted-foreground">
                  {projection.experience && projection.experience !== "None" ? `${projection.experience} of related work (BLS)` : "BLS"}
                </dd>
              </div>
            ) : null}
          </dl>
          {main.bright.length ? (
            <p className="mt-4 text-base">
              <span className="mr-2 inline-block bg-sage px-2 py-0.5 font-bold border-2 border-border">Bright Outlook</span>{" "}
              O*NET OnLine lists this job for {main.bright.map((b) => b.toLowerCase()).join(" and ")}.
            </p>
          ) : null}
          <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2 [&>*]:min-w-0">
            {main.tasks.length ? (
              <div>
                <h3 className="font-heading text-lg font-bold">The work, most important first</h3>{" "}
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
                  <h3 className="font-heading text-lg font-bold">The education workers in it report</h3>{" "}
                  <BarRows
                    className="mt-3"
                    label="Required education reported by workers"
                    rows={main.education.map((e) => ({ key: e.level, label: e.level, value: e.pct, text: `${e.pct}%` }))}
                  />
                </div>
              ) : null}{" "}
              {main.titles.length ? (
                <div>
                  <h3 className="font-heading text-lg font-bold">Titles people use for it</h3>{" "}
                  <p className="mt-2 text-base leading-relaxed text-soft">{main.titles.join(", ")}.</p>
                </div>
              ) : null}
            </div>
          </div>
          {onet && onet.occupations.length > 1 ? (
            <p className="mt-6 max-w-3xl text-base text-muted-foreground">
              O*NET also describes{" "}
              {onet.occupations.slice(1).map((o, i, a) => `${o.title}${i < a.length - 2 ? ", " : i === a.length - 2 ? " and " : ""}`)}{" "}
              under this SOC code.
            </p>
          ) : null}
          {main.related.length ? (
            <p className="mt-4 max-w-3xl text-base">
              <span className="font-bold">Related jobs: </span>
              {main.related.map((r, i) => {
                const slug = related.get(socGroup(r.code) ?? "");
                return (
                  <span key={r.code}>
                    {slug ? (
                      <Link href={entityHref("occupation", slug)} className="link">
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
          <OnetCredit className="mt-6" version={onet?.version} note="the shares are rounded and only the top tasks are shown" />
        </section>
      ) : null}
    </>
  );
}
