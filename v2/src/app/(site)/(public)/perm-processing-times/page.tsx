/**
 * PERM Processing Times
 *
 * The live position of DOL's PERM and prevailing-wage queues, taken from
 * https://flag.dol.gov/processingtimes and refreshed daily.
 *
 * Why this page exists in this shape:
 *
 * DOL publishes a snapshot and overwrites it. There is no archive, so the
 * previous figures vanish the moment a new set goes up. The pages that rank
 * for these terms answer the reader's question with predictions of DOL's
 * queue, which disagree with each other by as much as nine months. We keep
 * every snapshot instead, which lets this page do two things a prediction
 * cannot: quote DOL's own number with DOL's own date, and
 * state how far the queue actually moved between two dates we hold.
 *
 * The discipline that follows from that: nothing on this page is derived,
 * modelled or extrapolated. Every figure is either printed by DOL or is
 * arithmetic on two dates DOL printed.
 *
 * TWO DOL PUBLICATIONS SIT HERE, ON TWO CADENCES. The queue positions come
 * from flag.dol.gov daily. The decisions-per-month counts come from the
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
import { withSocialCard } from "@/lib/socialCard";
import Link from "next/link";
import { queryStatic } from "@/lib/convexStatic";
import { ArrowRightIcon, ArrowSquareOutIcon } from "@phosphor-icons/react/ssr";

import { openGraphBase } from "@/lib/openGraphBase";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { currentMonthUtc, daysAsApproxMonths, daysBetween, formatAsOf, formatMonth, monthsMoved } from "@/lib/dolFormat";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "@convex/lib/dolProcessingTimes";
import { QueueAlertForm } from "./QueueAlertForm";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { QueueTape } from "@/components/tools/QueueTape";
import { DecisionsByMonth, QueueHistoryChart } from "@/components/tools/QueueHistoryChart";
import { PwdBacklogChart } from "@/components/tools/PwdBacklogChart";
import { FreshnessDots, type Freshness } from "@/components/tools/Insight";
import { getDisclosureStats } from "@/lib/db/publicData";
import { getProcessingTimes, getProcessingTimesHistory } from "@/lib/db/processingTimes";
import { dolNow, howLongSentence, queueLine } from "@/lib/dolNow";
import { getPermBoard } from "@/lib/db/board";
import { StageMedians } from "@/components/community/TimelineBoard";
import { api } from "@convex/_generated/api";
import { getEstimatorData } from "@/lib/db/estimate";

import { DataProvenance } from "@/components/data/DataProvenance";
import { Chapter } from "@/components/entities/Chapter";
import { ChapterNav } from "@/components/entities/Chapters";
import { FinePrint } from "@/components/data/FinePrint";
import { FaqList } from "@/components/tools/FaqList";
import { SITE_URL } from "@/lib/constants/site";
import { describeDisclosureFiles } from "@/lib/disclosureFiles";
import { buttonVariants } from "@/components/ui/button";
import { ScrollBox } from "@/components/ui/scroll-box";
import { cn } from "@/lib/utils";

const DOL_SOURCE = "https://flag.dol.gov/processingtimes";
// Same expression as layout.tsx, sitemap.ts, feed.xml and seo.ts. A bare
// literal here meant a preview deploy emitted Dataset markup pointing at
// production, which is a different page than the one being previewed.
const SITE = SITE_URL;

/**
 * Revalidate hourly. The underlying data changes weekly at most, so this is
 * about bounding staleness cheaply rather than chasing updates.
 */
// DOL refreshes the queue weekly; six hours is well inside that.
export const revalidate = 21600;

