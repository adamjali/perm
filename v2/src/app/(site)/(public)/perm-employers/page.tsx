/**
 * PERM filings by employer.
 *
 * Every sponsor in the current disclosure window, ranked by volume, with
 * certifications, approval rate and median days. A beneficiary
 * checks their own employer's track record; an attorney benchmarks a client
 * against the field. Names appear exactly as DOL prints them.
 */

import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import Link from "next/link";

import { getDatasetSchema } from "@/lib/structuredData";
import { ChartTips } from "@/components/data/ChartTips";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { EntityExplorer } from "@/components/tools/EntityExplorer";
import { fetchEntitySeed } from "@/lib/entitySeed";
import { BrowseTeaser } from "@/components/entities/BrowseBody";
import { PendingLeaderboard } from "@/components/entities/PendingLeaderboard";
import { WaitLeaders } from "@/components/entities/WaitLeaders";
import { getFieldWait } from "@/lib/turso/employerWait";
import { pendingLeaders } from "@/lib/turso/entityDetail";
import { getFreshness } from "@/lib/turso/publicData";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { PageBasics } from "@/components/data/PageBasics";
import { IndexHeader, IndexSearch, type IndexFigure } from "@/components/data/IndexHeader";
import { Chapter } from "@/components/entities/Chapter";
import { ChapterNav, type ChapterItem } from "@/components/entities/Chapters";
import { formatInt } from "@/lib/format";
import { SITE_URL } from "@/lib/constants/site";
const TITLE = "Every PERM Employer, Ranked";
const DESCRIPTION =
  "Every company that filed a PERM case: volume, approval rate and median days per sponsor, searchable and sortable, from DOL's own disclosure files.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-employers" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-employers",
  },
}, "perm-employers");

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

