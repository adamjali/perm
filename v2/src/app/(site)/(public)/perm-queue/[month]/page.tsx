import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Warning } from "@phosphor-icons/react/ssr";

import { DataNav } from "@/components/tools/DataNav";
import { DataProvenance } from "@/components/data/DataProvenance";
import { DecidedList, PendingCensus } from "@/components/queue/PendingCensus";
import { OctoberNote, OCTOBER_2025 } from "@/components/queue/OctoberNote";
import { StageBar, StageLegend } from "@/components/queue/StageBar";
import { groupByStage } from "@/components/queue/stages";
import { formatAsOf, formatMonth, monthsMoved } from "@/lib/dolFormat";
import { MIRROR_COMPLETE, PROVISIONAL_NOTICE } from "@/lib/liveQueueGate";
import {
  getAdjacentMonths,
  getMonthBacklog,
  getPendingBefore,
} from "@/lib/turso/backlog";
import { getEstimatorData } from "@/lib/turso/estimate";
import { openGraphBase } from "@/lib/openGraphBase";

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
  if (!MONTH_RE.test(month)) return {};
  const label = formatMonth(month) ?? month;
  const title = `PERM Cases Filed ${label}`;
  return {
    title,
    description: `How many PERM cases filed in ${label} are still undecided, which of DOL's queues they're sitting in, and how much of the backlog sits in front of them.`,
    alternates: { canonical: `/perm-queue/${month}` },
    robots: MIRROR_COMPLETE ? undefined : { index: false, follow: true },
    openGraph: { ...openGraphBase, title: `${title} | PERM Tracker`, url: `/perm-queue/${month}` },
  };
}

export const revalidate = 3600;

const int = (n: number) => n.toLocaleString("en-US");

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
  const [backlog, ahead, adjacent, estimator] = await Promise.all([
    getMonthBacklog(month),
    getPendingBefore(month),
    getAdjacentMonths(month),
    getEstimatorData(),
  ]);
  if (!backlog || backlog.total === 0) notFound();

  const split = groupByStage(backlog.statuses);
  const label = formatMonth(month) ?? month;
  const dolMonth = estimator.frontier?.analystQueueMonth ?? null;
  const dolAsOf = estimator.frontier ? formatAsOf(estimator.frontier.asOf) : null;
  const isNoted = month === OCTOBER_2025.month;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="queue" />
      <div className="pt-10 sm:pt-12" />

      <header>
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/80">
          <Link href="/perm-queue" className="underline underline-offset-2 hover:text-primary">
            PERM queue
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Filed {label}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/80">
          {int(backlog.total)}{" "}
          {backlog.total === 1 ? "application carries" : "applications carry"}{" "}
          {article(label)} {label} filing date.{" "}
          {int(backlog.decided)} {backlog.decided === 1 ? "has" : "have"} a
          decision. {int(split.pending)}{" "}
          {split.pending === 1 ? "is" : "are"} still waiting.
        </p>
      </header>

      {!MIRROR_COMPLETE ? (
        <p className="mt-8 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base text-foreground/80">
          <Warning className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
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
              <b className="font-bold">{int(ahead)}</b> undecided cases were
              filed before {label}. That&rsquo;s what&rsquo;s in front of this
              month, counting only cases DOL still has to decide. It isn&rsquo;t
              divided into a wait: the{" "}
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

      <section className="mt-6 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          Still waiting
        </h2>{" "}
        <p className="mt-2 text-base leading-relaxed text-foreground/80">
          {split.ordinary > 0 ? (
            <>
              {split.outOfOrder.length > 0 ? (
                <>
                  {int(split.ordinary)} of them are in analyst review, the
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
            <StageBar stages={split.stages} scale="composition" className="mt-6" />
            <StageLegend stages={split.stages} className="mt-4" />
            <div className="mt-8 border-t-2 border-border pt-6">
              <PendingCensus
                stages={split.stages}
                caption={`Every DOL status a pending case filed in ${label} is currently in, grouped by queue`}
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

      <section className="mt-6 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          Already decided
        </h2>{" "}
        <p className="mt-2 text-base leading-relaxed text-foreground/80">
          {int(backlog.decided)} of the {int(backlog.total)} applications filed
          in {label} {backlog.decided === 1 ? "has" : "have"} a final
          determination.{" "}
          <WithdrawalNote decided={split.decided} />
        </p>
        <div className="mt-6">
          <DecidedList statuses={split.decided} />
        </div>
      </section>{" "}

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

      <DataProvenance
        datasets={["perm-case-status", "processing-times"]}
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
      {int(withdrawn)} of those are withdrawals, which an employer files rather
      than DOL issuing a determination.{" "}
      {other === 0 ? (
        <>Nothing filed this month has been certified or denied yet.</>
      ) : (
        <>
          {int(other)} {other === 1 ? "is a certification or a denial" : "are certifications or denials"}.
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
  const Icon = direction === "previous" ? ArrowLeft : ArrowRight;
  return (
    <Link
      href={`/perm-queue/${month}`}
      className="flex min-h-11 items-center gap-2 border-2 border-border bg-card px-4 py-2 text-base font-bold shadow-hard-sm hover:text-primary"
    >
      {direction === "previous" ? (
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      ) : null}{" "}
      <span>
        <span className="block font-mono text-xs font-normal uppercase tracking-wider text-foreground/70">
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
