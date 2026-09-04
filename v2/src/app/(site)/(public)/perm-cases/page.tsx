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
import { getDatasetSchema } from "@/lib/structuredData";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FinePrint } from "@/components/data/FinePrint";
import { openGraphBase } from "@/lib/openGraphBase";
import { CaseBrowser, type OccupationOption } from "@/components/tools/CaseBrowser";
import { LiveCaseBrowser } from "@/components/tools/LiveCaseBrowser";
import { getLiveRemainderSummary } from "@/lib/turso/liveCases";
import { getMeta } from "@/lib/turso/cases";
import { getDailyDecisions } from "@/lib/turso/publicData";
import { DailyDecisionsChart } from "@/components/tools/DailyDecisionsChart";
import { listByKind } from "@/lib/turso/entities";

import { DataProvenance } from "@/components/data/DataProvenance";
import { PageBasics } from "@/components/data/PageBasics";
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
// QUARTERLY DATA, WEEKLY WINDOW, AND A TRIGGER. This reads DOL's quarterly
// disclosure files, which change four times a year; a one-day window meant
// ~364 expiries a year to express four real changes, and every expiry a
// visitor walks into is a paid ISR render of an identical page.
// `POST /api/revalidate-disclosure` expires this the moment a file lands, so
// the long window costs no freshness. It stays a WEEK rather than a month so a
// trigger that never fires bounds the staleness instead of stranding the page.
export const revalidate = 604800;

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
  const [meta, occupationRows, daily, liveSummary] = await Promise.all([
    getMeta(),
    listByKind("occupation", 60),
    getDailyDecisions(),
    // The live half's counts, precomputed nightly. Null before the first
    // build writes the doc, or when it is more than eight days old; the
    // section below still renders and says less.
    getLiveRemainderSummary(),
  ]);

  // The dropdown wants the busiest occupations, and `listByKind` already
  // returns them in rank order. `code` is optional on the entity row because
  // employers and law firms have none, so an occupation without one cannot be
  // sliced by and is dropped rather than rendered as a dead option.
  const occupations: OccupationOption[] = occupationRows.flatMap((row) =>
    row.code ? [{ code: row.code, name: row.name, total: row.total }] : [],
  );

  const datasetSchema = getDatasetSchema("https://permtracker.app", {
    name: "PERM labor certification case decisions",
    description: DESCRIPTION,
    url: "https://permtracker.app/perm-cases",
    // Measured from the corpus rather than written down, and omitted entirely
    // when the meta read comes back empty. This page had the honest version of
    // temporalCoverage before the builder existed; it keeps it.
    ...(meta
      ? {
          temporalCoverage: `${meta.firstDecisionDate}/${meta.lastDecisionDate}`,
          variableMeasured: ["PERM labor certification determinations"],
        }
      : {}),
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          From DOL&apos;s own disclosure files
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Every decided case
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {meta ? (
            <>
              {fmtInt(meta.totalCases)} PERM cases decided between{" "}
              {longDate(meta.firstDecisionDate)} and{" "}
              {longDate(meta.lastDecisionDate)}, filed as far back as{" "}
              {longDate(meta.firstReceivedDate)}. Anything newer than{" "}
              {longDate(meta.lastDecisionDate)} isn&apos;t in DOL&apos;s
              published files yet. Those cases, decided and still waiting, are
              in the{" "}
              <Link
                href="#live"
                className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                live list
              </Link>{" "}
              below.
            </>
          ) : (
            <>
              The case table lands with the quarterly disclosure ingest.
            </>
          )}
        </p>{" "}
        {/* This page is PERM's published half. Somebody who does not know a
            wage request is a different DOL programme cannot know to leave, so
            the way out is named here rather than only in the nav. */}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Looking for everything one employer has filed, open cases included?{" "}
          <Link
            href="/case-search"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          >
            Search all three DOL programs at once
          </Link>
          .
        </p>
      </header>

      {/* The one thing a visitor has to read before searching. A pending case
          is in none of DOL's files, so "not found" is the ordinary answer for
          the people most likely to be searching. */}
      <section className="pop mt-8 max-w-3xl">
        <div className="border-2 border-border bg-tint-primary p-5 sm:p-6">
          <h2 className="font-heading text-lg font-black">What’s in here, and what isn’t</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            DOL publishes only cases it has decided. A case still waiting on a
            determination isn’t in these files, however recently it was filed.
          </p>{" "}
          {meta ? (
            /* The four .xlsx filenames were printed in full on the page, under a
               heading, above a link to the page that explains them. Provenance,
               so it collapses; `<details>` keeps every word crawlable. */
            <FinePrint summary="Source files" className="mt-3">
              <p>
              {meta.sourceFiles.join(", ") || "DOL PERM disclosure files"}.
              Counts cover every row in the files, including the ones off screen.
              A filtered count covers only that filter.{" "}
              <Link
                href="/methodology"
                className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                How every figure is built
              </Link>
              .
              </p>
            </FinePrint>
          ) : null}
        </div>
      </section>

      <div className="mt-10">
        {meta ? (
          // THE CHART SITS OUTSIDE THE BOUNDARY, and that is the point.
          //
          // `CaseBrowser` calls useSearchParams, which needs a Suspense
          // boundary or the whole route opts out of static rendering. But a
          // boundary emits its FALLBACK into the static shell, so everything
          // inside it is absent from the prerendered HTML and arrives only
          // after hydration. The chart was inside, so it existed on this page
          // only in the escaped RSC payload: measured on production 2026-09-03,
          // /perm-cases served zero <polyline>, zero <polygon> and no chart
          // aria-label, while the other two chart pages served theirs.
          //
          // It has no reason to be in there. It takes server-computed props and
          // reads no search params. Outside, it is in the HTML a crawler gets
          // and paints before the JS lands.
          <>
            <DailyDecisionsChart points={daily} className="mb-10" />
            <Suspense
              fallback={<p className="text-base text-foreground/60">Loading the case browser…</p>}
            >
            <CaseBrowser meta={meta} occupations={occupations} />

            <div className="mt-12">
              <LiveCaseBrowser
                summary={liveSummary}
                publishedThrough={meta.lastDecisionDate}
              />
            </div>
            </Suspense>
          </>
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
            A pending case is in none of DOL&apos;s files. The{" "}
            <Link
              href="/tools/perm-timeline-calculator"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              decision estimator
            </Link>{" "}
            reads your filing month against where DOL is working now.
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
      <PageBasics page="perm-cases" />{" "}
      <DataProvenance datasets={["perm-cases"]} />
    </div>
  );
}