export const metadata: Metadata = withSocialCard({
  // The phrase people search, verbatim, then the year and the source. Search
  // Console: "perm processing time(s)" is the largest non-brand cluster;
  // "2026" answers the "perm processing times 2026" variant law-firm blogs
  // rank on. Update the
  // year in January.
  title: "PERM Processing Times 2026, Tracked Daily",
  description:
    "PERM processing times now: the filing month DOL is deciding, average days to a decision, the audit and prevailing wage queues, with DOL's own as-of date.",
  alternates: { canonical: "/perm-processing-times" },
  openGraph: {
    ...openGraphBase,
    title: "PERM Processing Times 2026, Tracked Daily | PERM Tracker",
    description:
      "DOL's published PERM and prevailing-wage queue positions, read from DOL every weekday hour and cited with DOL's own as-of date.",
    url: "/perm-processing-times",
  },
}, "perm-processing-times");

/** Stands in for the live answer to "how long", filled at render (`howLongSentence`, lib/dolNow.ts). */
const HOW_LONG_NOW = "{{howLong}}";

/** Questions taken from Google's own People Also Ask for this query set. */
const FAQ = [
  {
    question: "How long does PERM take right now?",
    answer: `${HOW_LONG_NOW} DOL's average describes cases it finished recently, so it describes the past rather than forecasting your case. The case lookup dates your own case from the cases still waiting ahead of it.`,
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
      "There’s no premium processing for PERM. An individual case can take longer if DOL issues a request for information (RFI) or selects it for audit. Audited cases sit in a separate queue that DOL publishes its own date for.",
  },
  {
    question: "Where do these numbers come from?",
    answer:
      "Directly from the Department of Labor's Office of Foreign Labor Certification, at flag.dol.gov/processingtimes, each with the date DOL attached to it. PERM Tracker reads that page daily and keeps every publication, because DOL overwrites its own and keeps no archive. Where a number is missing here, DOL didn't publish one.",
  },
];

