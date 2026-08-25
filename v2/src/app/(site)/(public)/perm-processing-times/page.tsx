/**
 * PERM Processing Times
 *
 * The live position of DOL's PERM and prevailing-wage queues, taken from
 * https://flag.dol.gov/processingtimes and refreshed weekly.
 *
 * Why this page exists in this shape:
 *
 * DOL publishes a snapshot and overwrites it. There is no archive, so the
 * previous figures vanish the moment a new set goes up. Every competitor
 * ranking for these terms answers the reader's question with a prediction of
 * DOL's queue, and those predictions disagree with each other by as much as
 * nine months. We keep every snapshot instead, which lets this page do two
 * things none of them can: quote DOL's own number with DOL's own date, and
 * state how far the queue actually moved between two dates we hold.
 *
 * The discipline that follows from that: nothing on this page is derived,
 * modelled or extrapolated. Every figure is either printed by DOL or is
 * arithmetic on two dates DOL printed.
 *
 * TWO DOL PUBLICATIONS SIT HERE, ON TWO CADENCES. The queue positions come
 * from flag.dol.gov weekly. The decisions-per-month counts come from the
 * quarterly disclosure files. Both are DOL's own figures and neither is
 * modelled, but they go stale at different rates, so the page labels which
 * is which rather than letting one freshness date stand for the whole thing.
 *
 * Every chart carries the same numbers as a table, in the served HTML, and a
 * switch between them. Where a series is long enough for the question "what
 * about lately" to differ from "what about across the record", it carries a
 * window control too.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { fetchQuery } from "convex/nextjs";
import { ArrowRight, ArrowSquareOut } from "@phosphor-icons/react/ssr";

import { api } from "../../../../../convex/_generated/api";
import { openGraphBase } from "@/lib/openGraphBase";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { currentMonthUtc, daysAsApproxMonths, daysBetween, formatAsOf, formatMonth, monthsMoved } from "@/lib/dolFormat";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "../../../../../convex/lib/dolProcessingTimes";
import { QueueAlertForm } from "./QueueAlertForm";
import { DataNav } from "@/components/tools/DataNav";
import { QueueTape } from "@/components/tools/QueueTape";
import { DecisionsByMonth, QueueHistoryChart } from "@/components/tools/QueueHistoryChart";
import { PwdBacklogChart } from "@/components/tools/PwdBacklogChart";
import { FreshnessDots, type Freshness } from "@/components/tools/Insight";

const DOL_SOURCE = "https://flag.dol.gov/processingtimes";
// Same expression as layout.tsx, sitemap.ts, feed.xml and seo.ts. A bare
// literal here meant a preview deploy emitted Dataset markup pointing at
// production, which is a different page than the one being previewed.
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://permtracker.app";

/**
 * Revalidate hourly. The underlying data changes weekly at most, so this is
 * about bounding staleness cheaply rather than chasing updates.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "PERM Processing Times",
  description:
    "Where DOL's PERM queue stands, from the Department's own published figures: analyst review, audit review and prevailing wage, with their as-of date.",
  alternates: { canonical: "/perm-processing-times" },
  openGraph: {
    ...openGraphBase,
    title: "PERM Processing Times | PERM Tracker",
    description:
      "DOL's published PERM and prevailing-wage queue positions, refreshed weekly and cited with DOL's own as-of date.",
    url: "/perm-processing-times",
  },
};

/** Questions taken from Google's own People Also Ask for this query set. */
const FAQ = [
  {
    question: "How long is PERM processing taking right now?",
    answer:
      "DOL publishes an average number of calendar days to a determination each month, alongside the filing month its analysts are currently working. Both carry the date DOL attached to them. The average describes cases DOL finished recently, so it describes the past rather than forecasting your case.",
  },
  {
    question: "What does the analyst review priority date mean?",
    answer:
      "It’s the month whose applications DOL is currently adjudicating. If the date reads September 2025, DOL is working through cases filed in September 2025. It’s a queue position, not a decision date, and it moves forward as DOL clears cases.",
  },
  {
    question: "Why is the prevailing wage date different from the PERM date?",
    answer:
      "They’re two separate queues at two separate stages. A prevailing wage determination comes before recruitment and before the ETA 9089 is filed, so it has its own backlog and its own published position. DOL also updates the two sections on different schedules, which is why they carry different as-of dates here.",
  },
  {
    question: "Can PERM be processed faster than the published average?",
    answer:
      "There’s no premium processing for PERM. An individual case can land either side of the average depending on whether it’s selected for audit, and audited cases sit in a separate queue that DOL publishes its own priority date for.",
  },
  {
    question: "Where does this data come from?",
    answer:
      "Directly from the Department of Labor's Office of Foreign Labor Certification, at flag.dol.gov/processingtimes. PERM Tracker reads that source weekly and stores every publication. Nothing is estimated or modelled.",
  },
];

