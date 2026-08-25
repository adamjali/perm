/**
 * PERM filings by law firm.
 *
 * DOL prints the filing firm on every case and nobody surfaces it for the
 * people it describes. For an attorney this is the only public benchmark of
 * their own practice against the field; for a beneficiary it is a way to see
 * whether the firm handling their case has done this before.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { EntityExplorer } from "@/components/tools/EntityExplorer";
import { fetchEntitySeed } from "@/lib/entitySeed";

const TITLE = "Every PERM Law Firm, Ranked";
const DESCRIPTION =
  "Every law firm filing PERM cases: volume, approval rate and median processing days per firm, searchable and sortable, from DOL's own disclosure files.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-attorneys" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-attorneys",
  },
};

export const revalidate = 3600;

function fmtInt(n: number): string {
  return n.toLocaleString("en-US");
}

export default async function PermAttorneysPage() {
  const { rows: attorneys, total: firmCount } = await fetchEntitySeed("attorney");

  const topTen = attorneys.slice(0, 10);
  const maxTotal = Math.max(1, ...topTen.map((a) => a.total));

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "PERM labor certification filings by law firm",
    description: DESCRIPTION,
    url: "https://permtracker.app/perm-attorneys",
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
    license: "https://permtracker.app/terms",
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="attorneys" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
          As printed in DOL&apos;s files
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Who files the most PERM cases
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          Every PERM filing names the firm that made it. All
          {" "}{firmCount.toLocaleString("en-US")} of them are here, with what
          each one&apos;s cases did.
        </p>
      </header>

      {attorneys.length > 0 ? (
        <>
          <section className="pop mt-10">
            <div className="border-2 border-border bg-card p-6 sm:p-8">
              <h2 className="font-heading text-xl font-black">The ten busiest firms</h2>
              <div className="mt-6 space-y-3">
                {topTen.map((a) => (
                  <div key={a.name} className="grid grid-cols-[minmax(0,240px)_1fr] items-center gap-3">
                    <p className="truncate text-sm font-bold" title={a.name}>
                      {a.name}
                    </p>
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        aria-hidden="true"
                        className="h-6 shrink-0 border-2 border-border bg-primary"
                        style={{
                          width: `${Math.max(4, (a.total / maxTotal) * 100)}%`,
                          maxWidth: "calc(100% - 64px)",
                        }}
                      />
                      <span className="whitespace-nowrap font-mono text-xs font-bold tabular-nums">
                        {fmtInt(a.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm text-foreground/60">
                Volume, not quality. Approval rates cluster above 99% across
                every firm on this list, so the number that separates them is
                the work you can’t see in a spreadsheet.
              </p>
            </div>
          </section>

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black">
              All {firmCount.toLocaleString("en-US")} firms
            </h2>{" "}
            <p className="mt-2 max-w-2xl text-base text-foreground/70">
              Spellings of one firm are pooled, so a practice DOL prints six
              ways counts once. Filter by the state the firm files from.
            </p>
            <div className="mt-6">
              <EntityExplorer kind="attorney" rows={attorneys} total={firmCount} />
            </div>
          </section>
        </>
      ) : (
        <section className="mt-10 border-2 border-border bg-card p-8 text-center shadow-hard">
          <p className="text-lg text-foreground/70">
            The firm aggregates land with the quarterly disclosure ingest.
            Until then, the{" "}
            <Link href="/perm-processing-times" className="underline decoration-primary decoration-2 underline-offset-2">
              processing times page
            </Link>{" "}
            carries the live queue.
          </p>
        </section>
      )}

      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-2 border-border bg-foreground p-6 text-background shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Running a PERM practice?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-background/70">
            Benchmark your own volume and median against the field here, then
            let the tracker carry the deadlines on every case.{" "}
            <Link href="/signup" className="font-bold underline decoration-primary decoration-2 underline-offset-2">
              Free account
            </Link>
            .
          </p>
        </div>
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Checking on your firm?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            A firm&apos;s median sits near the national one because DOL works a
            single queue. Your own date comes from your filing month, on the{" "}
            <Link href="/tools/perm-timeline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision estimator
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
