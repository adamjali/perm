/**
 * PERM wages by occupation.
 *
 * Every occupation in the current disclosure window with its median
 * offered wage, volume, approval rate and median days: the numbers a
 * beneficiary compares an offer against and an attorney benchmarks a
 * prevailing wage strategy against. All from DOL's own files; nothing
 * modeled, nothing invented.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { EntityExplorer } from "@/components/tools/EntityExplorer";
import { fetchEntitySeed } from "@/lib/entitySeed";
import { getDisclosureStats } from "@/lib/turso/publicData";

import { DataProvenance } from "@/components/data/DataProvenance";
const TITLE = "PERM Salaries by Occupation";
const DESCRIPTION =
  "What PERM cases actually pay: median offered wages by occupation, with volume and approval rates, from DOL's own disclosure files.";

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
  const stats = await getDisclosureStats();
  const { rows: occupations, total: occupationCount } = await fetchEntitySeed("occupation");
  const ladder = stats?.wageLadder ?? null;

  // The chart: the ten biggest occupations by volume, bar length = wage, so
  // the drawing answers "what do the big categories pay" in one look.
  const topTen = [...occupations].sort((a, b) => b.total - a.total).slice(0, 10);
  const maxWage = Math.max(1, ...topTen.map((o) => o.medianAnnualWage ?? 0));

  const withWages = occupations.filter((o) => o.medianAnnualWage != null);
  const overallMedian = (() => {
    if (withWages.length === 0) return null;
    const sorted = withWages
      .map((o) => o.medianAnnualWage as number)
      .sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? null;
  })();

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
          federal filing. These are the medians by occupation for the current
          disclosure window.
        </p>
      </header>

      {occupations.length > 0 ? (
        <>
          {/* The drawing first: the ten biggest occupations, paid what. */}
          <section className="pop mt-10">
            <div className="border-2 border-border bg-card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-black">
                The ten biggest occupations, and their median wage
              </h2>
              <div className="mt-6 space-y-3">
                {topTen.map((o) => {
                  const wage = o.medianAnnualWage;
                  const w = wage == null ? 0 : Math.max(6, (wage / maxWage) * 100);
                  return (
                    <div key={o.slug} className="grid grid-cols-[minmax(0,220px)_1fr] items-center gap-3">
                      <p className="truncate text-sm font-bold" title={o.name}>
                        {o.name}
                      </p>
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          aria-hidden="true"
                          className="h-6 shrink-0 border-2 border-border bg-primary"
                          style={{ width: `${w}%`, maxWidth: "calc(100% - 76px)" }}
                        />
                        <span className="whitespace-nowrap font-mono text-xs font-bold tabular-nums">
                          {wage == null ? "—" : fmtWage(wage)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-5 text-sm text-foreground/60">
                Bar length is the median offered annual wage; the list is
                ordered by filing volume. Hourly and other wage units are
                annualized before the median is taken.
              </p>
            </div>
          </section>

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

          {overallMedian != null ? (
            <section className="mt-10 border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <p className="font-heading text-4xl font-black tabular-nums sm:text-5xl">
                  {fmtWage(overallMedian)}
                </p>{" "}
                <p className="max-w-md text-base leading-relaxed text-background/70">
                  Median of the occupation medians, across all{" "}
                  {occupationCount.toLocaleString("en-US")} occupations.
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
            A case&apos;s pace depends on its filing month rather than its wage.
            The{" "}
            <Link href="/tools/perm-timeline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision estimator
            </Link>{" "}
            reads the live queue.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Setting a wage strategy?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Medians by state sit on the{" "}
            <Link href="/perm-by-state" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              state map
            </Link>
            , and the{" "}
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
