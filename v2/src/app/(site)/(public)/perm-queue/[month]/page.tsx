import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, WarningIcon } from "@phosphor-icons/react/ssr";

import { ChartTips } from "@/components/data/ChartTips";
import { DataProvenance } from "@/components/data/DataProvenance";
import { SourceNote } from "@/components/queue/SourceNote";
import { DecidedList, PendingCensus } from "@/components/queue/PendingCensus";
import { OctoberNote, OCTOBER_2025 } from "@/components/queue/OctoberNote";
import { StageBar, StageLegend } from "@/components/queue/StageBar";
import { groupByStage } from "@/components/queue/stages";
import { currentMonthUtc, formatAsOf, formatMonth, monthsMoved } from "@/lib/dolFormat";
import { MIRROR_COMPLETE, PROVISIONAL_NOTICE } from "@/lib/liveQueueGate";
import {
  getAdjacentMonths,
  getMonthBacklog,
  getPendingBefore,
} from "@/lib/turso/backlog";
import { getEstimatorData } from "@/lib/turso/estimate";
import { getLiveRemainderSummary, listLiveCases } from "@/lib/turso/liveCases";
import { LiveCaseBrowser } from "@/components/tools/LiveCaseBrowser";
import { SearchParamsBoundary } from "@/hooks/useUrlSearchParams";
import { openGraphBase } from "@/lib/openGraphBase";
import { formatInt } from "@/lib/format";
import { CaseNextStep } from "@/components/tools/CaseNextStep";
import { getLiveBacklog } from "@/lib/turso/publicData";
import { getDecisionPace } from "@/lib/turso/decisionPace";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";
import { monthEndDate, type MonthEnd } from "@/lib/caseEstimateInputs";
import { monthMakeup, type MonthMakeup } from "@/lib/monthMakeup";
import { dolDecisions, weekOnWeek, type MonthDetail } from "@/lib/monthDetail";
import { getMonthDetail } from "@/lib/turso/monthDetail";
import { formatShare } from "@/lib/format";
import { QueueAlertForm } from "../../perm-processing-times/QueueAlertForm";

/**
 * One filing month, split across the queues DOL actually runs.
 *
 * THE SPLIT IS THE WHOLE POINT. Analyst review is the ordinary queue where
 * waiting is the entire story; an information request, an audit or supervised
 * recruitment takes a case OUT of filing order, which is the honest answer to
 * "DOL passed my month and I still have nothing".
 *
 * THE SECOND THING THIS PAGE OWES A READER is where their month sits relative
 * to DOL's own published position, because that is the difference between "my
 * turn has come and mine is one of the stragglers" and "DOL has not reached
 * my month at all yet". Those feel identical from inside and they are not the
 * same situation.
 *
 * WHAT IT REFUSES. No date, no estimate, no "you should hear by". The queue
 * ahead is a count of real pending cases and the frontier is DOL's own
 * figure; turning either into a date for one case is the line this whole
 * product exists on the correct side of.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  // Both misses are decided at the earliest point, and the segment has no
  // loading boundary above it (there is no shared (public)/loading.tsx) -
  // with a boundary, Next streams a 200 before any page code runs and a
  // notFound() can never change the status. The backlog read dedupes with
  // the page's own (getLiveCensus is React-cached), so this costs no extra
  // query.
  if (!MONTH_RE.test(month)) notFound();
  const peek = await getMonthBacklog(month);
  if (!peek || peek.total === 0) notFound();
  const label = formatMonth(month) ?? month;
  // The month leads: someone who filed in it searches for it.
  const title = `${label} PERM Filings: Where They Stand`;
  return withSocialCard({
    title,
    // 143 characters at the longest month name (September).
    description: `How many PERM cases filed in ${label} are still undecided, which DOL queue they're in, and how much of the backlog sits in front of them.`,
    alternates: { canonical: `/perm-queue/${month}` },
    robots: MIRROR_COMPLETE ? undefined : { index: false, follow: true },
    openGraph: { ...openGraphBase, title: `${title} | PERM Tracker`, url: `/perm-queue/${month}` },
  }, "perm-queue");
}

// Six hours, matching /perm-queue. This route is ~39 generated pages, so the
// old hourly window was ~936 regenerations a day on its own, against a census
// that is rebuilt once daily. See the note on the parent route: ISR writes bill
// in 8 KB units and these pages are ~289 KB, so the waste was real money rather
// than a rounding error.
export const revalidate = 21600;

/**
 * No month is built ahead; each is built on its first request and cached for
 * the window above. Without this export the route renders fresh on EVERY
 * request despite `revalidate`: Next treats a dynamic segment with no
 * generateStaticParams as dynamic, so these pages would be served
 * `private, no-store` at 1 to 1.5 s each. `dynamic-routes-cache.test.ts`
 * holds every route.
 */
