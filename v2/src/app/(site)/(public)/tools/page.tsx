/**
 * The overview of the public data surface.
 *
 * This page used to be a static menu of six cards. It is now the front door of
 * the instrument: DOL's live position first, the queue drawn as a tape, then
 * the calculators. The section nav on top makes every data page one click from
 * here and from each other.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { openGraphBase } from "@/lib/openGraphBase";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "../../../../../convex/lib/dolProcessingTimes";
import {
  AttestationStackMini,
  BulletinStepsMini,
  QueueDepthMini,
  RecordMatchMini,
  ScaleBarsMini,
  UnionMini,
  TwoBarsMini,
  WageLevelsMini,
  WindowSpansMini,
} from "@/components/tools/MiniDiagrams";
import { QueueTape } from "@/components/tools/QueueTape";
import { getProcessingTimes } from "@/lib/turso/processingTimes";

const TITLE = "Live PERM Data Overview";
const DESCRIPTION =
  "Where DOL's PERM queue stands today: the month under review, the average to a determination, and the wage backlog, from DOL's own figures.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/tools",
  },
};

// Live figures on top; hourly revalidation matches the other data pages.
// The disclosure files are quarterly, so an hourly window bought
// nothing and cost a regeneration per page per hour across 21,178
// entity pages. A day bounds staleness far below the data's own
// cadence. The ingest should also revalidate on demand.
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
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">      <header className="pt-10 sm:pt-12">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Data
          {snapshot?.permAsOf ? ` · DOL figures as of ${formatAsOf(snapshot.permAsOf)}` : null}
        </p>{" "}
        {/* NOT "Where the PERM queue stands" - that is /perm-queue's H1, and
            this page shipped a byte-identical copy of it. Two pages competing
            on one headline is a duplicate-content signal, and the borrowed one
            described the wrong page anyway: this is the hub over every live
            figure and calculator, and the queue is one of the things it links
            to. The H1 now says what the page is, matching its own title and
            the sentence directly under it. */}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Live PERM data and free calculators
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          DOL&apos;s own figures, each with its date, and calculators built on
          them.
        </p>
      </header>

      {/* Live position: three tone panels, rotated so they read as three
          different facts rather than three identical boxes. */}
      {snapshot ? (
        <section aria-label="Live DOL position" className="mt-10 grid [&>*]:min-w-0 grid-cols-1 gap-6 sm:grid-cols-3 sm:gap-4">
          <div className="border-2 border-border bg-foreground p-6 text-background shadow-hard">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-background/60">
              DOL is deciding cases filed
            </p>{" "}
            <p className="mt-2 font-heading text-3xl font-black leading-none">
              {formatMonth(frontierMonth) ?? "—"}
            </p>{" "}
            <p className="mt-3 text-sm leading-relaxed text-background/70">
              Analyst review, the queue nearly every case sits in.
            </p>
          </div>
          <div className="border-2 border-border bg-tint-primary p-6 shadow-hard">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
              Average to a determination
            </p>{" "}
            <p className="mt-2 font-heading text-3xl font-black leading-none">
              {analystAvg?.calendarDays != null ? `${analystAvg.calendarDays} days` : "—"}
            </p>{" "}
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              Across cases DOL decided recently. An RFI or audit can make one case take longer.
            </p>
          </div>
          <div className="border-2 border-border bg-card p-6 shadow-hard">
            <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
              Wage requests pending
            </p>{" "}
            <p className="mt-2 font-heading text-3xl font-black leading-none">
              {pwd != null ? pwd.toLocaleString("en-US") : "—"}
            </p>{" "}
            <p className="mt-3 text-sm leading-relaxed text-foreground/70">
              Prevailing wage, the stage before recruitment.
            </p>
          </div>
        </section>
      ) : null}

      {/* THE FUNNEL, FIRST: a person holding a case number outranks every
          aggregate below. Same GET contract as the homepage hero - no client
          JS, an honest form a crawler can see. This hub had no path to the
          lookup at all until Adam asked where the important pages were. */}
      <section className="mt-10 border-3 border-border bg-card p-6 shadow-hard sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h2 className="font-heading text-2xl font-black">
              Where&apos;s your case? When could it be decided?
            </h2>{" "}
            <p className="mt-2 max-w-xl text-base leading-relaxed text-foreground/70">
              Live DOL status, your place in the queue and an estimate. Free,
              no account.
            </p>
          </div>
          <form action="/perm-case-status" method="get" className="flex min-w-0 flex-wrap items-center gap-3">
            <label htmlFor="tools-case" className="sr-only">
              Case number
            </label>{" "}
            <input
              id="tools-case"
              name="case"
              placeholder="G-100-24339-516453"
              className="min-h-[44px] w-64 min-w-0 max-w-full border-2 border-border bg-background px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />{" "}
            <button
              type="submit"
              className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-5 font-heading font-black text-primary-foreground shadow-hard-sm transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
            >
              Check my case
            </button>{" "}
            <Link
              href="/tools/perm-timeline-calculator"
              className="text-sm font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
            >
              No number? Processing time calculator
            </Link>
          </form>
        </div>
      </section>

      {/* The queue as a tape: the one drawing that carries the mental model. */}
      {frontierMonth ? (
        <section className="mt-10">
          <h2 className="font-heading text-2xl font-black">The queue, oldest first</h2>{" "}
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
            Every PERM waits in filing-month order.{" "}
            <Link
              href="/tools/perm-timeline-calculator"
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              Find your month
            </Link>
            .
          </p>
          <QueueTape frontierMonth={frontierMonth} className="mt-6" />
        </section>
      ) : null}



      <section className="mt-10 flex flex-wrap items-center justify-between gap-4 border-2 border-border bg-tint-primary p-6 shadow-hard sm:p-8">
        <div>
          <h2 className="font-heading text-2xl font-black">Seven calculators</h2>{" "}
          <p className="mt-1 max-w-xl text-base text-foreground/70">
            Decision times, the wage queue, the I-140 backlog, the I-485
            queue, priority dates, the whole green card drawn to scale, and
            every statutory deadline.
          </p>
        </div>
        <Link
          href="/calculators"
          className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-5 py-2.5 font-bold text-black shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
        >
          Open the calculators
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {/* The two sides of the product, connected in one band. */}
      {/* The disclosure aggregates: three cuts of the same quarterly files. */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">The whole field</h2>{" "}
        <p className="mt-2 max-w-2xl text-base text-foreground/70">
          One search across all three DOL programs, then the disclosure files
          cut by place, pay, sponsor, firm and outcome.
        </p>
        {/* Flex-wrap, not a 3-column grid: the card count changes as pages are
            added, and a fixed third column leaves an empty cell in the last
            row that reads as a card that failed to load. Wrapping lets the
            last row share the width instead, whatever the count. */}
        <div className="mt-6 flex flex-wrap gap-4 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-72">
          {[
            {
              href: "/case-search",
              label: "Search all programs",
              blurb: "One box across PERM, wage requests and LCAs. Every filing an employer has made, sortable.",
              tone: "ink",
              viz: "union" as const,
            },
            {
              href: "/perm-by-state",
              label: "By state",
              blurb: "An interactive map of filings, approval rates and wages per worksite state.",
              tone: "tint",
              viz: "scale" as const,
            },
            {
              href: "/perm-wages",
              label: "Wages",
              blurb: "Median offered wage by occupation, from what each employer committed to pay.",
              tone: "tint",
              viz: "twobars" as const,
            },
            {
              href: "/perm-employers",
              label: "Employers",
              blurb: "Every sponsor in DOL's files, ranked and searchable, with their track records.",
              tone: "card",
              viz: "queue" as const,
            },
            {
              href: "/perm-attorneys",
              label: "Law firms",
              blurb: "Who files the most PERM cases, with volume, approval rate and median days.",
              tone: "card",
              viz: "spans" as const,
            },
            {
              href: "/perm-denial-risk",
              label: "Denial rates",
              blurb: "What gets denied, by wage, by year, and by what the form declares.",
              tone: "tint",
              viz: "steps" as const,
            },
            {
              href: "/perm-cases",
              label: "Case search",
              blurb: "Every decided case DOL has published, searchable by employer, job and outcome.",
              tone: "card",
              viz: "records" as const,
            },
            {
              href: "/pwd-cases",
              label: "Wage requests",
              blurb: "Prevailing wage requests confirmed by DOL, searchable by employer before the PERM exists.",
              tone: "tint",
              viz: "levels" as const,
            },
            {
              href: "/lca-cases",
              label: "H-1B LCAs",
              blurb: "Labor condition applications as DOL confirms them, by employer and title.",
              tone: "card",
              viz: "attest" as const,
            },
          ].map((c) => (
            <a
              key={c.href}
              href={c.href}
              className={
                "group flex flex-col border-2 border-border p-6 transition-all duration-150 hover:-translate-y-[2px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm " +
                (c.tone === "ink"
                  ? "bg-foreground text-background shadow-hard"
                  : c.tone === "tint"
                    ? "bg-tint-primary shadow-hard"
                    : "bg-card shadow-hard")
              }
            >
              <h3 className="font-heading text-lg font-black">{c.label}</h3>{" "}
              {/* The card's own subject, drawn. */}
              <div
                className={
                  "mt-3 max-w-[150px] " + (c.tone === "ink" ? "text-background" : "text-foreground")
                }
              >
                {c.viz === "scale" ? <ScaleBarsMini /> : null}
                {c.viz === "twobars" ? <TwoBarsMini /> : null}
                {c.viz === "queue" ? <QueueDepthMini /> : null}
                {c.viz === "spans" ? <WindowSpansMini /> : null}
                {c.viz === "steps" ? <BulletinStepsMini /> : null}
                {c.viz === "union" ? <UnionMini /> : null}
                {c.viz === "records" ? <RecordMatchMini /> : null}
                {c.viz === "levels" ? <WageLevelsMini /> : null}
                {c.viz === "attest" ? <AttestationStackMini /> : null}
              </div>{" "}
              <p
                className={
                  "mt-2 flex-1 text-sm leading-relaxed " +
                  (c.tone === "ink" ? "text-background/70" : "text-foreground/70")
                }
              >
                {c.blurb}
              </p>{" "}
              <span
                className={
                  "mt-4 font-mono text-xs font-bold uppercase tracking-wider " +
                  // NOT `text-primary` ON THE INK CARD. That card is
                  // `bg-foreground`, which is near-black in light and
                  // near-WHITE in dark, while the lime holds still at #2ecc40
                  // - so the label measured 4.28:1 in light and 2.05:1 in
                  // dark. `text-background` is the half of the pair that flips
                  // WITH the card, so it is legible in both by construction.
                  // Same defect as the verdict chip, same fix.
                  (c.tone === "ink"
                    ? "text-background/80 group-hover:text-background"
                    : "text-foreground/60 group-hover:text-primary")
                }
              >
                Open →
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* The queue, day by day - the pages the strip's Queue and Risk groups
          hold, so the hub reaches everything the nav does. */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">The queue, day by day</h2>{" "}
        <div className="mt-6 flex flex-wrap gap-4 [&>*]:min-w-0 [&>*]:flex-1 [&>*]:basis-64">
          {[
            { href: "/perm-queue", label: "Queue backlog", blurb: "Every filing month's pending cases, split across DOL's separate queues." },
            { href: "/perm-decision-activity", label: "Daily activity", blurb: "How many cases DOL decides each day, measured from status changes." },
            { href: "/perm-rfi-audit", label: "RFI and audits", blurb: "How often cases leave filing order, and what happens to them after." },
            { href: "/tools/priority-date-calculator", label: "Visa bulletin", blurb: "84 months of cutoff history, and whether your date is current." },
          ].map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col border-2 border-border bg-card p-5 shadow-hard transition-all duration-150 hover:-translate-y-[2px] hover:shadow-hard-lg active:translate-y-0"
            >
              <h3 className="font-heading text-lg font-black">{c.label}</h3>{" "}
              <p className="mt-2 flex-1 text-sm leading-relaxed text-foreground/70">{c.blurb}</p>{" "}
              <span className="mt-3 font-mono text-xs font-bold uppercase tracking-wider text-foreground/60 group-hover:text-primary">
                Open →
              </span>
            </Link>
          ))}
        </div>{" "}
        <p className="mt-4 text-sm text-muted-foreground">
          How every figure is computed:{" "}
          <Link href="/methodology" className="font-bold underline underline-offset-2 hover:text-primary">
            the methodology page
          </Link>
          .
        </p>
      </section>

      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            For your own case
          </p>{" "}
          <h2 className="mt-2 font-heading text-xl font-black">
            Get notified when DOL reaches your month
          </h2>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            Set it on the{" "}
            <Link
              href="/perm-processing-times"
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              processing times page
            </Link>
            , or on any case you check. Everything we send is listed on the{" "}
            <Link
              href="/email-preferences"
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              email preferences page
            </Link>
            .
          </p>
        </div>
        <div className="border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-background/60">
            For a caseload
          </p>{" "}
          <h2 className="mt-2 font-heading text-xl font-black">
            Track every deadline in every case
          </h2>{" "}
          <p className="mt-3 text-base leading-relaxed text-background/70">
            The deadline calculator&apos;s date math, applied to every case you
            run, with alerts and calendar sync. Free.
          </p>{" "}
          <Link
            href="/signup"
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-5 py-2.5 font-bold text-black shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
          >
            Start tracking
            <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
          </Link>{" "}
          <Link
            href="/for-attorneys"
            className="mt-3 inline-flex min-h-[44px] items-center font-bold underline decoration-primary decoration-2 underline-offset-4 sm:ml-4 sm:mt-5"
          >
            What firms get
          </Link>
        </div>
      </section>
    </div>
  );
}