export default async function PermProcessingTimesPage() {
  const [snapshot, history, disclosure, estimator, board, permBoard] = await Promise.all([
    getProcessingTimes(),
    getProcessingTimesHistory(24),
    // The quarterly files, for the decisions-per-month series. A separate
    // publication on a separate cadence, labelled as such on the page.
    getDisclosureStats(),
    // The reconstructed frontier. Same disclosure files, different question:
    // where the queue STOOD in each past month, which DOL publishes for today
    // only and then overwrites.
    getEstimatorData(),
    // After PERM: the community timelines' stage medians (PERM dates checked
    // against DOL, the rest self-reported). Null leaves the section out.
    queryStatic(api.communityTimelines.board, {}, revalidate).catch(() => null),
    // What the cases DOL decided on its last working day had waited: the live answer to "how long".
    getPermBoard().catch(() => null),
  ]);
  const howLong = howLongSentence(permBoard, snapshot);
  const faq = FAQ.map((f) => ({ ...f, answer: f.answer.replace(HOW_LONG_NOW, howLong) }));
  const afterPerm = board?.metrics.filter((m) => m.median !== null) ?? [];

  const decisionsByMonth = disclosure?.clearanceByMonth ?? [];
  const disclosureWindow = disclosure?.sourceFiles?.length
    ? describeDisclosureFiles(disclosure.sourceFiles)
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

  // THE SERIES DOL CANNOT GIVE YOU. Its queue page prints where the frontier
  // stands today and is overwritten on the next update, so the RATE it moves
  // at is unreadable from DOL however long you watch. Reconstructed backwards
  // instead: for every month of determinations in the disclosure files, the
  // filing month at their median. That is a second, independent measurement of
  // the same thing the stored snapshots measure, over a much longer record,
  // and the two are kept in separate sections rather than one chart because
  // they are different observations and a shared axis would imply otherwise.
  const advance = estimator.frontierAdvance;
  const reconstructed = estimator.frontierHistory;
  const reconstructedPoints = reconstructed.map((p) => ({
    asOf: `${p.decisionMonth}-01`,
    frontierMonth: p.medianFilingMonth,
  }));
  // How thin the thinnest point in the series is. Read off the series rather
  // than written into the copy: a literal here would go stale at the next
  // quarterly ingest and read as a fact while describing an old file.
  const reconstructedSpread = {
    min: Math.min(...reconstructed.map((p) => p.decisions), Infinity),
    max: Math.max(...reconstructed.map((p) => p.decisions), 0),
  };
  // Months of queue cleared per calendar month. Above 1 the queue is catching
  // up, below 1 it is falling further behind, and 1.0 exactly means it is
  // holding station while the backlog neither grows nor shrinks. Naming that
  // threshold is what makes the figure readable.
  const advanceVerdict =
    advance === null
      ? null
      : advance.rate > 1.05
        ? "gaining on the backlog"
        : advance.rate < 0.95
          ? "falling further behind"
          : "holding station";


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
    // "Organization", NOT "GovernmentOrganization". Search Console flags the
    // subtype as "Invalid object type for field creator". The subtype is
    // perfectly valid schema.org - GovernmentOrganization IS an Organization -
    // but Google's Dataset parser matches the type literally and does not walk
    // the hierarchy, so the more precise answer was the rejected one. The name
    // still says which agency, so no information is lost.
    creator: {
      "@type": "Organization",
      name: "Office of Foreign Labor Certification, US Department of Labor",
      url: DOL_SOURCE,
    },
    isAccessibleForFree: true,
    // usa.gov/government-works, NOT this site's terms, and that is deliberate.
    // The two are the two layers §6 of the Terms now separates. THIS dataset is
    // DOL's own published table, transcribed: a work of the United States
    // Government, which under 17 U.S.C. 105 carries no copyright and which we
    // claim nothing over. The datasets that DO point at /terms#intellectual-
    // property are our compilations - the case corpus, the resolved entities,
    // the derived statistics - where the selection and arrangement is ours.
    // Do not "fix" this one to match the others.
    license: "https://www.usa.gov/government-works",
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  // The parts the bar jumps to, in page order; a part with nothing to draw is left off both.
  const chapters = [
    ...(historyPoints.length >= 2 ? [{ id: "movement", label: "Movement" }] : []),
    ...(advance && reconstructedPoints.length >= 2 ? [{ id: "pace", label: "Pace" }] : []),
    ...(decisionsByMonth.length >= 2 ? [{ id: "decisions", label: "Decisions per month" }] : []),
    { id: "queues", label: "Every queue" },
    { id: "your-case", label: "Your case" },
    { id: "questions", label: "FAQs" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-8 sm:pb-16">      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={datasetSchema} />
      <JsonLdScript schema={faqSchema} />

      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          PERM processing times
        </h1>{" "}
        {/* The answer first, as DOL published it and dated: the sentence a search
            result or an AI answer quotes for "PERM processing time". */}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          {queueLine(dolNow(snapshot))}
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
          {/* The answer, as the page's one object, with its picture: DOL's
              tape of filing months and where it is on it. */}
          <section className="object mt-8 p-5 sm:p-7">
            <p className="text-sm font-semibold">The analyst review queue</p>{" "}
            <p className="mt-2 font-heading text-3xl font-bold leading-tight sm:text-4xl">
              {analystMonth
                ? `DOL is reviewing PERM applications filed in ${analystMonth}.`
                : "DOL hasn’t published a filing month for the analyst review queue."}
            </p>
            {!analystMonth && analyst?.raw ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Its latest update prints{" "}
                <span className="font-bold">&ldquo;{analyst.raw}&rdquo;</span> in that row.
              </p>
            ) : null}
            {analyst?.priorityDate ? (
              <QueueTape frontierMonth={analyst.priorityDate} className="mt-6" monthsBehind={6} monthsAhead={10} />
            ) : null}{" "}
            <p className="mt-4 text-sm text-muted-foreground">
              DOL&apos;s figure, as of {permAsOf}.{" "}
              <a
                href={DOL_SOURCE}
                className="link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Source
                <ArrowSquareOutIcon className="ml-1 inline h-3 w-3" aria-hidden="true" />
              </a>
            </p>
          </section>

          <FigureRow className="mt-8">
            {analystAvg?.calendarDays !== null && analystAvg?.calendarDays !== undefined ? (
              <Figure
                label="Average to a determination"
                value={`${analystAvg.calendarDays} days`}
                note={[
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
                note="Audited cases sit in their own queue, behind the main one."
              />
            ) : null}

            {pwdPerm?.oewsReceiptDate ? (
              <Figure
                label="Prevailing wage (PERM)"
                value={formatMonth(pwdPerm.oewsReceiptDate) ?? pwdPerm.oewsReceiptDate}
                note={`OEWS requests. Non-OEWS: ${formatMonth(pwdPerm.nonOewsReceiptDate) ?? "not reported"}.`}
              />
            ) : null}
          </FigureRow>


          <ChapterNav items={chapters} className="mt-12" />{" "}

          {/* Measured movement goes in the dek only once two snapshots differ,
              because a velocity from a single observation would be invented. */}
          {historyPoints.length >= 2 ? (
            <Chapter
              id="movement"
              title="How the queue has moved"
              dek={
                hasVelocity ? (
                  <>
                    Across the {observedDays} days between the two DOL publications on record here, the analyst
                    review queue advanced{" "}
                    <strong className="text-foreground">
                      {movedMonths} month{movedMonths === 1 ? "" : "s"}
                    </strong>
                    .
                  </>
                ) : (
                  "Every reading DOL has published since this site started keeping them."
                )
              }
            >
              <QueueHistoryChart points={historyPoints} className="mt-6" />
            </Chapter>
          ) : null}

          {advance && reconstructedPoints.length >= 2 ? (
            <Chapter
              id="pace"
              title="How fast it advances"
              dek="DOL publishes where the queue stands and overwrites it, so its own pages can never say how fast it is moving."
            >
              {/* Method, not correction: it says how the series was built
                  rather than changing how the rate reads, so it collapses.
                  `<details>` keeps every word in the DOM. */}
              <FinePrint summary="How this is measured" className="mt-3">
                <p>
                  Reconstructed from the determination dates in the disclosure
                  files: for each month DOL issued decisions, the filing month
                  at their median. It is the same frontier the section above
                  tracks, measured a second way and much further back.
                </p>
              </FinePrint>

              <div className="dark mt-6 p-6 sm:p-8 border-2 shadow-hard border-black bg-[#141414] text-foreground">
                <p className="text-sm text-muted-foreground">Measured advance</p>{" "}
                {/* The rate carries its verdict's colour: green gaining, amber
                    holding, red falling behind. The words below say the same,
                    so nothing rests on colour alone. */}
                <p
                  className={cn(
                    "mt-3 font-heading text-4xl font-bold leading-none tabular-nums sm:text-5xl",
                    advance.rate > 1.05
                      ? "text-primary-text"
                      : advance.rate < 0.95
                        ? "text-data-bad-ink"
                        : "text-data-warn-ink",
                  )}
                >
                  {advance.rate.toFixed(2)}
                  <span className="ml-1 text-3xl sm:text-4xl">×</span>
                </p>{" "}
                {advance.slowest !== null && advance.fastest !== null ? (
                  <AdvanceScale rate={advance.rate} slowest={advance.slowest} fastest={advance.fastest} />
                ) : null}
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-soft">
                  months of filing queue cleared per calendar month, over the{" "}
                  {advance.pointsUsed} determination months to{" "}
                  {formatMonth(advance.toMonth) ?? advance.toMonth}. At 1.00× the
                  queue holds station, so at {advance.rate.toFixed(2)}× it is{" "}
                  <strong className="text-foreground">{advanceVerdict}</strong>.
                </p>
                {advance.slowest !== null && advance.fastest !== null ? (
                  <p className="mt-3 max-w-2xl text-base leading-relaxed text-soft">
                    It has ranged from {advance.slowest.toFixed(2)}× to{" "}
                    {advance.fastest.toFixed(2)}× over rolling three-month
                    windows, so it describes the past rather than predicting a case.
                  </p>
                ) : null}
              </div>

              <div className="mt-6">
                <QueueHistoryChart points={reconstructedPoints} kind="reconstructed" />
              </div>
              <FinePrint summary="Which files, and how solid each point is" className="mt-3">
                <p>
                  Reconstructed from{" "}
                  {disclosureWindow ? `DOL's disclosure files for ${disclosureWindow}` : "the quarterly disclosure files"}, so it
                  ends where those files end and is a quarter behind the
                  readings above. Its points aren&apos;t equally solid either:
                  the thinnest month in the series is a median over{" "}
                  {reconstructedSpread.min.toLocaleString("en-US")} decisions
                  and the fullest over{" "}
                  {reconstructedSpread.max.toLocaleString("en-US")}. Every
                  month&apos;s count is in the next part.
                </p>
              </FinePrint>
            </Chapter>
          ) : null}

          {decisionsByMonth.length >= 2 ? (
            <Chapter
              id="decisions"
              title="How much DOL decides in a month"
              dek="Every determination in DOL's quarterly disclosure files, counted by the month it was issued. Those files run a quarter behind the queue page."
            >
              <DecisionsByMonth points={decisionsByMonth} className="mt-6" />
            </Chapter>
          ) : null}

          <Chapter
            id="queues"
            title="Every queue DOL publishes"
            dek={`DOL's figures as of ${permAsOf}: the filing month each PERM queue is working, and the wage requests still waiting.`}
          >
            <ScrollBox label="Where each DOL queue stands" className="mt-6">
              <table className="w-full border-t-2 border-[var(--object-border)] text-left text-sm">
                <thead className="bg-sage">
                  <tr>
                    <th scope="col" className="border-b-2 border-border p-3 font-bold">
                      Queue
                    {" "}</th>
                    <th scope="col" className="border-b-2 border-border p-3 font-bold">
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
            </ScrollBox>
          {snapshot.pwdPermBacklog.length > 0 ? (
            <div className="mt-10">
              <h3 className="font-heading text-xl font-bold">
                Prevailing wage requests still pending
              </h3>{" "}
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Requests DOL hasn&apos;t decided yet, by the month it received
                them{snapshot.pwdAsOf ? `, as of ${formatAsOf(snapshot.pwdAsOf)}` : ""}.
                Each month&apos;s running total is how many sit ahead of it.
              </p>
              <PwdBacklogChart backlog={snapshot.pwdPermBacklog} className="mt-6" />
            </div>
          ) : null}
          </Chapter>
        </>
      ) : (
        <section className="mt-10 bg-sage p-6 border-2 shadow-hard border-border">
          <p className="text-base leading-relaxed">
            Live figures are being fetched from the Department of Labor. Until they land,{" "}
            <a
              href={DOL_SOURCE}
              className="link"
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
      <Chapter
        id="your-case"
        title="Where your case sits"
        dek="Your own filing month against these figures, the steps after PERM as people report them, and an email when DOL reaches your month."
      >
      <section className="mt-6 border-2 shadow-hard p-6 sm:p-8 bg-card border-border">
        <h3 className="font-heading text-2xl font-bold">Your filing month, against the queue</h3>{" "}
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The calculator reads your own filing month against these figures.
        </p>
        <Link
          href="/tools/perm-timeline-calculator"
          className={buttonVariants({ variant: "outline", size: "lg", className: "mt-6" })}
        >
          Estimate your decision date
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {/* AFTER PERM, as the people waiting report it. DOL publishes nothing
          per case once the PERM is certified, so this is the only way to show
          the I-140, I-485 and card steps; it says which half is checked. */}
      {board ? (
        <section aria-labelledby="after-perm-h" className="mt-10 border-2 shadow-hard p-6 sm:p-8 bg-card border-border">
          <h3 id="after-perm-h" className="font-heading text-2xl font-bold">After PERM, as people report it</h3>{" "}
          {afterPerm.length > 0 ? (
            <>
              <p className="mt-2 max-w-2xl text-base text-muted-foreground">
                From {board.total.toLocaleString("en-US")} shared timelines: the PERM dates are checked against
                DOL&apos;s record, and everything after is self-reported.
              </p>
              <div className="mt-5">
                <StageMedians metrics={board.metrics} />
              </div>
            </>
          ) : (
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
              Not enough reports yet for a median at any step. Add yours from a certified case&apos;s page; the PERM
              half is filled in from DOL&apos;s record.
            </p>
          )}{" "}
          <Link
            href="/green-card-timelines"
            className="link mt-4 inline-flex min-h-[44px] items-center"
          >
            All green card timelines
          </Link>
        </section>
      ) : null}

      {/* Outside the snapshot gate on purpose. Someone arriving on a day DOL's
          page is unreadable is exactly the person who wants to be told when it
          moves, and the form needs nothing from the snapshot to work. */}
      <section className="mt-10">
        <QueueAlertForm
          source="perm-processing-times"
          newestMonth={currentMonthUtc()}
          frontierMonth={analyst?.priorityDate ?? undefined}
        />
      </section>
      </Chapter>

      {/* Where the numbers come from is one of the questions (round 3, Oct 15
          2026: it had a section of its own). */}
      <Chapter id="questions" title="FAQs">
        <FaqList items={faq.map((item) => ({ q: item.question, a: item.answer }))} openFirst={false} />

      <section className="mt-12 border-2 shadow-hard p-6 sm:p-8 bg-card border-border">
        <h3 className="font-heading text-2xl font-bold">
          The deadlines you control
        </h3>{" "}
        <p className="mt-3 leading-relaxed text-muted-foreground">
          The recruitment window, the quiet period and the filing window are
          fixed arithmetic on your prevailing wage determination date. PERM
          Tracker computes them per case and reminds you before each one.
        </p>
        <Link
          href="/signup"
          className={buttonVariants({ variant: "outline", size: "lg", className: "mt-6" })}
        >
          Start tracking free
          <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
        </Link>
        <p className="mt-3 text-sm text-muted-foreground">
          There’s no case limit. See the{" "}
          <Link href="/guides/perm-recruitment-checklist" className="link">
            recruitment checklist
          </Link>{" "}
          for the deadline math itself.
        </p>
      </section>
      </Chapter>
      <DataProvenance datasets={["processing-times"]} />
    </div>
  );
}

/**
 * The measured rate on its own range: red where the queue falls behind (under
 * 0.95), amber where it holds station, green where it gains (over 1.05), the
 * slowest and fastest rolling windows at the ends, and today's rate marked.
 */
function AdvanceScale({ rate, slowest, fastest }: { rate: number; slowest: number; fastest: number }) {
  const lo = Math.min(slowest, rate, 0.9);
  const hi = Math.max(fastest, rate, 1.1);
  const at = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(2)}%`;
  return (
    <div className="mt-5 max-w-xl" aria-hidden="true">
      <div className="relative h-3 border-2 border-white/80">
        <span className="absolute inset-y-0 left-0 bg-data-bad" style={{ width: at(0.95) }} />{" "}
        <span className="absolute inset-y-0 bg-data-warn" style={{ left: at(0.95), width: `calc(${at(1.05)} - ${at(0.95)})` }} />{" "}
        <span className="absolute inset-y-0 right-0 bg-primary" style={{ left: at(1.05) }} />{" "}
        <span className="absolute -top-2 -bottom-2 w-1 -translate-x-1/2 bg-white" style={{ left: at(rate) }} />
      </div>
      <div className="relative mt-1.5 h-5 text-sm tabular-nums text-soft">
        <span className="absolute left-0">{slowest.toFixed(2)}×</span>{" "}
        <span className="absolute -translate-x-1/2" style={{ left: at(1) }}>1.00×</span>{" "}
        <span className="absolute right-0">{fastest.toFixed(2)}×</span>
      </div>
    </div>
  );
}