export async function generateStaticParams(): Promise<{ month: string }[]> {
  return [];
}

/**
 * How many of the month's live rows the page lists before pointing at the
 * full list on /perm-cases. A busy month holds ~14,500 filings; the whole set
 * belongs in the paginated browser, not in a prerendered page written whole
 * to the page cache on every regeneration.
 */
const MONTH_LIST_MAX = 50;

export default async function CohortPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  // Shape-checked before the query: the month goes into SQL, and a route
  // segment is caller input however ordinary it looks.
  if (!MONTH_RE.test(month)) notFound();

  // `getEstimatorData` is heavier than this page strictly needs: it also
  // hydrates the entity heads for the timeline calculator, and only DOL's
  // published analyst-review row is read here. It is used anyway, because the
  // alternative is a second copy of "which of DOL's queue rows is analyst
  // review" living on this page, and the day those two disagree the queue
  // board and the calculator start quoting different frontiers for one thing.
  // The extra reads are three indexed lookups an hour per month page.
  const [backlog, ahead, adjacent, estimator, allMonths, pace, sweep, detail] = await Promise.all([
    getMonthBacklog(month),
    getPendingBefore(month),
    getAdjacentMonths(month),
    getEstimatorData(),
    getLiveBacklog().catch(() => []),
    getDecisionPace().catch(() => null),
    getSweepCoverage().catch(() => null),
    getMonthDetail(month).catch(() => null),
  ]);
  if (!backlog || backlog.total === 0) notFound();
  const makeup = monthMakeup(backlog.statuses);
  const end = monthEndDate({
    backlog: allMonths,
    month,
    pace: pace?.pace ?? null,
    frontierMonth: estimator.frontier?.analystQueueMonth ?? null,
    sweepFinishedOn: sweep?.finishedOn ?? null,
    today: new Date().toISOString().slice(0, 10),
  });

  // The month's LIVE rows: every case filed this month that DOL's published
  // files do not hold yet, pending or decided, from the same table the case
  // search reads. Withheld under the review-stage floor, for the same reason:
  // a case number beside an employer and a job title, in a cohort of three,
  // is a person. The census above counts published cases too, so the two
  // totals differ on purpose and the copy says which is which.
  const remainder = await getLiveRemainderSummary();
  const liveMonth = remainder?.byMonth.find((m) => m.month === month) ?? null;
  // The first page of the month's live cases, server-rendered as the
  // browser's seed: the rows read before hydration and crawlers see them.
  // Every month lists its cases, however few.
  const seedPage = liveMonth && liveMonth.total > 0
    ? await listLiveCases({ kind: "all", month, numItems: MONTH_LIST_MAX })
    : null;
  const liveRows = seedPage?.rows ?? [];

  const split = groupByStage(backlog.statuses);
  const label = formatMonth(month) ?? month;
  const dolMonth = estimator.frontier?.analystQueueMonth ?? null;
  const dolAsOf = estimator.frontier ? formatAsOf(estimator.frontier.asOf) : null;
  const isNoted = month === OCTOBER_2025.month;
  // An alert on a month DOL has already reached would fire at once, so the
  // form is offered only for a month still ahead of DOL.
  const awaitingDol = dolMonth !== null && month > dolMonth;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 sm:pb-16">      <div className="pt-10 sm:pt-12" />

      <header>
        <h1 className="font-heading text-4xl font-black leading-tight sm:text-5xl">
          Filed {label}
        </h1>{" "}
        <MonthHeadline makeup={makeup} label={label} end={end} />{" "}
        <SourceNote className="mt-4 text-base leading-relaxed text-foreground/70" />
      </header>{" "}

      {detail && dolDecisions(detail.days) >= 50 ? <MonthActivity detail={detail} label={label} month={month} /> : null}{" "}

      {!MIRROR_COMPLETE ? (
        <p className="mt-8 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base text-foreground/80">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>{PROVISIONAL_NOTICE}</span>
        </p>
      ) : null}

      {isNoted ? (
        <div className="mt-8">
          <OctoberNote />
        </div>
      ) : null}

      <section className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          Where this month sits
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          <FrontierSentence month={month} dolMonth={dolMonth} dolAsOf={dolAsOf} />
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          {ahead > 0 ? (
            <>
              <b className="font-bold">{formatInt(ahead)}</b> cases filed before{" "}
              {label} were undecided at their last check, so that&rsquo;s what
              sits in front of this month, counting only cases DOL still has to
              decide. Some will have been decided since, so it runs a little
              high. It isn&rsquo;t divided into a wait: the{" "}
              <Link
                href="/tools/perm-timeline-calculator"
                className="font-bold underline underline-offset-2 hover:text-primary"
              >
                timeline calculator
              </Link>{" "}
              gives the envelope, from the spread of cases DOL has actually
              decided.
            </>
          ) : (
            <>
              Nothing filed before {label} is still undecided, so this month has
              no queue in front of it.
            </>
          )}
        </p>
      </section>{" "}

      {/* What most visitors to a month page want next: their own case, and
          an email when DOL gets to their month. */}
      <CaseNextStep
        question={`Filed in ${label}?`}
        extra={awaitingDol ? { href: "#queue-alert", label: `Or get an email when DOL reaches ${label}` } : null}
        source="queue-month-page"
        className="mt-6"
      />{" "}

      <details className="mt-6 border-2 border-border bg-card">
        <summary className="flex min-h-12 cursor-pointer items-center px-5 py-3 font-heading text-lg font-black">
          {`Every status, pending and decided, and the ${label} cases themselves`}
        </summary>
        <div className="border-t-2 border-border px-4 pb-6 sm:px-5">
      <section className="mt-6">
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          Still pending
        </h2>{" "}
        <p className="mt-2 text-base leading-relaxed text-foreground/80">
          {split.ordinary > 0 ? (
            <>
              {split.outOfOrder.length > 0 ? (
                <>
                  {formatInt(split.ordinary)} of them are in analyst review, the
                  ordinary queue that moves in filing order. The rest are in
                  queues that take a case out of that order, so their wait
                  doesn&rsquo;t follow the month.
                </>
              ) : (
                <>
                  All of them are in analyst review, the ordinary queue that
                  moves in filing order.
                </>
              )}
            </>
          ) : (
            <>
              None of them are in analyst review, the ordinary queue that moves
              in filing order. Every one is in a queue that takes a case out of
              that order, so their wait doesn&rsquo;t follow the month.
            </>
          )}
        </p>

        {split.pending > 0 ? (
          <>
            <ChartTips label={`Pending cases filed in ${label}, by stage`} className="mt-6">
              <StageBar stages={split.stages} scale="composition" tipHeading={`Filed in ${label}`} />
            </ChartTips>
            <StageLegend stages={split.stages} className="mt-4" />
            <div className="mt-8 border-t-2 border-border pt-6">
              <PendingCensus
                stages={split.stages}
                caption={`Every DOL status a pending case filed in ${label} was last seen in, grouped by queue`}
              />
            </div>
          </>
        ) : (
          <p className="mt-6 border-2 border-border bg-background p-4 text-base text-foreground/80">
            Every application filed in {label} has a decision. There is nothing
            left in the queue for this month.
          </p>
        )}
      </section>{" "}

      <section className="mt-6">
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          Already decided
        </h2>{" "}
        <p className="mt-2 text-base leading-relaxed text-foreground/80">
          {formatInt(backlog.decided)} of the {formatInt(backlog.total)} applications filed
          in {label} {backlog.decided === 1 ? "has" : "have"} a final
          determination.{" "}
          <WithdrawalNote decided={split.decided} />
        </p>
        <div className="mt-6">
          <DecidedList statuses={split.decided} />
        </div>
      </section>{" "}

      <section className="mt-6">
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          Who filed in {label}
        </h2>{" "}
        {liveMonth ? (
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            {formatInt(liveMonth.total)} of the {formatInt(backlog.total)} {label} filings{" "}
            {liveMonth.total === 1 ? "isn't" : "aren't"} in DOL&apos;s published
            files yet: {formatInt(liveMonth.pending)} still waiting, {formatInt(liveMonth.decided)}{" "}
            decided since the last file. DOL&apos;s daily check gives the employer,
            job title and status. Everything else arrives when DOL publishes the
            case.
          </p>
        ) : (
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            Every {label} filing is in DOL&apos;s published files. The{" "}
            <Link
              href="/perm-cases"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              case search
            </Link>{" "}
            has them, with the wage, firm and decision date.
          </p>
        )}
        {liveMonth && liveMonth.total > 0 ? (
          <div className="mt-5">
            {/* The browser reads the URL, so it needs a boundary whose
                fallback is the browser itself (see SearchParamsBoundary). */}
            <SearchParamsBoundary>
              <LiveCaseBrowser
                summary={remainder}
                publishedThrough={remainder?.publishedThrough ?? null}
                fixedMonth={month}
                seed={seedPage}
              />
            </SearchParamsBoundary>
          </div>
        ) : null}
        {liveMonth && liveRows.length > 0 ? (
          <p className="mt-4 text-base leading-relaxed">
            <Link
              href={`/perm-cases?filed=${month}#live`}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              All {formatInt(liveMonth.total)} live {label} filings, pending and decided
            </Link>
            , newest first. DOL doesn&apos;t decide a month in filing order,
            so decisions won&apos;t follow this list.
          </p>
        ) : null}
      </section>{" "}

        </div>
      </details>{" "}

      {awaitingDol ? (
        <section id="queue-alert" className="mt-8 scroll-mt-[calc(var(--site-header-max-h,4.5rem)+1rem)]">
          <QueueAlertForm
            source="queue-month-page"
            newestMonth={currentMonthUtc()}
            frontierMonth={dolMonth ?? undefined}
            defaultMonth={month}
          />
        </section>
      ) : null}{" "}

      <nav
        aria-label="Nearby filing months"
        className="mt-8 flex flex-wrap items-stretch justify-between gap-3"
      >
        {adjacent.previous ? (
          <SiblingLink month={adjacent.previous} direction="previous" />
        ) : (
          <span />
        )}{" "}
        {adjacent.next ? (
          <SiblingLink month={adjacent.next} direction="next" />
        ) : (
          <span />
        )}
      </nav>{" "}

      {/* `perm-cases` only when the October note is on the page: that note
          quotes DOL's first-party quarterly release, and a dataset listed on
          a page that does not use it is provenance noise. */}
      <DataProvenance
        datasets={
          isNoted
            ? ["perm-case-status", "processing-times", "perm-cases"]
            : ["perm-case-status", "processing-times"]
        }
        className="mt-8 border-t-2 border-border pt-4"
      />
    </div>
  );
}

