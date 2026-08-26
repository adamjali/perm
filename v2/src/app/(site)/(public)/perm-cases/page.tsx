/**
 * Every PERM case DOL has published a decision for.
 *
 * The aggregate pages answer "how is the queue doing". This one answers "what
 * happened to cases like mine", which is a different question and the one
 * people actually arrive with. It is also the one feature the rival product
 * had and this one did not, off the identical source file.
 *
 * The coverage statement is not decoration. DOL's disclosure files contain no
 * pending rows at all, so a search that finds nothing is the ordinary result
 * for anyone still waiting, and a page that does not say so turns its most
 * common outcome into bad news about someone's petition.
 */

import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { CaseBrowser, type OccupationOption } from "@/components/tools/CaseBrowser";
import { getMeta } from "@/lib/turso/cases";
import { listByKind } from "@/lib/turso/entities";

const TITLE = "PERM Case Search";
const DESCRIPTION =
  "Search every PERM case in DOL's published disclosure window by case number, employer, law firm, state or occupation, with the wage and the days it took.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-cases" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-cases",
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

/** `2026-06-30` to `30 June 2026`, in the reader's language rather than ISO. */
function longDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function PermCasesPage() {
  // Both bounded, and neither is caught. `meta` is legitimately null before
  // the first ingest writes a coverage document, and the page says so; a read
  // that FAILS is a different thing and throws, because an outage rendered as
  // an empty state is what let a disabled backend pass every status check.
  const [meta, occupationRows] = await Promise.all([
    getMeta(),
    listByKind("occupation", 60),
  ]);

  // The dropdown wants the busiest occupations, and `listByKind` already
  // returns them in rank order. `code` is optional on the entity row because
  // employers and law firms have none, so an occupation without one cannot be
  // sliced by and is dropped rather than rendered as a dead option.
  const occupations: OccupationOption[] = occupationRows.flatMap((row) =>
    row.code ? [{ code: row.code, name: row.name, total: row.total }] : [],
  );

  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "PERM labor certification case decisions",
    description: DESCRIPTION,
    url: "https://permtracker.app/perm-cases",
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
    license: "https://permtracker.app/terms",
    ...(meta
      ? {
          temporalCoverage: `${meta.firstDecisionDate}/${meta.lastDecisionDate}`,
          variableMeasured: "PERM labor certification determinations",
        }
      : {}),
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="employers" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          One row per decided case
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Every case, not just the totals
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {meta ? (
            <>
              {fmtInt(meta.totalCases)} PERM cases, every one of them decided
              between {longDate(meta.firstDecisionDate)} and{" "}
              {longDate(meta.lastDecisionDate)}. Filed as far back as{" "}
              {longDate(meta.firstReceivedDate)}.
            </>
          ) : (
            <>
              The case table lands with the quarterly disclosure ingest.
            </>
          )}
        </p>
      </header>

      {/* The one thing a visitor has to read before searching. A pending case
          is in none of DOL's files, so "not found" is the ordinary answer for
          the people most likely to be searching. */}
      <section className="pop mt-8 max-w-3xl">
        <div className="border-2 border-border bg-tint-primary p-5 sm:p-6">
          <h2 className="font-heading text-lg font-black">What’s in here, and what isn’t</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            DOL publishes cases it has already decided. There are no pending
            rows in these files at all, so a case still waiting on a
            determination won’t be here, however recently it was filed.
            Finding nothing says where your case isn’t, and nothing about how
            it’s going.
          </p>{" "}
          {meta ? (
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              Source: {meta.sourceFiles.join(", ") || "DOL PERM disclosure files"}.
              Counts on this page come from that data, not from the rows on
              screen, so a filtered count is a count of that filter and never
              of the whole file.{" "}
              <Link
                href="/methodology"
                className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                How every figure is built
              </Link>
              .
            </p>
          ) : null}
        </div>
      </section>

      <div className="mt-10">
        {meta ? (
          // useSearchParams needs a Suspense boundary, or the whole route opts
          // out of static rendering.
          <Suspense
            fallback={<p className="text-base text-foreground/60">Loading the case browser…</p>}
          >
            <CaseBrowser meta={meta} occupations={occupations} />
          </Suspense>
        ) : (
          <section className="border-2 border-border bg-card p-8 text-center shadow-hard">
            <p className="text-lg text-foreground/70">
              The case-level table is written by the quarterly disclosure
              ingest. Until it has run, the{" "}
              <Link
                href="/perm-processing-times"
                className="underline decoration-primary decoration-2 underline-offset-2"
              >
                processing times page
              </Link>{" "}
              carries the live queue and the{" "}
              <Link
                href="/perm-employers"
                className="underline decoration-primary decoration-2 underline-offset-2"
              >
                sponsor table
              </Link>{" "}
              carries the per-employer totals.
            </p>
          </section>
        )}
      </div>

      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Your case isn’t in here?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            That’s what a pending case looks like. The{" "}
            <Link
              href="/tools/perm-timeline-calculator"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              decision estimator
            </Link>{" "}
            takes your filing month and reads it against where DOL is actually
            working.
          </p>
        </div>
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Comparing a whole docket?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            Per-firm and per-sponsor totals sit on the{" "}
            <Link
              href="/perm-attorneys"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              law firm table
            </Link>{" "}
            and the{" "}
            <Link
              href="/perm-employers"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              sponsor table
            </Link>
            , and each one links straight back into these cases.
          </p>
        </div>
      </section>
    </div>
  );
}
