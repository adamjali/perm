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
import { fetchQuery } from "convex/nextjs";
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  FileText,
  Route,
  Scale,
} from "lucide-react";

import { api } from "../../../../convex/_generated/api";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "../../../../convex/lib/dolProcessingTimes";
import { DataNav } from "@/components/tools/DataNav";
import { QueueTape } from "@/components/tools/QueueTape";

const TITLE = "PERM Calculators and Live DOL Data";
const DESCRIPTION =
  "Where the PERM queue stands today, and free calculators built on DOL's own published data: decision times, the wage queue, and every statutory deadline.";

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
export const revalidate = 3600;

const TOOLS = [
  {
    href: "/tools/perm-timeline-calculator",
    icon: CalendarClock,
    name: "PERM processing time calculator",
    kind: "Estimate",
    tone: "ink",
    blurb:
      "When DOL is likely to decide a case filed in a given month, from its published queue position and its record of cases already decided.",
  },
  {
    href: "/tools/perm-deadline-calculator",
    icon: CalendarCheck,
    name: "PERM deadline calculator",
    kind: "Exact",
    tone: "pop",
    blurb:
      "The recruitment window, the quiet period and the ETA-9089 filing window, worked out from the prevailing wage determination under 20 CFR 656.",
  },
  {
    href: "/tools/pwd-calculator",
    icon: Scale,
    name: "Prevailing wage queue calculator",
    kind: "Count",
    tone: "paper",
    blurb:
      "How many wage requests sit ahead of yours. DOL publishes this one as an actual pending count, so it is a fact rather than a model.",
  },
  {
    href: "/tools/i140-calculator",
    icon: FileText,
    kind: "Count",
    name: "I-140 queue calculator",
    tone: "paper",
    blurb:
      "How many petitions are waiting in your category against how fast USCIS clears them, next to the processing time USCIS publishes. The two disagree, and the gap is the useful part.",
  },
  {
    href: "/tools/priority-date-calculator",
    icon: CalendarRange,
    kind: "History",
    name: "Priority date calculator",
    tone: "tint",
    blurb:
      "Where a priority date sits against the visa bulletin, and which way the cutoff has moved. It goes backwards more often than people expect.",
  },
  {
    href: "/tools/green-card-timeline",
    icon: Route,
    kind: "Overview",
    name: "Green card timeline",
    tone: "paper",
    blurb:
      "Every stage drawn to scale, from the wage queue to the wait for a visa number. Shows which parts are fixed by regulation, which are queues, and which nobody can put a number on.",
  },
];

export default async function ToolsPage() {
  const snapshot = await fetchQuery(api.dolProcessingTimes.getLatest, {}).catch(
    () => null,
  );
  const analyst = snapshot ? analystReviewQueue(snapshot.permQueues) : undefined;
  const analystAvg = snapshot
    ? analystReviewAverage(snapshot.permAverageDays)
    : undefined;
  const pwd = snapshot?.pwdPermBacklog?.length
    ? snapshot.pwdPermBacklog.reduce((sum, r) => sum + r.remainingRequests, 0)
    : null;
  const frontierMonth = analyst?.priorityDate ?? null;

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList" as const,
    name: "PERM calculators and tools",
    numberOfItems: TOOLS.length,
    itemListElement: TOOLS.map((t, i) => ({
      "@type": "ListItem" as const,
      position: i + 1,
      item: {
        "@type": "WebApplication" as const,
        name: t.name,
        url: `https://permtracker.app${t.href}`,
        applicationCategory: "BusinessApplication",
        offers: { "@type": "Offer" as const, price: "0", priceCurrency: "USD" },
      },
    })),
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 sm:pb-16">
      <JsonLdScript schema={itemList} />

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
          it cannot answer.
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

      <section id="calculators" className="mt-12 scroll-mt-28">
        <h2 className="font-heading text-2xl font-black">The calculators</h2>
        <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-8">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            const card = (
              <Link
                key={t.href}
                href={t.href}
                className={
                  "group flex h-full flex-col border-2 border-border p-6 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 " +
                  (t.tone === "ink"
                    ? "bg-foreground text-background shadow-hard hover:-translate-y-[1px] hover:shadow-hard-lg"
                    : t.tone === "tint"
                      ? "bg-tint-primary shadow-hard hover:-translate-y-[1px] hover:shadow-hard-lg"
                      : t.tone === "pop"
                        ? "bg-card hover:-translate-x-[1px] hover:-translate-y-[1px]"
                        : "bg-card shadow-hard hover:-translate-y-[1px] hover:shadow-hard-lg")
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                  <span
                    className={
                      "font-mono text-xs font-bold uppercase tracking-wider " +
                      (t.tone === "ink" ? "text-background/60" : "text-foreground/50")
                    }
                  >
                    {t.kind}
                  </span>
                </div>
                <h3 className="mt-4 font-heading text-xl font-black leading-tight">
                  {t.name}
                </h3>{" "}
                <p
                  className={
                    "mt-3 flex-1 text-base leading-relaxed " +
                    (t.tone === "ink" ? "text-background/70" : "text-foreground/70")
                  }
                >
                  {t.blurb}
                </p>{" "}
                <span
                  className={
                    "mt-5 inline-flex items-center gap-2 font-bold underline decoration-primary decoration-2 underline-offset-4 " +
                    // Lime TEXT passes on ink (10.4:1) and fails on light
                    // surfaces (2.05:1 measured), so the label reads in the
                    // surface's own foreground and lime carries the underline.
                    (t.tone === "ink" ? "text-background" : "text-foreground")
                  }
                >
                  Open
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            );
            // One offset block in the grid, on the exact-answer tool.
            return t.tone === "pop" ? (
              <div key={t.href} className="pop">
                {card}
              </div>
            ) : (
              card
            );
          })}
        </div>
      </section>

      <section className="mt-12 border-2 border-border bg-muted p-6 sm:p-8">
        <h2 className="font-heading text-xl font-black">
          Why some of these refuse to give you a number
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          A queue estimate is a forecast. Where DOL publishes enough to be sure,
          you get a figure and its source. Where it does not, you get the count
          that is real and a plain statement of what is missing. The deadline
          calculator is the exception: those dates are arithmetic in the
          regulations, so they are exact.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Public estimators disagree with each other by months on the same
          filing date.{" "}
          <Link
            href="/methodology"
            className="font-bold underline underline-offset-2 hover:text-primary"
          >
            How we compute ours, and why they differ
          </Link>
          .
        </p>
      </section>

      {/* The two sides of the product, connected in one band. */}
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
            className="mt-5 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-5 py-2.5 font-bold text-black shadow-hard-sm transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard"
          >
            Start tracking
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