/**
 * This month against DOL's published analyst-review position.
 *
 * Three genuinely different situations, and conflating any two of them is the
 * failure this component exists to avoid. "DOL has worked past your month"
 * and "DOL has not reached your month" both look like silence from where the
 * applicant is standing.
 */
/**
 * "a" or "an" for a month name.
 *
 * The article was hardcoded to "a" and the first page anyone looked at was
 * October, which read "carry a October 2025 filing date". April and August
 * have the same problem and eight other months do not, so it survives every
 * spot check that happens to land on one of the eight.
 */
function article(label: string): string {
  return /^[aeiou]/i.test(label) ? "an" : "a";
}

function FrontierSentence({
  month,
  dolMonth,
  dolAsOf,
}: {
  month: string;
  dolMonth: string | null;
  dolAsOf: string | null;
}) {
  if (dolMonth === null) {
    return (
      <>
        DOL published no readable analyst-review priority date at its last
        update, so there&rsquo;s no official position to place this month
        against.
      </>
    );
  }
  const dolLabel = formatMonth(dolMonth) ?? dolMonth;
  const stamp = dolAsOf ? ` as of ${dolAsOf}` : "";
  const gap = monthsMoved(dolMonth, month);

  if (month === dolMonth) {
    return (
      <>
        DOL publishes <b className="font-bold">{dolLabel}</b> as the filing
        month its analyst review is working{stamp}. This is that month.
      </>
    );
  }
  if (month < dolMonth) {
    return (
      <>
        DOL publishes <b className="font-bold">{dolLabel}</b> as the filing
        month its analyst review is working{stamp}, so it has worked past{" "}
        {formatMonth(month) ?? month}. Anything still open here is behind the
        main queue rather than waiting for its turn.
      </>
    );
  }
  return (
    <>
      DOL publishes <b className="font-bold">{dolLabel}</b> as the filing month
      its analyst review is working{stamp}.{" "}
      {gap !== null ? (
        <>
          {formatMonth(month) ?? month} is {gap}{" "}
          {gap === 1 ? "month" : "months"} ahead of that, so DOL hasn&rsquo;t
          reached it yet.
        </>
      ) : (
        <>
          {formatMonth(month) ?? month} is ahead of that, so DOL hasn&rsquo;t
          reached it yet.
        </>
      )}
    </>
  );
}

