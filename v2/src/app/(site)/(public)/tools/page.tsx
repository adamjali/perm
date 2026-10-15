/**
 * The overview of the public data surface.
 *
 * The front door of the instrument: DOL's live position first, the queue
 * drawn as a tape, then
 * the calculators. The section nav on top makes every data page one click from
 * here and from each other.
 */

import type { Metadata } from "next";
import { CALCULATOR_PAGES } from "@/lib/siteMap";
import { withSocialCard } from "@/lib/socialCard";
import Link from "next/link";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { buttonVariants } from "@/components/ui/button";

import { openGraphBase } from "@/lib/openGraphBase";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "@convex/lib/dolProcessingTimes";
import {
  AttestationStackMini,
  BulletinStepsMini,
  DailyBarsMini,
  DetourMini,
  QueueDepthMini,
  RecordMatchMini,
  ScaleBarsMini,
  ShareBarsMini,
  TapeMini,
  UnionMini,
  TwoBarsMini,
  WageLevelsMini,
  WindowSpansMini,
} from "@/components/tools/MiniDiagrams";
import { QueueTape } from "@/components/tools/QueueTape";
import { getProcessingTimes } from "@/lib/db/processingTimes";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";

const TITLE = "Live PERM Data Overview";
const DESCRIPTION =
  "Where DOL's PERM queue stands today: the month under review, the average to a determination, and the wage backlog, from DOL's own figures.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools",
  },
}, "tools");

// Live figures on top; a day's window, like the other data pages.
// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence, and the ingests expire it on demand when its data moves
// (the /api/revalidate-* routes).
export const revalidate = 86400;

