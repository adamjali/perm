/**
 * PERM filings by employer.
 *
 * Every sponsor in the current disclosure window, ranked by volume, with
 * certifications, approval rate and median days. A beneficiary
 * checks their own employer's track record; an attorney benchmarks a client
 * against the field. Names appear exactly as DOL prints them.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { EntityExplorer } from "@/components/tools/EntityExplorer";
import { fetchEntitySeed } from "@/lib/entitySeed";

import { DataProvenance } from "@/components/data/DataProvenance";
const TITLE = "Every PERM Employer, Ranked";
const DESCRIPTION =
  "Every company that filed a PERM case: volume, approval rate and median days per sponsor, searchable and sortable, from DOL's own disclosure files.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-employers" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-employers",
  },
};

// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
export const revalidate = 86400;

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function PermEmployersPage() {
  // Seeded from the entity TABLE, not the aggregate document. The aggregate
  // is capped at 250 rows per kind to fit Convex's 1 MB document limit, so
  // a page built on it could only ever show 250 of 12,240 sponsors.
  const { rows: employers, total: employerCount } = await fetchEntitySeed("employer");

  const topTen = employers.slice(0, 10);
  const maxTotal = Math.max(1, ...topTen.map((e) => e.total));

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "PERM labor certification filings by employer",
    description: DESCRIPTION,
    url: "https://permtracker.app/perm-employers",
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
    license: "https://permtracker.app/terms",
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="employers" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          As printed in DOL&apos;s files
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Who sponsors the most
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          Every employer that filed a PERM case in the current disclosure
          window, all {employerCount.toLocaleString("en-US")} of them.
          Search yours, filter by state, sort any column.
        </p>
      </header>

      {employers.length > 0 ? (
        <>
          {/* The drawing first: the top ten as a volume ladder. */}
          <section className="pop mt-10">
            <div className="border-2 border-border bg-card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-black">The top ten, by filings</h2>
              <div className="mt-6 space-y-3">
                {topTen.map((e) => (
                  <div key={e.name} className="grid grid-cols-[minmax(0,220px)_1fr] items-center gap-3">
                    <p className="truncate text-sm font-bold" title={e.name}>
                      {e.name}
                    </p>
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        aria-hidden="true"
                        className="h-6 shrink-0 border-2 border-border bg-primary"
                        style={{
                          width: `${Math.max(4, (e.total / maxTotal) * 100)}%`,
                          maxWidth: "calc(100% - 64px)",
                        }}
                      />
                      <span className="whitespace-nowrap font-mono text-xs font-bold tabular-nums">
                        {fmtInt(e.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm text-foreground/60">
                DOL works one national queue, oldest first, whoever filed the
                case.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black">
              All {employerCount.toLocaleString("en-US")} sponsors
            </h2>{" "}
            <p className="mt-2 max-w-2xl text-base text-foreground/70">
              DOL prints legal entity names, so a company you know by one name
              may appear under several.
            </p>
            <div className="mt-6">
              <EntityExplorer kind="employer" rows={employers} total={employerCount} />
            </div>
          </section>
        </>
      ) : (
        <section className="mt-10 border-2 border-border bg-card p-8 text-center shadow-hard">
          <p className="text-lg text-foreground/70">
            The employer aggregates land with the quarterly disclosure ingest.
            Until then, the{" "}
            <Link href="/perm-processing-times" className="underline decoration-primary decoration-2 underline-offset-2">
              processing times page
            </Link>{" "}
            carries the live queue.
          </p>
        </section>
      )}

      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Your employer is on the list?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Their volume doesn’t change your place in line. The{" "}
            <Link href="/tools/perm-timeline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision estimator
            </Link>{" "}
            takes your filing month.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Managing a docket?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Wages by occupation sit on the{" "}
            <Link href="/perm-wages" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              wages page
            </Link>
            , volume by state on the{" "}
            <Link href="/perm-by-state" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              map
            </Link>
            , and every figure&apos;s recipe in the{" "}
            <Link href="/methodology" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              methodology
            </Link>
            .
          </p>
        </div>
      </section>
      <DataProvenance datasets={["perm-cases", "entities"]} />
    </div>
  );
}