/**
 * What a small "decided" share on an unreached month actually consists of.
 *
 * MEASURED, AND IT CHANGES HOW THE PERCENTAGE READS. Every filing month from
 * November 2025 onward sits at 1% to 4% decided, which looks like DOL having
 * started work. It isn't: 98% to 100% of those determinations are
 * withdrawals, which an employer files, and several of those months have zero
 * certifications. A reader who takes "3% decided" as adjudication progress has
 * been misled by a true number.
 *
 * The threshold is deliberately high and the sentence only appears when the
 * data supports it, because on a month DOL really has worked the same
 * sentence would be false.
 */
function WithdrawalNote({
  decided,
}: {
  decided: readonly { status: string; count: number }[];
}) {
  const total = decided.reduce((n, s) => n + s.count, 0);
  const withdrawn = decided
    .filter((s) => s.status.toUpperCase() === "WITHDRAWN")
    .reduce((n, s) => n + s.count, 0);
  if (total === 0 || withdrawn / total < 0.8) return null;
  const other = total - withdrawn;
  return (
    <>
      {formatInt(withdrawn)} of those are withdrawals, which an employer files rather
      than DOL issuing a determination.{" "}
      {other === 0 ? (
        <>Nothing filed this month has been certified or denied yet.</>
      ) : (
        <>
          {formatInt(other)} {other === 1 ? "is a certification or a denial" : "are certifications or denials"}.
        </>
      )}
    </>
  );
}

