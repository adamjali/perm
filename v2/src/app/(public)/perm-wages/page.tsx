/**
 * PERM wages by occupation.
 *
 * The top occupations in the current disclosure window with their median
 * offered wage, volume, approval rate and median days — the numbers a
 * beneficiary compares an offer against and an attorney benchmarks a
 * prevailing wage strategy against. All from DOL's own files; nothing
 * modeled, nothing invented.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../convex/_generated/api";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { WagesExplorer } from "./WagesExplorer";

const TITLE = "PERM Salaries by Occupation";
const DESCRIPTION =
  "What PERM cases actually pay: median offered wages, filing volume, approval rates and processing days for the top occupations, from DOL's own disclosure files.";

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

export const revalidate = 3600;

function fmtWage(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export default async function PermWagesPage() {
  const stats = await fetchQuery(api.permDisclosure.getLatest, {}).catch(() => null);
  const occupations = stats?.topOccupations ?? [];

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
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="wages" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
          Offered wages, not survey estimates
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          What PERM cases pay
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          The wage on a PERM filing is the wage the employer committed to in a
          federal filing — harder currency than any salary survey. These are
          the medians by occupation for the current disclosure window.
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
                    <div key={o.code} className="grid grid-cols-[minmax(0,220px)_1fr] items-center gap-3">
                      <p className="truncate text-sm font-bold" title={o.title}>
                        {o.title}
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

          {overallMedian != null ? (
            <section className="mt-10 border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <p className="font-heading text-4xl font-black tabular-nums sm:text-5xl">
                  {fmtWage(overallMedian)}
                </p>{" "}
                <p className="max-w-md text-base leading-relaxed text-background/70">
                  Median of the occupation medians below — the centre of what a
                  sponsored role pays across the top {occupations.length}{" "}
                  occupations.
                </p>
              </div>
            </section>
          ) : null}

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black">Every occupation</h2>{" "}
            <p className="mt-2 max-w-2xl text-base text-foreground/70">
              Search by title or SOC code. Sort any column.
            </p>
            <div className="mt-6">
              <WagesExplorer occupations={occupations} />
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
            Your own case&apos;s pace depends on its filing month, not its
            wage. The{" "}
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
            says exactly how every figure is computed.
          </p>
        </div>
      </section>
    </div>
  );
}
