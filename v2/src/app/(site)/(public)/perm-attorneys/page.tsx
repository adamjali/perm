/**
 * PERM filings by law firm.
 *
 * DOL prints the filing firm on every case and nobody surfaces it for the
 * people it describes. For an attorney this is the only public benchmark of
 * their own practice against the field; for a beneficiary it is a way to see
 * whether the firm handling their case has done this before.
 */

import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import Link from "next/link";

import { getDatasetSchema } from "@/lib/structuredData";
import { ChartTips } from "@/components/data/ChartTips";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { EntityExplorer } from "@/components/tools/EntityExplorer";
import { BrowseTeaser } from "@/components/entities/BrowseBody";
import { fetchEntitySeed } from "@/lib/entitySeed";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FinePrint } from "@/components/data/FinePrint";
import { PageBasics } from "@/components/data/PageBasics";
import { IndexHeader, IndexSearch } from "@/components/data/IndexHeader";
import { Chapter } from "@/components/entities/Chapter";
import { ChapterNav, type ChapterItem } from "@/components/entities/Chapters";
import { formatInt } from "@/lib/format";
import { SITE_URL } from "@/lib/constants/site";
const TITLE = "PERM Law Firms by Cases and Approval Rate";
const DESCRIPTION =
  "Compare every immigration law firm filing PERM cases by cases filed, approval rate and processing time, from DOL's own disclosure data.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-attorneys" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-attorneys",
  },
}, "perm-attorneys");

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

export default async function PermAttorneysPage() {
  const { rows: attorneys, total: firmCount } = await fetchEntitySeed("attorney");

  const topTen = attorneys.slice(0, 10);
  const maxTotal = Math.max(1, ...topTen.map((a) => a.total));
  const topTenTotal = topTen.reduce((n, a) => n + a.total, 0);
  const leader = topTen[0] ?? null;
  const chapters: ChapterItem[] = [
    { id: "busiest", label: "Busiest" },
    { id: "all", label: `All ${formatInt(firmCount)}` },
    { id: "a-z", label: "A to Z" },
  ];

  const datasetSchema = getDatasetSchema(SITE_URL, {
    name: "PERM labor certification filings by law firm",
    description: DESCRIPTION,
    url: `${SITE_URL}/perm-attorneys`,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <JsonLdScript schema={datasetSchema} />

      <IndexHeader
        title="Who files the most PERM cases"
        lede="Every PERM filing names the firm that made it, so DOL's published files rank the whole field."
        figures={[
          { label: "Firms in DOL's files", value: formatInt(firmCount) },
          ...(leader
            ? [
                {
                  label: "Files the most",
                  value: leader.name,
                  ...(leader.slug ? { href: `/perm-attorneys/${leader.slug}` } : {}),
                  note: `${formatInt(leader.total)} filings`,
                },
              ]
            : []),
          ...(topTen.length === 10
            ? [{ label: "The ten busiest, together", value: formatInt(topTenTotal), note: "filings" }]
            : []),
        ]}
        aside={
          <IndexSearch
            title="Find a law firm"
            action="/perm-attorneys#all"
            placeholder="Fragomen, Berry Appleman"
            note="The start of the name is enough; a firm DOL spells several ways counts once."
            footer={
              <>
                Looking for a sponsor instead?{" "}
                <Link href="/perm-employers" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                  Every employer
                </Link>
              </>
            }
          />
        }
      />

      {attorneys.length > 0 ? (
        <>
          <ChapterNav items={chapters} className="mt-10" />

          <Chapter
            id="busiest"
            title="The ten busiest firms"
            dek="Approval rates cluster above 99% across every firm on this list, so the ranking is by volume alone."
          >
          <section className="mt-6">
            <div className="border border-border bg-card p-6 sm:p-8">
              <ChartTips label="The ten busiest firms, by filings">
              <div className="space-y-3">
                {topTen.map((a) => (
                  <div
                    key={a.name}
                    data-tip={[
                      a.name,
                      `#${a.rank} by filings`,
                      `${formatInt(a.total)} filings`,
                      `${formatInt(a.certified)} certified, ${formatInt(a.denied)} denied`,
                      a.medianDays !== null ? `Median ${formatInt(a.medianDays)} days to a decision` : null,
                      a.recent12m !== null ? `${formatInt(a.recent12m)} filed in the last 12 months` : null,
                    ]
                      .filter(Boolean)
                      .join("\n")}
                    className="grid grid-cols-[minmax(0,240px)_1fr] items-center gap-3">
                    <p className="truncate text-sm font-bold">
                      {a.name}
                    </p>
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        aria-hidden="true"
                        className="h-6 shrink-0 border border-border bg-primary"
                        style={{
                          width: `${Math.max(4, (a.total / maxTotal) * 100)}%`,
                          maxWidth: "calc(100% - 64px)",
                        }}
                      />
                      <span className="whitespace-nowrap font-mono text-sm font-bold tabular-nums">
                        {formatInt(a.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              </ChartTips>
            </div>
          </section>
          </Chapter>

          <section id="all" className="mt-16 scroll-mt-[calc(var(--site-header-h,71px)+4rem)] border-t-2 border-foreground pt-4">
            <h2 className="font-heading text-3xl font-bold leading-tight sm:text-4xl">
              All {firmCount.toLocaleString("en-US")} firms
            </h2>{" "}
            {/* The consequence stays visible because it changes how a row is
                read. The pooling rule itself is method, so it collapses. */}
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
              A practice DOL prints several ways counts once here.
            </p>{" "}
            <FinePrint summary="How firms are pooled" className="mt-2">
              <p>
                Spellings that differ by punctuation, a legal suffix or a single
                mistyped letter are pooled. Spellings that differ by more than
                that stay separate, and each firm&apos;s page lists the ones
                near it.
              </p>
            </FinePrint>
            <div className="mt-6">
              <EntityExplorer kind="attorney" rows={attorneys} total={firmCount} />
            </div>
          </section>

          {/* The table above is a client component: its rows are fetched and
              filtered in the browser, so a crawler sees the server-rendered
              seed links and none of the other firm pages. The A-Z strip is
              the crawlable path to all of them. */}
          <div id="a-z" className="mt-16 scroll-mt-[calc(var(--site-header-h,71px)+4rem)]">
            <BrowseTeaser kind="attorney" />
          </div>
        </>
      ) : (
        <section className="mt-10 border border-border bg-card p-8 text-center">
          <p className="text-lg text-muted-foreground">
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
        <div className="border border-border bg-foreground p-6 text-background">
          <h2 className="font-heading text-lg font-bold">Running a PERM practice?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-background/70">
            Benchmark your volume and median against the field, then track every
            deadline.{" "}
            <Link href="/signup" className="font-bold underline decoration-primary decoration-2 underline-offset-2">
              Free account
            </Link>
            .
          </p>
        </div>
        <div className="border border-border bg-tint-primary p-6">
          <h2 className="font-heading text-lg font-bold">Checking on your firm?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A firm&apos;s median sits near the national one because DOL works a
            single queue. Your own date comes from your filing month:{" "}
            <Link href="/tools/perm-timeline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision estimator
            </Link>
            .
          </p>
        </div>
      </section>
      <PageBasics page="perm-attorneys" />{" "}
      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Filings newer than DOL&apos;s last published file aren&apos;t here: DOL names the firm only when it publishes the decided case. Those cases are on the <Link href="/perm-cases#live" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">live list</Link>, by employer.
      </p>{" "}
      <DataProvenance datasets={["perm-cases", "entities"]} />
    </div>
  );
}