function SiblingLink({
  month,
  direction,
}: {
  month: string;
  direction: "previous" | "next";
}) {
  const label = formatMonth(month) ?? month;
  const Icon = direction === "previous" ? ArrowLeftIcon : ArrowRightIcon;
  return (
    <Link
      href={`/perm-queue/${month}`}
      className="flex min-h-11 items-center gap-2 border-2 border-border bg-card px-4 py-2 text-base font-bold shadow-hard-sm hover:text-primary"
    >
      {direction === "previous" ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}{" "}
      <span>
        <span className="block font-mono text-sm font-normal uppercase tracking-wider text-foreground/70">
          {direction === "previous" ? "Filed earlier" : "Filed later"}
        </span>{" "}
        <span>{label}</span>
      </span>{" "}
      {direction === "next" ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

const longDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

/**
 * The month in one number first: the share DOL has decided, the split as one
 * bar, then three tiles. Every figure is the census's, the same counts the
 * folded tables below carry, so the headline can't disagree with them.
 */
function MonthHeadline({ makeup: m, label, end }: { makeup: MonthMakeup; label: string; end: MonthEnd | null }) {
  const pct = m.total ? m.decided / m.total : 0;
  const parts = [
    { key: "certified", n: m.certified + m.otherDecided, cls: "bg-data-good-ink", text: "certified" },
    { key: "denied", n: m.denied, cls: "bg-data-bad-ink", text: "denied" },
    { key: "withdrawn", n: m.withdrawn, cls: "bg-data-none-ink", text: "withdrawn by the employer" },
    { key: "line", n: m.inLine, cls: "bg-foreground", text: "in DOL's line" },
    { key: "outside", n: m.outside, cls: "bg-data-warn-ink", text: "on hold, at an RFI or on appeal" },
  ].filter((p) => p.n > 0);
  return (
    <div className="mt-5">
      <p className="font-heading text-5xl font-black tabular-nums tracking-tight sm:text-6xl">
        {formatShare(pct)} <span className="text-2xl sm:text-3xl">decided</span>
      </p>{" "}
      <p className="mt-2 text-lg text-foreground/80">
        {`${formatInt(m.decided)} of the ${formatInt(m.total)} applications filed in ${label} have a decision.`}
      </p>{" "}
      <ChartTips label={`Applications filed in ${label}, by where they stand`} className="mt-5">
        <div className="flex h-6 w-full border-2 border-border bg-muted" role="img" aria-label={parts.map((p) => `${formatInt(p.n)} ${p.text}`).join(", ")}>
          {parts.map((p) => (
            <span
              key={p.key}
              className={`block h-full ${p.cls}`}
              style={{ width: `${(p.n / m.total) * 100}%` }}
              data-tip={`${formatInt(p.n)} ${p.text}`}
            />
          ))}
        </div>
      </ChartTips>{" "}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p) => (
          <Fragment key={p.key}>{" "}
          <li className="flex items-center gap-2">
            <span className={`inline-block size-3 border border-border ${p.cls}`} aria-hidden="true" />{" "}
            {`${formatInt(p.n)} ${p.text}`}
          </li>
          </Fragment>
        ))}
      </ul>{" "}
      <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="border-2 border-border bg-card p-4 shadow-hard-sm">
          <dt className="text-sm font-bold">In DOL&apos;s line</dt>{" "}
          <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{formatInt(m.inLine)}</dd>{" "}
          <dd className="text-sm text-foreground/70">analyst review, worked in filing order</dd>
        </div>{" "}
        <div className="border-2 border-border bg-card p-4 shadow-hard-sm">
          <dt className="text-sm font-bold">Outside the line</dt>{" "}
          <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{formatInt(m.outside)}</dd>{" "}
          <dd className="text-sm text-foreground/70">on hold, at an RFI or on appeal</dd>
        </div>{" "}
        <div className="border-2 border-border bg-card p-4 shadow-hard-sm">
          {end?.kind === "estimate" ? (
            <>
              <dt className="text-sm font-bold">The line reaches this month&apos;s end</dt>{" "}
              <dd className="mt-1 font-heading text-2xl font-black sm:text-3xl">{`around ${longDay(end.date)}`}</dd>{" "}
              <dd className="text-sm text-foreground/70">{`${formatInt(end.casesThrough)} cases in line through ${label}, at DOL's recent pace`}</dd>
            </>
          ) : end?.kind === "passed" ? (
            <>
              <dt className="text-sm font-bold">DOL&apos;s queue has passed this month</dt>{" "}
              <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{formatInt(end.inLine)}</dd>{" "}
              <dd className="text-sm text-foreground/70">still in line, decided as DOL gets to them</dd>
            </>
          ) : (
            <>
              <dt className="text-sm font-bold">Waiting in all</dt>{" "}
              <dd className="mt-1 font-heading text-3xl font-black tabular-nums">{formatInt(m.inLine + m.outside)}</dd>{" "}
              <dd className="text-sm text-foreground/70">no date printed without a fresh pace</dd>
            </>
          )}
        </div>
      </dl>
    </div>
  );
}

const shortDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * What DOL did with this month lately, from the nightly record
 * (perm_docs['month_detail']): decisions per day, this week against last,
 * how far into the month DOL's decisions reach, and how far each employer
 * initial has got. Shown only once DOL has decided 50 of the month's cases in
 * the window; before that a chart of zeros and withdrawals says nothing.
 */
function MonthActivity({ detail, label, month }: { detail: MonthDetail; label: string; month: string }) {
  const days = detail.days;
  const max = Math.max(1, ...days.map((d) => d.certified + d.denied + d.withdrawn));
  const newest = days[days.length - 1];
  const wow = weekOnWeek(days, detail.asOf);
  const monthName = label.replace(/ \d{4}$/, "");
  const letters = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((l) => ({ l, v: detail.letters[l] ?? [0, 0] as [number, number] }));
  return (
    <section className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8" aria-labelledby="month-activity">
      <h2 id="month-activity" className="font-heading text-xl font-black sm:text-2xl">
        {`What DOL decided from ${label} lately`}
      </h2>{" "}
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {newest ? (
          <div>
            <dt className="text-sm font-bold">{`On ${shortDay(newest.date)}`}</dt>{" "}
            <dd className="font-heading text-3xl font-black tabular-nums">{formatInt(newest.certified + newest.denied + newest.withdrawn)}</dd>{" "}
            <dd className="text-sm text-foreground/70">{`decided, ${formatInt(newest.certified)} certified`}</dd>
          </div>
        ) : null}{" "}
        {wow ? (
          <div>
            <dt className="text-sm font-bold">The last seven days</dt>{" "}
            <dd className="font-heading text-3xl font-black tabular-nums">{formatInt(wow.thisWeek)}</dd>{" "}
            <dd className="text-sm text-foreground/70">{`against ${formatInt(wow.weekBefore)} the seven days before`}</dd>
          </div>
        ) : null}{" "}
        {detail.frontDay !== null ? (
          <div>
            <dt className="text-sm font-bold">Where DOL&apos;s decisions reach</dt>{" "}
            <dd className="font-heading text-3xl font-black">{`${monthName} ${detail.frontDay}`}</dd>{" "}
            <dd className="text-sm text-foreground/70">{`half of the last ${detail.frontDays} days' decisions went to cases filed by then`}</dd>
          </div>
        ) : null}
      </dl>{" "}
      <ChartTips label={`Cases filed in ${label} decided each day`} className="mt-6">
        <div className="flex h-32 items-end gap-[2px] border-b-2 border-border" role="img" aria-label={`Decisions per day for cases filed in ${label}, ${shortDay(days[0]!.date)} to ${shortDay(newest!.date)}`}>
          {days.map((d) => {
            const total = d.certified + d.denied + d.withdrawn;
            return (
              <span
                key={d.date}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
                data-tip={`${shortDay(d.date)}\n${formatInt(d.certified)} certified, ${formatInt(d.denied)} denied, ${formatInt(d.withdrawn)} withdrawn`}
              >
                <span className="block w-full bg-data-none-ink" style={{ height: `${(d.withdrawn / max) * 100}%` }} />
                <span className="block w-full bg-data-bad-ink" style={{ height: `${(d.denied / max) * 100}%` }} />
                <span className="block w-full bg-data-good-ink" style={{ height: `${(d.certified / max) * 100}%` }} />
                <span className="sr-only">{` ${shortDay(d.date)}: ${formatInt(total)} decided. `}</span>
              </span>
            );
          })}
        </div>
      </ChartTips>{" "}
      <div className="mt-1 flex justify-between font-mono text-sm text-foreground/70">
        <span>{shortDay(days[0]!.date)}</span>{" "}
        <span>{shortDay(newest!.date)}</span>
      </div>{" "}
      <p className="mt-2 text-sm text-foreground/70">
        Green certified, red denied, grey withdrawn by the employer. Days are when our sweep first saw each decision,
        not DOL&apos;s own date.
      </p>{" "}
      <h3 className="mt-8 font-heading text-lg font-black">By the employer&apos;s first letter</h3>{" "}
      <p className="mt-1 max-w-2xl text-base text-foreground/80">
        {`DOL tends to work a month loosely from A to Z. The share of ${label}'s cases decided, by the first letter of the employer's name.`}
      </p>{" "}
      <ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-9">
        {letters.map(({ l, v }) => {
          const share = v[0] ? v[1] / v[0] : 0;
          return (
            <Fragment key={l}>{" "}
            <li
              className="border-2 border-border bg-background p-2"
              data-tip={`${l}: ${formatInt(v[1])} of ${formatInt(v[0])} decided`}
            >
              <span className="flex items-baseline justify-between gap-1">
                <span className="font-heading text-lg font-black">{l}</span>{" "}
                <span className="font-mono text-sm tabular-nums">{v[0] ? formatShare(share) : "none"}</span>
              </span>{" "}
              <span className="mt-1 block h-2 border border-border bg-muted" aria-hidden="true">
                <span className="block h-full bg-data-good-ink" style={{ width: `${Math.round(share * 100)}%` }} />
              </span>
            </li>
            </Fragment>
          );
        })}
      </ol>{" "}
      <p className="mt-3 text-sm text-foreground/70">
        <Link href={`/perm-cases?filed=${month}#live`} className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
          {`Every ${label} case, pending and decided`}
        </Link>
      </p>
    </section>
  );
}