function Figure({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="border-2 border-border bg-card p-5 shadow-hard">
      <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">{label}</p>{" "}
      <p className="mt-2 font-heading text-3xl font-black leading-none sm:text-4xl">{value}</p>{" "}
      {caption ? <p className="mt-2 text-sm text-foreground/60">{caption}</p> : null}
    </div>
  );
}

export default async function PermProcessingTimesPage() {
  const [snapshot, history, disclosure] = await Promise.all([
    fetchQuery(api.dolProcessingTimes.getLatest, {}).catch(() => null),
    fetchQuery(api.dolProcessingTimes.getHistory, { limit: 24 }).catch(() => []),
    // The quarterly files, for the decisions-per-month series. A separate
    // publication on a separate cadence, labelled as such on the page.
    fetchQuery(api.permDisclosure.getLatest, {}).catch(() => null),
  ]);

  const decisionsByMonth = disclosure?.clearanceByMonth ?? [];
  const disclosureWindow = disclosure?.sourceFiles?.length
    ? disclosure.sourceFiles
        .map((f) => f.replace(/^PERM_Disclosure_Data_/, "").replace(/\.xlsx$/, ""))
        .join(" + ")
    : null;

  const analyst = snapshot ? analystReviewQueue(snapshot.permQueues) : undefined;
  const audit = snapshot?.permQueues.find((q) => /audit review/i.test(q.queue));
  const analystAvg = snapshot ? analystReviewAverage(snapshot.permAverageDays) : undefined;
  // The chart's input: one point per stored snapshot that carries an analyst
  // queue reading. `history` is newest-first from the query; the chart sorts.
  const historyPoints = history
    .map((snap) => {
      const q = analystReviewQueue(snap.permQueues);
      return q?.priorityDate && snap.permAsOf
        ? { asOf: snap.permAsOf, frontierMonth: q.priorityDate }
        : null;
    })
    .filter((x): x is { asOf: string; frontierMonth: string } => x !== null);
  // Matched loosely like every other row on this page. Exact equality on a
  // scraped cell meant any DOL relabel ("PERM (OEWS)") silently dropped the
  // card instead of showing up as a change.
  const pwdPerm = snapshot?.pwdQueues.find((q) => /^perm\b/i.test(q.program.trim()));

  const analystMonth = formatMonth(analyst?.priorityDate ?? null);
  const permAsOf = formatAsOf(snapshot?.permAsOf);

  // Two publications, two cadences, both named. A dot is only rendered for a
  // source that actually carries a date: an "as of" with nothing behind it is
  // the exact claim this page exists to avoid making.
  //
  // They are two separate `FreshnessDots` rather than one with two items
  // BECAUSE OF A REAL DEFECT: that component maps its items to sibling spans
  // with nothing between them, so two dots reach the DOM as
  // "...August 20, 2026DOL disclosure files..." to every extractor that walks
  // it. Measured on this page. The proper fix is a separator inside
  // `Insight.tsx`; until that lands, one item each and an explicit space.
  const flagFreshness: Freshness | null =
    snapshot?.permAsOf && formatAsOf(snapshot.permAsOf)
      ? {
          label: "DOL FLAG queue page",
          asOf: formatAsOf(snapshot.permAsOf) as string,
          kind: "live",
        }
      : null;
  const disclosureFreshness: Freshness | null = disclosureWindow
    ? { label: "DOL disclosure files", asOf: disclosureWindow, kind: "window" }
    : null;

  // Measured movement: the newest snapshot against the oldest one in this
  // window. Two published dates subtracted, which keeps it a measurement rather
  // than a projection.
  //
  // "Oldest in this window", not "oldest we hold": `history` is capped at 24, so
  // once we have more than that this is the 24th-newest. The caption below says
  // exactly that rather than claiming a longer record than we are reading.
  const oldest = history.length > 1 ? history[history.length - 1] : undefined;
  const oldestAnalyst = oldest ? analystReviewQueue(oldest.permQueues) : undefined;
  const movedMonths = monthsMoved(
    oldestAnalyst?.priorityDate ?? null,
    analyst?.priorityDate ?? null,
  );
  const observedDays = daysBetween(oldest?.permAsOf, snapshot?.permAsOf);
  // `movedMonths > 0` is doing real work. Two snapshots can differ (DOL
  // refreshes the backlog counts monthly) while the analyst priority date holds,
  // which rendered "the analyst review queue advanced 0 months", and a DOL
  // correction moving the date backwards rendered "advanced -1 months". Neither
  // is a sentence worth publishing.
  const hasVelocity =
    movedMonths !== null && movedMonths > 0 && observedDays !== null && observedDays > 0;

  const breadcrumb = generateBreadcrumbSchema([
    { name: "Home", href: "/" },
    { name: "PERM Processing Times", href: "/perm-processing-times" },
  ]);

  // Dataset markup. This page is a redistribution of a government dataset with
  // provenance attached, and saying so is what makes it citable by assistants
  // rather than just crawlable.
  const datasetSchema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "DOL PERM and prevailing wage processing times",
    description:
      "Queue positions and average determination times for the US Department of Labor's PERM labor certification and prevailing wage programs, captured from DOL's published figures.",
    url: `${SITE}/perm-processing-times`,
    ...(snapshot ? { dateModified: snapshot.permAsOf } : {}),
    isBasedOn: DOL_SOURCE,
    creator: {
      "@type": "GovernmentOrganization",
      name: "Office of Foreign Labor Certification, US Department of Labor",
      url: DOL_SOURCE,
    },
    isAccessibleForFree: true,
    license: "https://www.usa.gov/government-works",
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-8 sm:pb-16">
      <DataNav active="processing-times" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />
      <JsonLdScript schema={faqSchema} />
      <JsonLdScript schema={breadcrumb} />

      <header>
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          PERM processing times
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Where the Department of Labor&apos;s queues actually stand, taken from DOL&apos;s own
          published figures and refreshed every week.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {flagFreshness ? <FreshnessDots items={[flagFreshness]} /> : null}{" "}
          {disclosureFreshness ? <FreshnessDots items={[disclosureFreshness]} /> : null}
        </div>
      </header>

      {/* Gated on the SNAPSHOT, not on the headline month. It used to require
          both, so a single unreadable cell in one DOL row collapsed the entire
          page — every table, the FAQ, the signup form — down to "Live figures
          are being fetched", which was simply false: they had been fetched,
          parsed and stored. One missing value now hides one sentence. */}
      {snapshot ? (
        <>
          {/* The headline. This one sentence is what the whole search cluster asks for. */}
          <section className="mt-10 border-2 border-border bg-tint-primary p-6 shadow-hard sm:p-8">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">
              Analyst review queue
            </p>{" "}
            <p className="mt-3 font-heading text-3xl font-black leading-tight sm:text-4xl">
              {analystMonth
                ? `DOL is reviewing PERM applications filed in ${analystMonth}.`
                : "DOL hasn’t published a filing month for the analyst review queue."}
            </p>
            {!analystMonth && analyst?.raw ? (
              <p className="mt-3 text-sm text-foreground/70">
                Its latest update prints{" "}
                <span className="font-bold">&ldquo;{analyst.raw}&rdquo;</span> in that row.
              </p>
            ) : null}
            <p className="mt-4 text-sm text-foreground/70">
              DOL&apos;s figure, as of {permAsOf}.{" "}
              <a
                href={DOL_SOURCE}
                className="font-bold underline underline-offset-2 hover:text-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source
                <ArrowSquareOut className="ml-1 inline h-3 w-3" aria-hidden="true" />
              </a>
            </p>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analystAvg?.calendarDays !== null && analystAvg?.calendarDays !== undefined ? (
              <Figure
                label="Average to a determination"
                value={`${analystAvg.calendarDays} days`}
                caption={[
                  daysAsApproxMonths(analystAvg.calendarDays),
                  `for determinations DOL issued in ${formatMonth(analystAvg.month) ?? "the reported month"}.`,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
            ) : null}

            {audit?.priorityDate ? (
              <Figure
                label="Audit review queue"
                value={formatMonth(audit.priorityDate) ?? audit.raw}
                caption="Audited cases sit in their own queue, behind the main one."
              />
            ) : null}

            {pwdPerm?.oewsReceiptDate ? (
              <Figure
                label="Prevailing wage (PERM)"
                value={formatMonth(pwdPerm.oewsReceiptDate) ?? pwdPerm.oewsReceiptDate}
                caption={`OEWS requests. Non-OEWS: ${formatMonth(pwdPerm.nonOewsReceiptDate) ?? "not reported"}.`}
              />
            ) : null}
          </section>

          {analyst?.priorityDate ? (
            <section className="mt-8">
              <h2 className="font-heading text-2xl font-black">The queue, drawn</h2>{" "}
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
                Every PERM waits in filing-month order and DOL clears the line
                oldest first. Solid months are cleared; the flag is where the
                queue stands today.
              </p>
              <QueueTape frontierMonth={analyst.priorityDate} className="mt-6" />
            </section>
          ) : null}

          {/* Measured movement. Only shown once we hold two snapshots that differ,
              because a velocity from a single observation would be invented. */}
          {hasVelocity ? (
            <section className="mt-6 border-2 border-border bg-card p-6 shadow-hard">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">
                Observed movement
              </p>{" "}
              <p className="mt-2 text-base leading-relaxed">
                Across the {observedDays} days between the two DOL publications on record
                here, the analyst review queue advanced{" "}
                <strong>
                  {movedMonths} month{movedMonths === 1 ? "" : "s"}
                </strong>
                . That’s the difference between two dates DOL published, not a forecast of
                the next one.
              </p>
            </section>
          ) : null}

          {historyPoints.length >= 2 ? (
            <section className="mt-8">
              <h2 className="font-heading text-2xl font-black">Movement on record</h2>{" "}
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
                Every reading DOL has published since we started keeping them.
                DOL shows only its current position; the record is ours.
              </p>
              <QueueHistoryChart points={historyPoints} className="mt-6" />
            </section>
          ) : null}

          {decisionsByMonth.length >= 2 ? (
            <section className="mt-12">
              <h2 className="font-heading text-2xl font-black">
                How much DOL decides in a month
              </h2>{" "}
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
                The queue position says where the line is. This says how fast
                DOL is emptying it: every determination in the quarterly
                disclosure files, counted by the month it was issued. From the
                disclosure files rather than the weekly queue page, so it lags
                by a quarter and gains a year and a half of history in return.
              </p>
              <DecisionsByMonth points={decisionsByMonth} className="mt-6" />
            </section>
          ) : null}

          <section className="mt-12">
            <h2 className="font-heading text-2xl font-black">Every PERM queue DOL publishes</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-2 border-border text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th scope="col" className="border-b-2 border-border p-3 font-black">
                      Queue
                    {" "}</th>
                    <th scope="col" className="border-b-2 border-border p-3 font-black">
                      Currently working
                    {" "}</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.permQueues.map((q) => (
                    <tr key={q.queue} className="border-b border-border/40 last:border-0">
                      <td className="p-3 font-medium">{q.queue}{" "}</td>
                      <td className="p-3 tabular-nums">{formatMonth(q.priorityDate) ?? q.raw}{" "}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-foreground/60">DOL figures as of {permAsOf}.</p>
          </section>

          {snapshot.pwdPermBacklog.length > 0 ? (
            <section className="mt-12">
              <h2 className="font-heading text-2xl font-black">
                Prevailing wage requests still pending
              </h2>{" "}
              <p className="mt-2 max-w-2xl text-foreground/70">
                PERM prevailing wage requests DOL hasn’t yet decided, by the month it received
                them{snapshot.pwdAsOf ? `, as of ${formatAsOf(snapshot.pwdAsOf)}` : ""}. A
                running total from the oldest month is what answers how many
                requests sit ahead of a given one, so each month carries one
                alongside its share of the pile.
              </p>
              <PwdBacklogChart backlog={snapshot.pwdPermBacklog} className="mt-6" />
            </section>
          ) : null}
        </>
      ) : (
        <section className="mt-10 border-2 border-border bg-card p-6 shadow-hard">
          <p className="text-base leading-relaxed">
            Live figures are being fetched from the Department of Labor. Until they land,{" "}
            <a
              href={DOL_SOURCE}
              className="font-bold underline underline-offset-2 hover:text-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              DOL publishes them directly
            </a>
            .
          </p>
        </section>
      )}

      {/* Links to the calculator rather than embedding it. Two live estimators
          on one page would compete for the same question, and this page's job
          is the reference figures. */}
      <section className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">Where does your case sit?</h2>{" "}
        <p className="mt-3 leading-relaxed text-foreground/70">
          DOL&apos;s figures describe its position across every case. The
          calculator puts your own filing month against them and shows what each
          way of measuring implies.
        </p>
        <Link
          href="/tools/perm-timeline-calculator"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
        >
          Open the processing time calculator
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {/* Outside the snapshot gate on purpose. Someone arriving on a day DOL's
          page is unreadable is exactly the person who wants to be told when it
          moves, and the form needs nothing from the snapshot to work. */}
      <section className="mt-10">
        <QueueAlertForm
          source="perm-processing-times"
          newestMonth={currentMonthUtc()}
        />
      </section>

      <section className="mt-12">
        <h2 className="font-heading text-2xl font-black">Common questions</h2>
        <dl className="mt-4 space-y-6">
          {FAQ.map((item) => (
            <div key={item.question}>
              <dt className="font-heading text-lg font-bold">{item.question}</dt>{" "}
              <dd className="mt-2 leading-relaxed text-foreground/70">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-12 border-2 border-border bg-muted p-6">
        <h2 className="font-heading text-xl font-black">Where these numbers come from</h2>{" "}
        <p className="mt-3 leading-relaxed text-foreground/70">
          Every one of these figures is published by the Office of Foreign Labor Certification
          at{" "}
          <a
            href={DOL_SOURCE}
            className="font-bold underline underline-offset-2 hover:text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            flag.dol.gov/processingtimes
          </a>
          , and carries the date DOL attached to it. We read that page weekly and keep each
          publication, because DOL overwrites its own and keeps no archive.
        </p>{" "}
        <p className="mt-3 leading-relaxed text-foreground/70">
          Nothing is modelled or extrapolated. Where a number is missing, DOL didn’t
          publish one, and we say so rather than filling the gap.
        </p>
      </section>

      <section className="mt-12 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-2xl font-black">
          These are DOL&apos;s deadlines. Yours are the ones you control.
        </h2>{" "}
        <p className="mt-3 leading-relaxed text-foreground/70">
          The queue moves when it moves. The dates that are actually in your hands are the
          recruitment window, the quiet period and the filing window, and every one of them is
          fixed arithmetic on your prevailing wage determination date. PERM Tracker computes
          them for every case you run, and warns you before the deadline that matters rather
          than after it.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-flex items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm"
        >
          Start tracking free
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-sm text-foreground/50">
          Free, and there’s no case limit. See the{" "}
          <Link href="/guides/perm-recruitment-checklist" className="underline underline-offset-2">
            recruitment checklist
          </Link>{" "}
          for the deadline math itself.
        </p>
      </section>
    </div>
  );
}
