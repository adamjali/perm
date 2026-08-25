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
import { ArrowRight } from "@phosphor-icons/react/ssr";

import { openGraphBase } from "@/lib/openGraphBase";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "../../../../../convex/lib/dolProcessingTimes";
import { DataNav } from "@/components/tools/DataNav";
import {
  BulletinStepsMini,
  QueueDepthMini,
  ScaleBarsMini,
  TwoBarsMini,
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
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="overview" />

      <header className="pt-10 sm:pt-12">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
          Data
          {snapshot?.permAsOf ? ` · DOL figures as of ${formatAsOf(snapshot.permAsOf)}` : null}
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Where the PERM queue stands
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Live figures from the Department of Labor, and free calculators built
          on them. Each one says where its numbers come from, and says so when
          it can’t answer.
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
              Over cases DOL decided recently. Audits pull it up.
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

      {/* The queue as a tape: the one drawing that carries the mental model. */}
      {frontierMonth ? (
        <section className="mt-10">
          <h2 className="font-heading text-2xl font-black">One line, cleared oldest first</h2>{" "}
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
            Every PERM waits in filing-month order. The tape shows the months
            DOL has cleared and the months still waiting.{" "}
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
          <h2 className="font-heading text-2xl font-black">Six calculators, one per question</h2>{" "}
          <p className="mt-1 max-w-xl text-base text-foreground/70">
            Decision times, the wage queue, the I-140 backlog, priority dates,
            the whole green card to scale, and every statutory deadline.
          </p>
        </div>
        <Link
          href="/calculators"
          className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-5 py-2.5 font-bold text-black shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
        >
          Open the calculators
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {/* The two sides of the product, connected in one band. */}
      {/* The disclosure aggregates: three cuts of the same quarterly files. */}
      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">The whole field, five ways</h2>{" "}
        <p className="mt-2 max-w-2xl text-base text-foreground/70">
          Every filing in DOL&apos;s quarterly disclosure files, cut by place,
          pay, sponsor, firm and outcome.
        </p>
        <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
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
              blurb: "Median offered wages by occupation - committed figures, not survey estimates.",
              tone: "ink",
              viz: "twobars" as const,
            },
            {
              href: "/perm-employers",
              label: "Employers",
              blurb: "The hundred biggest sponsors, ranked, searchable, with their track records.",
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
              blurb: "What actually gets denied, by wage, by year, and by what the form declares.",
              tone: "tint",
              viz: "steps" as const,
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
                  (c.tone === "ink" ? "text-primary" : "text-foreground/60 group-hover:text-primary")
                }
              >
                Open →
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="mt-12 grid [&>*]:min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
            For your own case
          </p>{" "}
          <h2 className="mt-2 font-heading text-xl font-black">
            Get one email when DOL reaches your month
          </h2>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            No newsletter, no account. Set it on the{" "}
            <Link
              href="/perm-processing-times"
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              processing times page
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
            The same date math as the deadline calculator, applied to your
            cases, with alerts and calendar sync. Free.
          </p>{" "}
          <Link
            href="/signup"
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-5 py-2.5 font-bold text-black shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard active:translate-y-0 active:shadow-hard-sm"
          >
            Start tracking
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
