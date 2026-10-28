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
import { QueueTape } from "@/components/tools/QueueTape";
import { getProcessingTimes } from "@/lib/db/processingTimes";
import { CaseLookupForm } from "@/components/tools/CaseLookupForm";
import { DataTour } from "@/components/tools/DataTour";

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
    <>
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      {/* The page's title on its own ink band (round 3, Oct 15 2026: a plain
          heading on the white ground read as a blank page), with DOL's date
          under it and DOL's three figures fastened to its foot. */}
      <header className="mt-8 shadow-hard sm:mt-10">
        <div className="dark relative border-2 border-black bg-[#141414] px-5 py-7 text-foreground sm:px-8 sm:py-9">
          <span aria-hidden="true" className="absolute left-0 top-0 h-1.5 w-24 bg-primary" />
          {/* NOT "Where the PERM queue stands" - that is /perm-queue's H1, and
              this page shipped a byte-identical copy of it. Two pages competing
              on one headline is a duplicate-content signal, and the borrowed one
              described the wrong page anyway: this is the hub over every live
              figure and calculator, and the queue is one of the things it links
              to. The H1 now says what the page is, matching its own title. */}
          <h1 className="font-heading text-3xl font-bold leading-tight sm:text-5xl">
            Live PERM data and free calculators
          </h1>{" "}
          {formatAsOf(snapshot?.permAsOf) ? (
            <p className="mt-3 text-base text-soft sm:text-lg">
              DOL figures, as of {formatAsOf(snapshot?.permAsOf)}.
            </p>
          ) : null}
        </div>{" "}
        {/* DOL's position in three figures, then the case box: a person
            holding a case number outranks every aggregate below. */}
        {snapshot ? (
          <section aria-label="Live DOL position">
            <FigureRow className="border-t-0 shadow-none">
              <Figure
                tone="lime"
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
      </header>

      <section aria-labelledby="your-case" className="object mt-10 bg-sage p-5 sm:p-8">
        <h2 id="your-case" className="font-heading text-xl font-bold">
          Where&apos;s your case? When could it be decided?
        </h2>{" "}
        <p className="mt-1 max-w-xl text-base leading-relaxed text-foreground">
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
        <section className="mt-10 border-2 border-border bg-tint p-5 sm:p-8">
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



      <section className="mt-12 flex flex-wrap items-center justify-between gap-4 border-2 border-black bg-primary p-6 text-black shadow-hard sm:p-8">
        <div>
          <h2 className="font-heading text-2xl font-bold">All {CALCULATOR_PAGES.length} calculators</h2>{" "}
          <p className="mt-1 max-w-xl text-base">
            Decision times, the wage, I-140 and I-485 queues, priority dates,
            the whole green card dated from your own case, and every statutory deadline.
          </p>
        </div>{" "}
        <Link href="/calculators" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Open the calculators
        </Link>
      </section>

    </div>{" "}
    {/* Every data page, group by group, each band beside a capture of the group's main page. */}
    <div className="mt-12">
      <DataTour />
    </div>{" "}
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <p className="mt-10 text-sm text-muted-foreground">
        How every figure is computed:{" "}
        <Link href="/methodology" className="link">
          the methodology page
        </Link>
        .
      </p>

      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="bg-sage p-6 sm:p-8 border-2 shadow-hard border-border">
          <p className="text-sm font-bold">For your own case</p>{" "}
          <h2 className="mt-2 font-heading text-xl font-bold">
            Get notified when DOL reaches your month
          </h2>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground">
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
        <div className="dark p-6 sm:p-8 border-2 shadow-hard border-black bg-[#141414] text-foreground">
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
    </>
  );
}