export default async function ToolsPage() {
  const snapshot = await getProcessingTimes();
  const analyst = snapshot ? analystReviewQueue(snapshot.permQueues) : undefined;
  const analystAvg = snapshot
    ? analystReviewAverage(snapshot.permAverageDays)
    : undefined;
  const pwd = snapshot?.pwdPermBacklog?.length
    ? snapshot.pwdPermBacklog.reduce((sum, r) => sum + r.remainingRequests, 0)
    : null;
  const frontierMonth = analyst?.priorityDate ?? null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <header className="pt-10 sm:pt-12">
        {/* NOT "Where the PERM queue stands" - that is /perm-queue's H1, and
            this page shipped a byte-identical copy of it. Two pages competing
            on one headline is a duplicate-content signal, and the borrowed one
            described the wrong page anyway: this is the hub over every live
            figure and calculator, and the queue is one of the things it links
            to. The H1 now says what the page is, matching its own title and
            the sentence directly under it. */}
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          Live PERM data and free calculators
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          DOL&apos;s own figures, each with its date, and calculators built on them.
          {snapshot?.permAsOf ? ` DOL's figures below are as of ${formatAsOf(snapshot.permAsOf)}.` : null}
        </p>
      </header>

      {/* DOL's position in three figures, then the case box: a person holding
          a case number outranks every aggregate below. */}
      {snapshot ? (
        <section aria-label="Live DOL position" className="mt-10">
          <FigureRow>
            <Figure
              label="DOL is deciding cases filed"
              value={formatMonth(frontierMonth) ?? "Not published"}
              note="Analyst review, the queue nearly every case sits in."
            />
            <Figure
              label="Average to a determination"
              value={analystAvg?.calendarDays != null ? `${analystAvg.calendarDays} days` : "Not published"}
              note="Across cases DOL decided recently. An RFI or audit can make one case take longer."
            />
            <Figure
              label="Wage requests pending"
              value={pwd != null ? pwd.toLocaleString("en-US") : "Not published"}
              note="Prevailing wage, the stage before recruitment."
            />
          </FigureRow>
        </section>
      ) : null}

      <section aria-labelledby="your-case" className="object mt-10 p-5 sm:p-8">
        <h2 id="your-case" className="font-heading text-xl font-bold">
          Where&apos;s your case? When could it be decided?
        </h2>{" "}
        <p className="mt-1 max-w-xl text-base leading-relaxed text-soft">
          Live DOL status, your place in the queue and an estimate. Free, no account.
        </p>{" "}
        <CaseLookupForm
          className="mt-4 max-w-2xl"
          label="Case number"
          compact
          source="data-hub"
          help={null}
          searchHref="/tools/perm-timeline-calculator"
          searchLabel="Estimate your wait from the month you filed"
        />
      </section>

      {/* The queue as a tape: the one drawing that carries the mental model. */}
      {frontierMonth ? (
        <section className="mt-10">
          <h2 className="font-heading text-2xl font-bold">The queue, oldest first</h2>{" "}
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Every PERM waits in filing-month order.{" "}
            <Link href="/tools/perm-timeline-calculator" className="link">
              Find your month
            </Link>
            .
          </p>
          <QueueTape frontierMonth={frontierMonth} className="mt-6" />
        </section>
      ) : null}



      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 border-y border-border py-6">
        <div>
          <h2 className="font-heading text-2xl font-bold">All {CALCULATOR_PAGES.length} calculators</h2>{" "}
          <p className="mt-1 max-w-xl text-base text-soft">
            Decision times, the wage, I-140 and I-485 queues, priority dates,
            the green card drawn to scale, and every statutory deadline.
          </p>
        </div>{" "}
        <Link href="/calculators" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Open the calculators
        </Link>
      </section>

      {/* The two sides of the product, connected in one band. */}
      {/* The disclosure aggregates: three cuts of the same quarterly files. */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">The whole field</h2>
        {/* Flex-wrap, not a 3-column grid: the card count changes as pages are
            added, and a fixed third column leaves an empty cell in the last
            row that reads as a card that failed to load. Wrapping lets the
            last row share the width instead, whatever the count. */}
        <div className="mt-6 flex flex-wrap gap-4 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-72">
          {[
            {
              href: "/case-search",
              label: "Search all programs",
              blurb: "One box across PERM, wage requests, LCAs and H-2A, H-2B and CW-1.",
              viz: "union" as const,
            },
            {
              href: "/perm-by-state",
              label: "By state",
              blurb: "An interactive map of filings, approval rates and wages by state.",
              viz: "scale" as const,
            },
            {
              href: "/perm-wages",
              label: "Wages",
              blurb: "Median offered wage by occupation, from what employers committed to pay.",
              viz: "twobars" as const,
            },
            {
              href: "/perm-employers",
              label: "Employers",
              blurb: "Every sponsor in DOL's files, ranked, with track records.",
              viz: "queue" as const,
            },
            {
              href: "/perm-attorneys",
              label: "Law firms",
              blurb: "Who files the most PERM cases, and how fast.",
              viz: "spans" as const,
            },
            {
              href: "/perm-denial-risk",
              label: "Denial rates",
              blurb: "What gets denied, by wage, by year, and by what the form declares.",
              viz: "shares" as const,
            },
            {
              href: "/perm-cases",
              label: "Case search",
              blurb: "Every decided case DOL has published, by employer, job and outcome.",
              viz: "records" as const,
            },
            {
              href: "/pwd-cases",
              label: "Wage requests",
              blurb: "Prevailing wage requests, searchable before the PERM exists.",
              viz: "levels" as const,
            },
            {
              href: "/lca-cases",
              label: "H-1B LCAs",
              blurb: "Labor condition applications as DOL confirms them, by employer and title.",
              viz: "attest" as const,
            },
            {
              href: "/seasonal-cases",
              label: "H-2A, H-2B and CW-1",
              blurb: "Seasonal farm and non-farm filings as DOL confirms them, by employer.",
              viz: "records" as const,
            },
          ].map((c) => (
            <a
              key={c.href}
              href={c.href}
              className="group flex flex-col border-2 border-transparent bg-tint p-6 transition-colors duration-150 hover:border-[var(--object-border)]"
            >
              <h3 className="font-heading text-lg font-bold">{c.label}</h3>{" "}
              {/* The card's own subject, drawn. */}
              <div className="mt-3 max-w-[150px] text-foreground">
                {c.viz === "scale" ? <ScaleBarsMini /> : null}
                {c.viz === "twobars" ? <TwoBarsMini /> : null}
                {c.viz === "queue" ? <QueueDepthMini /> : null}
                {c.viz === "spans" ? <WindowSpansMini /> : null}
                {c.viz === "shares" ? <ShareBarsMini /> : null}
                {c.viz === "union" ? <UnionMini /> : null}
                {c.viz === "records" ? <RecordMatchMini /> : null}
                {c.viz === "levels" ? <WageLevelsMini /> : null}
                {c.viz === "attest" ? <AttestationStackMini /> : null}
              </div>{" "}
              <p className="mt-2 flex-1 text-sm leading-relaxed text-soft">
                {c.blurb}
              </p>{" "}
            </a>
          ))}
        </div>
      </section>

      {/* The queue, day by day - the pages the strip's Queue and Risk groups
          hold, so the hub reaches everything the nav does. */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-bold">The queue, day by day</h2>{" "}
        <div className="mt-6 flex flex-wrap gap-4 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-64">
          {[
            { href: "/perm-queue", label: "Queue backlog", blurb: "Every filing month's pending cases, by DOL queue.", viz: <TapeMini /> },
            { href: "/perm-decision-activity", label: "Daily activity", blurb: "How many cases DOL decides each day.", viz: <DailyBarsMini /> },
            { href: "/perm-rfi-audit", label: "RFI and audits", blurb: "How often cases leave filing order, and what follows.", viz: <DetourMini /> },
            { href: "/tools/priority-date-calculator", label: "Visa bulletin", blurb: "Every cutoff since October 2014, and whether your date is current.", viz: <BulletinStepsMini /> },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col border-2 border-transparent bg-tint p-5 transition-colors duration-150 hover:border-[var(--object-border)]"
            >
              <h3 className="font-heading text-lg font-bold">{c.label}</h3>{" "}
              {/* The page's subject, drawn, as on the tiles above. */}
              <div className="mt-3 max-w-[150px] text-foreground">{c.viz}</div>{" "}
              <p className="mt-2 flex-1 text-sm leading-relaxed text-soft">{c.blurb}</p>{" "}
            </Link>
          ))}
        </div>{" "}
        <p className="mt-4 text-sm text-muted-foreground">
          How every figure is computed:{" "}
          <Link href="/methodology" className="link">
            the methodology page
          </Link>
          .
        </p>
      </section>

      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="bg-tint p-6 sm:p-8">
          <p className="text-sm text-muted-foreground">For your own case</p>{" "}
          <h2 className="mt-2 font-heading text-xl font-bold">
            Get notified when DOL reaches your month
          </h2>{" "}
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Set it on the{" "}
            <Link
              href="/perm-processing-times"
              className="link"
            >
              processing times page
            </Link>
            , or on any case you check. Everything we send is listed on the{" "}
            <Link
              href="/email-preferences"
              className="link"
            >
              email preferences page
            </Link>
            .
          </p>
        </div>
        <div className="bg-tint p-6 sm:p-8">
          <p className="text-sm text-muted-foreground">For a caseload</p>{" "}
          <h2 className="mt-2 font-heading text-xl font-bold">Track every deadline in every case</h2>{" "}
          <p className="mt-3 text-base leading-relaxed text-soft">
            The deadline calculator&apos;s date math, applied to every case you run, with alerts and calendar sync.
            Free.
          </p>{" "}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/signup" className={buttonVariants({ variant: "outline" })}>
              Start tracking
            </Link>{" "}
            <Link href="/for-attorneys" className="link inline-flex min-h-11 items-center">
              What firms get
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