export default async function PermEmployersPage() {
  // Seeded from the entity TABLE, not the aggregate document. The aggregate
  // is capped at 250 rows per kind to fit Convex's 1 MB document limit, so
  // a page built on it could only ever show 250 of 12,240 sponsors.
  const [{ rows: employers, total: employerCount }, leaders, freshness, fieldWait] =
    await Promise.all([
      fetchEntitySeed("employer"),
      pendingLeaders(10),
      getFreshness(),
      getFieldWait().catch(() => null),
    ]);
  const mirrorAsOf = freshness["perm-case-status"]?.asOf ?? null;

  const topTen = employers.slice(0, 10);
  const maxTotal = Math.max(1, ...topTen.map((e) => e.total));

  const datasetSchema = getDatasetSchema(SITE_URL, {
    name: "PERM labor certification filings by employer",
    description: DESCRIPTION,
    url: `${SITE_URL}/perm-employers`,
  });

  const busiest = topTen[0];
  const mostWaiting = leaders[0];
  const figures: IndexFigure[] = [
    { label: "Sponsors in DOL's published files", value: formatInt(employerCount), note: "Each with its own page" },
    ...(busiest
      ? [{ label: "Files the most", value: busiest.name, href: `/perm-employers/${busiest.slug}`, note: `${formatInt(busiest.total)} filings` }]
      : []),
    ...(mostWaiting
      ? [{ label: "Most cases waiting now", value: mostWaiting.name, href: `/perm-employers/${mostWaiting.slug}`, note: `${formatInt(mostWaiting.pending)} waiting on DOL` }]
      : []),
  ];
  const chapters: ChapterItem[] = [
    { id: "busiest", label: "Busiest" },
    { id: "speed", label: "Fastest and slowest" },
    { id: "all", label: "Every sponsor" },
    { id: "a-z", label: "A to Z" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <JsonLdScript schema={datasetSchema} />

      <IndexHeader
        title="Who sponsors the most"
        lede={
          <>
            Every employer that filed a PERM case in DOL&apos;s current disclosure window, ranked, with what
            each has waiting today.
          </>
        }
        figures={figures}
        aside={
          <IndexSearch
            title="Find an employer"
            action="/perm-employers#all"
            placeholder="Microsoft, Infosys, a hospital"
            note="Searches every sponsor, including ones whose cases DOL hasn't published yet."
            footer={
              <>
                Have a case number?{" "}
                <Link href="/perm-case-status" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                  Look the case up
                </Link>
              </>
            }
          />
        }
      />

      {employers.length > 0 ? (
        <>
          <ChapterNav items={chapters} className="mt-10" />

          <Chapter
            id="busiest"
            title="The busiest sponsors"
            dek="By everything filed in the published window, and by what's sitting in DOL's queue today. Two different lists, on purpose."
          >
          <div className="grid grid-cols-1 gap-6 [&>*]:min-w-0 xl:grid-cols-2">
          {/* The drawing first: the top ten as a volume ladder. */}
          <section className="h-full">
            <div className="flex h-full flex-col border border-border bg-card p-6 sm:p-8">
              <h3 className="font-heading text-xl font-bold">The top ten, by filings</h3>
              <ChartTips label="The top ten sponsors, by filings" className="mt-6">
              {/* Each name opens its employer page: visitors clicked the plain
                  names over and over expecting it (PostHog, Oct 2026). */}
              <div className="space-y-1">
                {topTen.map((e) => (
                  <div
                    key={e.name}
                    data-tip={[
                      e.name,
                      `#${e.rank} by filings`,
                      `${formatInt(e.total)} filings`,
                      `${formatInt(e.certified)} certified, ${formatInt(e.denied)} denied`,
                      e.medianDays !== null ? `Median ${formatInt(e.medianDays)} days to a decision` : null,
                      e.recent12m !== null ? `${formatInt(e.recent12m)} filed in the last 12 months` : null,
                    ]
                      .filter(Boolean)
                      .join("\n")}
                    className="grid grid-cols-[minmax(0,220px)_1fr] items-center gap-3">
                    <Link
                      href={`/perm-employers/${e.slug}`}
                      className="flex min-h-[44px] min-w-0 items-center text-sm font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                    >
                      <span className="truncate">{e.name}</span>
                    </Link>
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        aria-hidden="true"
                        className="h-6 shrink-0 border border-border bg-primary"
                        style={{
                          width: `${Math.max(4, (e.total / maxTotal) * 100)}%`,
                          maxWidth: "calc(100% - 64px)",
                        }}
                      />
                      <span className="whitespace-nowrap font-mono text-sm font-bold tabular-nums">
                        {formatInt(e.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              </ChartTips>
              <p className="mt-auto pt-5 text-sm text-muted-foreground">
                DOL works one national queue, oldest first, whoever filed the
                case.
              </p>
            </div>
          </section>

          <PendingLeaderboard leaders={leaders} asOf={mirrorAsOf} n="01" />
          </div>
          </Chapter>

          <Chapter id="speed" title="Whose cases DOL decides fastest, and slowest">
            <WaitLeaders field={fieldWait} />
          </Chapter>

          <section id="all" className="mt-16 border-t-2 border-border pt-8">
            {/* "All N sponsors" was true of the published files and reads as
                a claim about every sponsor that exists. It is now actively
                misleading on this page: searching here also surfaces employers
                we hold only from DOL's live feed, 21,495 of which have never
                appeared in a disclosure file. The heading says which corpus the
                TABLE is, and the sentence under it says where the rest are. */}
            <h2 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
              All {employerCount.toLocaleString("en-US")} sponsors in the
              published files
            </h2>{" "}
            {/* The consequence stays visible because it changes how a row is
                read: one company can hold several of them. The pooling
                mechanics are provenance, so they collapse. */}
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
              A group filing through several subsidiaries appears as several
              rows.
            </p>{" "}
            <FinePrint summary="How sponsors are counted" className="mt-2">
              <p>
                DOL prints the legal entity name typed on the form. Spellings
                that differ only by punctuation or a company suffix are counted
                as one sponsor here.
              </p>
            </FinePrint>
            <div className="mt-6">
              <EntityExplorer kind="employer" rows={employers} total={employerCount} />
            </div>
          </section>

          {/* The table above is a client component: its rows are fetched and
              filtered in the browser, so a crawler sees the 54 server-rendered
              seed links and none of the other 16,255 pages. The A-Z strip is
              the crawlable path to all of them. */}
          {/* The teaser carries its own heading ("Browse A to Z"), so this is the
              part's rule and anchor only. */}
          <div id="a-z" className="mt-16 border-t-2 border-border pt-8">
            <BrowseTeaser kind="employer" />
          </div>
        </>
      ) : (
        <section className="mt-10 border border-border bg-card p-8 text-center">
          <p className="text-lg text-muted-foreground">
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
        <div className="border border-border bg-tint-primary p-6">
          <h2 className="font-heading text-lg font-bold">Your employer is on the list?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Their volume doesn’t change your place in line. The{" "}
            <Link href="/tools/perm-timeline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision estimator
            </Link>{" "}
            takes your filing month.
          </p>
        </div>
        <div className="border border-border bg-card p-6">
          <h2 className="font-heading text-lg font-bold">Managing a docket?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <Link href="/perm-wages" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              Wages by occupation
            </Link>
            ,{" "}
            <Link href="/perm-by-state" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              volume by state
            </Link>
            , and every figure&apos;s recipe in the{" "}
            <Link href="/methodology" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              methodology
            </Link>
            .
          </p>
        </div>
      </section>
      <PageBasics page="perm-employers" />{" "}
      <DataProvenance datasets={["perm-cases", "entities", "perm-case-status"]} />
    </div>
  );
}
