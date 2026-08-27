/**
 * PERM wages by occupation.
 *
 * Every occupation in the current disclosure window with its median offered
 * wage, volume, approval rate and median days: the numbers a beneficiary
 * compares an offer against and an attorney benchmarks a prevailing wage
 * strategy against. All from DOL's own files; nothing modeled, nothing
 * invented.
 *
 * The page leads with a DISTRIBUTION rather than a ranking. A table of
 * medians was here first and it hid the most striking thing in the data:
 * ordered by filing volume, the busiest occupations alternate between two pay
 * scales whose distributions do not touch at any percentile. That is visible
 * in one drawing and invisible in a column of medians.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { EntityExplorer } from "@/components/tools/EntityExplorer";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { fetchEntitySeed } from "@/lib/entitySeed";
import { getDisclosureStats } from "@/lib/turso/publicData";
import {
  getVolumeLadders,
  getWageBandRates,
  getWageBandRatesByYear,
} from "@/lib/turso/wages";
import { TwoMarketsNote } from "@/components/wages/LadderComb";
import { LadderCombViews } from "@/components/wages/LadderViews";
import { DenialByWageBand } from "@/components/wages/DenialByWageBand";

import { DataProvenance } from "@/components/data/DataProvenance";
const TITLE = "PERM Salaries by Occupation";
const DESCRIPTION =
  "What PERM cases pay: the full wage ladder by occupation, with volume and approval rates, from DOL's own disclosure files.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-wages" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-wages",
  },
};

// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

function fmtWage(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export default async function PermWagesPage() {
  const [stats, seed, ladders, bandsByYear, bandsPooled] = await Promise.all([
    getDisclosureStats(),
    fetchEntitySeed("occupation"),
    getVolumeLadders(12),
    getWageBandRatesByYear(),
    getWageBandRates(),
  ]);
  const { rows: occupations, total: occupationCount } = seed;
  const ladder = stats?.wageLadder ?? null;

  const withWages = occupations.filter((o) => o.medianAnnualWage != null);
  const overallMedian = (() => {
    if (withWages.length === 0) return null;
    const sorted = withWages
      .map((o) => o.medianAnnualWage as number)
      .sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? null;
  })();

  // The comb links each row to that occupation's own page. The slug lives on
  // the entity seed, and the ladder carries the SOC code, so they are joined
  // here rather than in the query: perm_wage_stats has no slug column and
  // computing one in a second place is how a detail page 404s from its index.
  const slugByCode = new Map(
    occupations.filter((o) => o.code).map((o) => [o.code as string, o.slug]),
  );

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "PERM offered wages by occupation",
    description: DESCRIPTION,
    url: "https://permtracker.app/perm-wages",
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
    license: "https://permtracker.app/terms",
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="wages" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          From DOL&apos;s own disclosure files
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          What PERM cases pay
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          The wage on a PERM filing is the wage the employer committed to in a
          federal filing. Here is the whole distribution behind it, by
          occupation, by state and by year.
        </p>
      </header>

      {occupations.length > 0 ? (
        <>
          {ladder ? (
            <section className="mt-10 border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
              <h2 className="font-heading text-2xl font-black">
                The whole wage ladder
              </h2>{" "}
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-background/70">
                Every certified case in the window with a readable wage, sorted
                and cut at five points.
              </p>
              <dl className="mt-6 grid [&>*]:min-w-0 grid-cols-2 gap-4 sm:grid-cols-5">
                {[
                  { k: "10th", v: ladder.p10 },
                  { k: "25th", v: ladder.p25 },
                  { k: "Median", v: ladder.p50 },
                  { k: "75th", v: ladder.p75 },
                  { k: "90th", v: ladder.p90 },
                ].map((d) => (
                  <div key={d.k} className={d.k === "Median" ? "border-2 border-primary bg-primary/15 p-3" : "p-3"}>
                    <dt className="font-mono text-xs font-bold uppercase tracking-wider text-background/60">
                      {d.k}
                    </dt>{" "}
                    <dd className="mt-1 font-heading text-xl font-black tabular-nums sm:text-2xl">
                      {d.v == null ? "—" : fmtWage(d.v)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-sm text-background/60">
                From {ladder.count.toLocaleString("en-US")} certified cases. The
                gap between the 25th and the median spans hourly roles at one end
                and salaried knowledge work at the other.
              </p>
            </section>
          ) : null}

          {ladders.length > 0 ? (
            <FigurePlate
              n="01"
              title="Two pay scales, one process"
              subject={`${ladders.length} busiest occupations, ordered by filing volume`}
              caption={
                <>
                  <TwoMarketsNote ladders={ladders} className="mb-3" />
                  Each row is one occupation&apos;s certified offers, sorted and
                  cut at seven points. The order is filing volume, not pay:
                  ranked by wage these rows would climb steadily, and the thing
                  worth seeing is that the busiest occupations alternate between
                  two scales instead. Hourly and other wage units are annualized
                  before the percentiles are taken.
                </>
              }
              source="DOL PERM disclosure files, certified cases only"
              className="mt-10"
            >
              <LadderCombViews
                label="Wage ladder by occupation"
                subjectLabel="Occupation"
                ladders={ladders}
                href={(l) => {
                  const slug = slugByCode.get(l.key);
                  return slug ? `/perm-wages/${slug}` : null;
                }}
              />
            </FigurePlate>
          ) : null}

          {bandsPooled.length > 0 ? (
            <FigurePlate
              n="02"
              title="Denial rate by wage band"
              subject="Certified and denied cases, by fiscal year"
              caption="Rates are measured, not modelled, and each band carries the number of decided cases behind it. A wage is one attribute of a filing among many, and nothing here says what a particular wage does to a particular case."
              source="DOL PERM disclosure files"
              className="mt-10"
            >
              <DenialByWageBand byYear={bandsByYear} pooled={bandsPooled} />
            </FigurePlate>
          ) : null}

          {overallMedian != null ? (
            <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <p className="font-heading text-4xl font-black tabular-nums sm:text-5xl">
                  {fmtWage(overallMedian)}
                </p>{" "}
                <p className="max-w-md text-base leading-relaxed text-foreground/70">
                  Median of the occupation medians, across all{" "}
                  {occupationCount.toLocaleString("en-US")} occupations. It sits
                  well below the median case, because most occupations are small
                  and the largest ones are the best paid.
                </p>
              </div>
            </section>
          ) : null}

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black">
              All {occupationCount.toLocaleString("en-US")} occupations
            </h2>{" "}
            <p className="mt-2 max-w-2xl text-base text-foreground/70">
              Search by title or SOC code, filter by job family, sort any column,
              or download the CSV.
            </p>
            <div className="mt-6">
              <EntityExplorer kind="occupation" rows={occupations} total={occupationCount} />
            </div>
          </section>
        </>
      ) : (
        <section className="mt-10 border-2 border-border bg-card p-8 text-center shadow-hard">
          <p className="text-lg text-foreground/70">
            The occupation aggregates land with the quarterly disclosure
            ingest. Until then, the{" "}
            <Link href="/perm-processing-times" className="underline decoration-primary decoration-2 underline-offset-2">
              processing times page
            </Link>{" "}
            carries the live queue.
          </p>
        </section>
      )}

      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Comparing an offer?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            The{" "}
            <Link href="/tools/salary-explorer" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              salary explorer
            </Link>{" "}
            recomputes the ladder over any occupation, state and year, and shows
            the same occupation state by state.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Wondering about pace?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            A case&apos;s speed depends on its filing month rather than its
            wage. The{" "}
            <Link href="/perm-decision-activity" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision activity
            </Link>{" "}
            page carries how much DOL clears each day, and the{" "}
            <Link href="/methodology" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              methodology
            </Link>{" "}
            says how every figure is computed.
          </p>
        </div>
      </section>
      <DataProvenance datasets={["perm-cases", "entities"]} />
    </div>
  );
}
