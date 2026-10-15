/**
 * Every PERM case DOL has published a decision for.
 *
 * The aggregate pages answer "how is the queue doing". This one answers "what
 * happened to cases like mine", which is a different question and the one
 * people actually arrive with.
 *
 * The coverage statement is not decoration. DOL's disclosure files contain no
 * pending rows at all, so a search that finds nothing is the ordinary result
 * for anyone still waiting, and a page that does not say so turns its most
 * common outcome into bad news about someone's petition.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getDatasetSchema } from "@/lib/structuredData";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { FinePrint } from "@/components/data/FinePrint";
import { openGraphBase } from "@/lib/openGraphBase";
import { CaseBrowser, type OccupationOption } from "@/components/tools/CaseBrowser";
import { LiveCaseBrowser } from "@/components/tools/LiveCaseBrowser";
import { getLiveRemainderSummary } from "@/lib/db/liveCases";
import { getMeta } from "@/lib/db/cases";
import { getDailyDecisions } from "@/lib/db/publicData";
import { DailyDecisionsChart } from "@/components/tools/DailyDecisionsChart";
import { listByKind } from "@/lib/db/entities";

import { DataProvenance } from "@/components/data/DataProvenance";
import { PageBasics } from "@/components/data/PageBasics";
import { IndexHeader, IndexLookup, type IndexFigure } from "@/components/data/IndexHeader";
import { Chapter } from "@/components/entities/Chapter";
import { ChapterNav, type ChapterItem } from "@/components/entities/Chapters";
import { withSocialCard } from "@/lib/socialCard";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { formatInt } from "@/lib/format";
import { SITE_URL } from "@/lib/constants/site";
const TITLE = "PERM Case Search";
const DESCRIPTION =
  "Search every PERM case in DOL's published disclosure window by case number, employer, law firm, state or occupation, with the wage and the days it took.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-cases" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-cases",
  },
}, "perm-cases");

// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence, and the ingests expire it on demand when its data moves
// (the /api/revalidate-* routes).
// QUARTERLY DATA, WEEKLY WINDOW, AND A TRIGGER. This reads DOL's quarterly
// disclosure files, which change four times a year; a one-day window meant
// ~364 expiries a year to express four real changes, and every expiry a
// visitor walks into is a paid ISR render of an identical page.
// `POST /api/revalidate-disclosure` expires this the moment a file lands, so
// the long window costs no freshness. It stays a WEEK rather than a month so a
// trigger that never fires bounds the staleness instead of stranding the page.
export const revalidate = 604800;

/** `2026-06-30` to `June 2026`. */
function monthYear(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", timeZone: "UTC" });
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

  const datasetSchema = getDatasetSchema(SITE_URL, {
    name: "PERM labor certification case decisions",
    description: DESCRIPTION,
    url: `${SITE_URL}/perm-cases`,
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

  const figures: IndexFigure[] = [
    ...(meta
      ? [{ label: "Decided, in DOL's published files", value: formatInt(meta.totalCases), note: `${monthYear(meta.firstDecisionDate)} to ${monthYear(meta.lastDecisionDate)}` }]
      : []),
    ...(liveSummary
      ? [{ label: "Newer, from DOL's live service", value: formatInt(liveSummary.total), href: "#live", note: `${formatInt(liveSummary.pending)} still waiting` }]
      : []),
    { label: "Not only PERM", value: "Search every program", href: "/case-search", note: "Wage requests, H-1B, H-2A and H-2B too" },
  ];
  const chapters: ChapterItem[] = [
    { id: "by-day", label: "Decisions" },
    { id: "decided", label: "Decided cases" },
    { id: "live", label: "Newer cases, live" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <JsonLdScript schema={datasetSchema} />

      <IndexHeader
        title="Every PERM case, decided and waiting"
        lede={
          <>
            DOL&apos;s published decisions, with the wage and the days each took, and every newer case from
            DOL&apos;s own case-status service, still waiting or not.
          </>
        }
        figures={figures}
        aside={
          <IndexLookup
            title="Have the number?"
            placeholder="G-100-26125-868956"
            note="DOL's status today, the published record once there is one, and an estimated date."
            source="perm-cases"
          />
        }
      />

      {meta ? (
        <>
          <ChapterNav items={chapters} className="mt-10" />

          {/* THE CHART SITS OUTSIDE THE SEARCH-PARAMS BOUNDARY, and that is the
              point: it takes server-computed props and reads no search params,
              so outside the boundary it is in the HTML a crawler gets and paints
              before the JS lands. Inside, it would exist only in the escaped RSC
              payload. */}
          <Chapter id="by-day" title="How many cases DOL decides" dek="Every decision in DOL's published files, counted by month.">
            <DailyDecisionsChart points={daily} />
          </Chapter>

          <SearchParamsBoundary>
            <Chapter
              id="decided"
              title="Decided cases, from DOL's files"
              dek={
                <>
                  Each with its wage, law firm, worksite and the days it took. Cases still waiting aren&apos;t in
                  these files, however recently they were filed; they&apos;re in the{" "}
                  <Link href="#live" className="link">
                    live list
                  </Link>
                  .
                </>
              }
            >
              <FinePrint summary="Source files" className="-mt-2 mb-6">
                <p>
                  {meta.sourceFiles.join(", ") || "DOL PERM disclosure files"}. Counts cover every row in the files,
                  including the ones off screen. A filtered count covers only that filter.{" "}
                  <Link href="/methodology" className="link">
                    How every figure is built
                  </Link>
                  .
                </p>
              </FinePrint>{" "}
              <CaseBrowser meta={meta} occupations={occupations} showLookup={false} />
            </Chapter>

            {/* The live browser carries its own heading and the #live anchor; this
                is the part's rule. */}
            <div className="mt-16 border-t-4 border-border pt-8">
              <LiveCaseBrowser summary={liveSummary} publishedThrough={meta.lastDecisionDate} />
            </div>
          </SearchParamsBoundary>
        </>
      ) : (
        <section className="mt-10 bg-tint p-8 text-center border-2 shadow-hard border-border">
          <p className="text-lg text-muted-foreground">
            The case-level table is written by the quarterly disclosure ingest. Until it has run, the{" "}
            <Link href="/perm-processing-times" className="link">
              processing times page
            </Link>{" "}
            carries the live queue and the{" "}
            <Link href="/perm-employers" className="link">
              sponsor table
            </Link>{" "}
            carries the per-employer totals.
          </p>
        </section>
      )}

      <section className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div >
          <h2 className="font-heading text-lg font-bold">Waiting on a case?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Its number gives DOL&apos;s status today and an estimated date. With only a filing month, the{" "}
            <Link href="/tools/perm-timeline-calculator" className="link">
              decision estimator
            </Link>{" "}
            reads it against where DOL is working now.
          </p>
        </div>
        <div className="bg-tint p-6 border-2 shadow-hard-sm border-border">
          <h2 className="font-heading text-lg font-bold">Comparing a whole docket?</h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Per-firm and per-sponsor totals sit on the{" "}
            <Link href="/perm-attorneys" className="link">
              law firm table
            </Link>{" "}
            and the{" "}
            <Link href="/perm-employers" className="link">
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
