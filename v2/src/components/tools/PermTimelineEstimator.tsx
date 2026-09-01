"use client";

/**
 * PERM decision-date estimator.
 *
 * Takes its data as props and computes locally. The public layout mounts no
 * ConvexProvider on purpose, so marketing pages never open a websocket or ship
 * the Convex client; the page fetches once in an RSC and this recomputes on
 * every change with no round trip.
 *
 * It renders EVERY model the data supports, each with its own basis and
 * source, and never blends them into one figure. The four public PERM
 * estimators disagree by roughly nine months on an identical filing date. A
 * single confident number would hide that disagreement rather than resolve it,
 * and would be wrong in exactly the way that loses someone's trust the month
 * their case runs past it.
 */

import { Fragment, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDotIcon as CalendarClock, InfoIcon, WarningIcon } from "@phosphor-icons/react";

import { estimateQueueDecision, type CohortStat, type DolFrontier } from "@/lib/perm";
import type { Pace } from "@/lib/dolPace";
import { formatMonth } from "@/lib/dolFormat";
import {
  FrontierProgressChart,
  type FrontierPoint,
} from "@/components/tools/FrontierProgressChart";
import { Label } from "@/components/ui";
import {
  deriveQueueAhead,
  findVolumeAnomalies,
  type MonthQueue,
} from "@/lib/queueAhead";
import { CaseNumberField } from "@/components/tools/CaseNumberField";
import { QueueMonthChart } from "@/components/tools/QueueMonthChart";
import { cn } from "@/lib/utils";

export interface PermTimelineEstimatorProps {
  frontier: DolFrontier | null;
  cohorts: readonly CohortStat[];
  /** "YYYY-MM" to preselect, e.g. from a ?month= link. Ignored when invalid. */
  initialMonth?: string | null;
  frontierAdvance: {
    rate: number;
    fromMonth: string;
    toMonth: string;
    pointsUsed: number;
    slowest: number | null;
    fastest: number | null;
  } | null;
  disclosure: { sourceFiles: string[]; uniqueCases: number } | null;
  /**
   * Reconstructed frontier series, plotted against the chosen filing month.
   *
   * Optional because it arrives from a Convex query: a frontend deployed ahead
   * of its backend functions receives nothing for this field, and treating it
   * as guaranteed took the entire page down rather than hiding one chart.
   */
  frontierHistory?: readonly FrontierPoint[];
  /**
   * Today as `YYYY-MM-DD`, resolved on the server.
   *
   * Passed in rather than read from `new Date()` here for the same reason
   * QueueAlertForm takes `newestMonth`: the page is cached for an hour, so a
   * component that computed its own "today" would hydrate against a different
   * value than the server rendered.
   */
  today: string;
  /**
   * DOL's recent working-day pace, computed on the server.
   *
   * The pace comes from a 947-day series; computing it here would mean
   * shipping 947 rows through the RSC payload to derive four numbers. Null
   * when the window holds no working days, which is a real state and renders
   * as an absent card rather than a zero.
   */
  pace?: Pace | null;
  /**
   * Every filing month's queue progress, including PENDING counts.
   *
   * The one question DOL's own files cannot answer: its quarterly disclosure
   * release carries a decision date on every record and no pending rows at
   * all, so "how many are in front of me" is underivable from it. These
   * counts are mirrored per-case status, and `queueSource` names the mirror
   * on the page rather than in a footnote.
   *
   * Optional and defaulted for the same reason `frontierHistory` is: a
   * frontend deployed ahead of its data reads undefined here, and treating
   * it as guaranteed took a whole page down once already.
   */
  months?: readonly MonthQueue[];
  /** Months DOL has started and not finished, from the same series. */
  activeRange?: { from: string; to: string } | null;
  /** Attribution for the pending counts, rendered where the counts are. */
  queueSource?: string | null;
  /** Renders the compact variant used inside other pages. */
  compact?: boolean;
  className?: string;
}

/**
 * Where one month's pending cases sit across DOL's separate queues.
 *
 * Analyst review is the ordinary queue. RFI and audit are their own, and a
 * case in either is out of filing order entirely, which is the honest answer
 * to "DOL passed my month and I still have nothing". The rival's table stops
 * at a pending count; this split is data we hold and they do not show.
 */
function StagesLine({
  subject,
  month,
}: {
  subject: MonthQueue;
  month: string;
}) {
  const parts: { label: string; n: number }[] = [
    { label: "in analyst review", n: subject.analystReview ?? 0 },
    { label: "answering a request for information", n: subject.rfiIssued ?? 0 },
    { label: "in audit", n: subject.auditResponse ?? 0 },
    { label: "under appeal", n: subject.appeals ?? 0 },
  ].filter((p) => p.n > 0);
  if (parts.length === 0) return null;

  const accounted = parts.reduce((n, p) => n + p.n, 0);
  const rest = subject.pending - accounted;
  const fmt = (n: number) => n.toLocaleString("en-US");

  return (
    <p className="mt-4 text-base leading-relaxed text-foreground/70">
      <b className="font-bold text-foreground">
        {fmt(subject.pending)} still undecided in {formatMonth(month)}
      </b>
      :{" "}
      {parts.map((p, i) => (
        <Fragment key={p.label}>
          {i > 0 ? (i === parts.length - 1 && rest <= 0 ? " and " : ", ") : ""}
          {fmt(p.n)} {p.label}
        </Fragment>
      ))}
      {rest > 0 ? `, and ${fmt(rest)} in none of those three` : ""}. A case in
      a request for information or an audit is out of filing order, and DOL
      publishes those queues separately.
    </p>
  );
}

/** Filing months a live PERM case could plausibly carry, newest first. */
function filingMonthOptions(today: string): { value: string; label: string }[] {
  const m = /^(\d{4})-(\d{2})/.exec(today);
  const newestYear = m ? Number(m[1]) : 2026;
  const newestMonth = m ? Number(m[2]) - 1 : 11;

  const options: { value: string; label: string }[] = [];
  for (let year = newestYear; year >= 2020; year--) {
    const start = year === newestYear ? newestMonth : 11;
    for (let mo = start; mo >= 0; mo--) {
      const value = `${year}-${String(mo + 1).padStart(2, "0")}`;
      options.push({ value, label: formatMonth(value) || value });
    }
  }
  return options;
}

const POSITION_COPY: Record<string, { tone: string; heading: string }> = {
  "awaiting-queue": {
    tone: "bg-tint-primary",
    heading: "DOL hasn’t reached your filing month yet",
  },
  "queue-reached": {
    tone: "bg-primary/20",
    heading: "DOL is working on your filing month now",
  },
  overdue: {
    tone: "bg-muted",
    heading: "DOL's queue has already passed your filing month",
  },
};

export function PermTimelineEstimator({
  frontier,
  cohorts,
  frontierAdvance,
  disclosure,
  frontierHistory = [],
  today,
  pace = null,
  months = [],
  activeRange = null,
  queueSource = null,
  compact = false,
  initialMonth = null,
  className,
}: PermTimelineEstimatorProps) {
  const selectId = useId();
  const options = useMemo(() => filingMonthOptions(today), [today]);
  // Default to the caller's prefill (the homepage's "estimate from your
  // filing month" path arrives with ?month=), else a month DOL is plausibly
  // working, so the empty state shows a real answer rather than an empty
  // frame. The prefill must exist in the option list or it is ignored - a
  // month the select cannot show would desynchronise control and estimate.
  const [month, setMonth] = useState<string>(() => {
    if (initialMonth && options.some((o) => o.value === initialMonth)) {
      return initialMonth;
    }
    if (frontier) return frontier.analystQueueMonth;
    return options[0] ? options[0].value : "2025-01";
  });

  // ?month= prefill, read AFTER mount on purpose. Reading searchParams
  // server-side would opt the whole route into dynamic rendering - the exact
  // defect that once made every public page a server render per visit - and
  // reading window.location in the state initializer would render different
  // HTML than the server sent. A post-mount set is hydration-safe and keeps
  // the page static.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("month");
    if (m && /^\d{4}-\d{2}$/.test(m) && options.some((o) => o.value === m)) {
      setMonth(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once; the
    // URL does not change under this page without a navigation.
  }, []);

  const estimate = useMemo(
    () =>
      estimateQueueDecision({
        filingDate: `${month}-15`,
        today,
        frontier,
        cohorts,
        frontierAdvanceRate: frontierAdvance ? frontierAdvance.rate : null,
        frontierAdvanceRange:
          frontierAdvance && frontierAdvance.slowest && frontierAdvance.fastest
            ? { slowest: frontierAdvance.slowest, fastest: frontierAdvance.fastest }
            : null,
      }),
    [month, today, frontier, cohorts, frontierAdvance],
  );

  const position = POSITION_COPY[estimate.position];

  /**
   * The span every model agrees the answer lies inside.
   *
   * NOT a blend, and the distinction is the whole reason this component
   * exists in the shape it does. The four public estimators disagree by
   * roughly nine months on an identical filing date, and averaging them into
   * one confident date would hide that. Taking the earliest and latest bound
   * any model offers does the opposite: it puts the disagreement on the page
   * as the headline, at the size a reader actually looks at, with the
   * individual models still listed below unchanged.
   *
   * Every bound is a date a model already published. Nothing here is invented.
   */
  const envelope = useMemo(() => {
    const lo: string[] = [];
    const hi: string[] = [];
    for (const m of estimate.models) {
      lo.push(m.earliestDate ?? m.estimatedDate);
      hi.push(m.latestDate ?? m.estimatedDate);
    }
    const first = estimate.models[0];
    if (lo.length === 0 || !first) return null;
    // A surviving model's central date is in the future (the calculator
    // withholds elapsed ones), but its p25 bound can still be behind us. A
    // window that opens in the past reads as a mistake, so the displayed
    // start is floored at today.
    const rawEarliest = lo.reduce((a2, b) => (a2 < b ? a2 : b));
    const earliest = rawEarliest < today ? today : rawEarliest;
    const latest = hi.reduce((a2, b) => (a2 > b ? a2 : b));
    const spanMonths =
      (Number(latest.slice(0, 4)) - Number(earliest.slice(0, 4))) * 12 +
      (Number(latest.slice(5, 7)) - Number(earliest.slice(5, 7)));
    return {
      earliest,
      latest,
      spanMonths,
      modelCount: estimate.models.length,
      // The lead model's own date - the same one the case page anchors on.
      anchor: first.estimatedDate,
    };
  }, [estimate.models, today]);

  /**
   * How far through the wait this case is, as a fraction.
   *
   * Domain runs from the filing month to the LATEST bound, so the bar can
   * never overflow its own track. Three traceable inputs: the month the user
   * picked, today as resolved on the server, and a bound a model published.
   */
  const progress = useMemo(() => {
    if (!envelope) return null;
    const monthsBetween = (from: string, to: string) =>
      (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
      (Number(to.slice(5, 7)) - Number(from.slice(5, 7)));
    const total = monthsBetween(month, envelope.latest);
    if (total <= 0) return null;
    const elapsed = Math.max(0, monthsBetween(month, today));
    const toEarliest = Math.max(0, monthsBetween(month, envelope.earliest));
    return {
      elapsedPct: Math.min(100, (elapsed / total) * 100),
      windowStartPct: Math.min(100, (toEarliest / total) * 100),
      elapsedMonths: elapsed,
      totalMonths: total,
    };
  }, [envelope, month, today]);

  /** Measured, not projected: pending cases filed before the chosen month. */
  const queue = useMemo(() => deriveQueueAhead(months, month), [months, month]);

  /** Months whose filing volume collapsed, so the chart can say why. */
  const anomalies = useMemo(() => findVolumeAnomalies(months), [months]);

  /**
   * A decoded case number the month picker cannot represent.
   *
   * The picker covers the months a live PERM could plausibly carry. A number
   * decoding outside that is either very old or a typo, and quietly leaving
   * the picker where it was would show an answer for a month the reader never
   * chose. So: say so, and change nothing.
   */
  const [caseWarning, setCaseWarning] = useState<string | null>(null);

  function handleDecode(parsed: { filingMonth: string }) {
    if (options.some((o) => o.value === parsed.filingMonth)) {
      setCaseWarning(null);
      setMonth(parsed.filingMonth);
      return;
    }
    setCaseWarning(
      "That month is outside the range this calculator covers, so the figures below still show the month picked above.",
    );
  }

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        {/* The icon sits beside the heading only. Wrapping the copy in
            the icon flex indented it 36px against the form below, which
            reads as the inputs sticking out to the left. */}
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">
            When will DOL decide my PERM?
          </h2>
        </div>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Pick the month DOL received your ETA-9089. Every figure comes from
          DOL&apos;s own published data.
        </p>

        <div className="mt-6">
          <Label htmlFor={selectId} className="text-sm font-bold">
            Month DOL received your case
          </Label>
          <select
            id={selectId}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-2 block w-full min-w-0 min-h-[44px] border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-xs"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <CaseNumberField
          className="mt-6"
          onDecode={handleDecode}
          warning={caseWarning}
        />
      </div>

      {/* THE ANSWER, at the size the question was asked. Everything in this
          band is a bound some model below already published, or arithmetic on
          the month the reader picked. */}
      {envelope || estimate.position === "overdue" ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          {envelope ? (
            /* The anchor leads and the window follows. A range-only headline
               read as "we don't know" next to rivals printing one confident
               date; one date with no range is the opposite failure (the four
               public estimators disagree by ~9 months on identical input).
               So: the most defensible model's own date, big, with the full
               envelope right under it and the models listed below. */
            <>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Most likely
              </p>{" "}
              <p className="mt-2 font-heading text-3xl font-black leading-[1.05] sm:text-5xl">
                Around {formatMonth(envelope.anchor.slice(0, 7))}
              </p>{" "}
              <p className="mt-3 font-heading text-lg font-bold sm:text-xl">
                Likely decision window:{" "}
                {envelope.earliest.slice(0, 7) === envelope.latest.slice(0, 7) ? (
                  formatMonth(envelope.earliest.slice(0, 7))
                ) : (
                  <>
                    {formatMonth(envelope.earliest.slice(0, 7))}
                    <span className="text-muted-foreground"> to </span>
                    {formatMonth(envelope.latest.slice(0, 7))}
                  </>
                )}
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                {envelope.modelCount === 1
                  ? "One model has enough published data to answer for this month."
                  : `${envelope.modelCount} models, each on its own basis, spread across ${envelope.spanMonths} months. They are listed below rather than averaged, because the spread is the honest part.`}
              </p>
            </>
          ) : (
            /* The frontier has already passed this month, so every
               filing-anchored model lands in the past and the calculator
               withholds them all - a window that has already elapsed is not
               a forecast. What a reader with a case this old needs is the
               CASE's own status, not month arithmetic. */
            <>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Where your case stands
              </p>{" "}
              <p className="mt-2 font-heading text-3xl font-black leading-[1.05] sm:text-4xl">
                DOL&apos;s queue has passed your filing month
                {estimate.monthsBehindFrontier !== null &&
                estimate.monthsBehindFrontier < 0
                  ? ` by ${Math.abs(estimate.monthsBehindFrontier)} month${Math.abs(estimate.monthsBehindFrontier) === 1 ? "" : "s"}`
                  : ""}
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                Most cases filed this month have been decided. One still
                pending has usually been taken out of filing order by an
                audit, a request for information, or a hold, and none of
                those can be dated from the filing month alone. Your case
                number can: it carries the live DOL status and a
                stage-adjusted estimate.
              </p>{" "}
              <p className="mt-4">
                <Link
                  href="/perm-case-status"
                  className="inline-block border-2 border-border bg-primary px-4 py-2.5 font-heading text-base font-black text-primary-foreground shadow-hard-sm transition-transform hover:-translate-y-0.5"
                >
                  Check your case number
                </Link>{" "}
                <span className="text-sm text-muted-foreground">
                  Free, no account.
                </span>
              </p>
            </>
          )}

          {progress ? (
            <div className="mt-6">
              <div
                className="relative h-4 w-full border-2 border-border bg-muted"
                role="img"
                aria-label={`${progress.elapsedMonths} of about ${progress.totalMonths} months elapsed since filing`}
              >
                {/* The window every model lands inside. */}
                <div
                  className="absolute inset-y-0 bg-primary/25"
                  style={{
                    left: `${progress.windowStartPct}%`,
                    right: 0,
                  }}
                />
                {/* Time actually elapsed. */}
                <div
                  className="absolute inset-y-0 left-0 bg-primary"
                  style={{ width: `${progress.elapsedPct}%` }}
                />
              </div>{" "}
              <p className="mt-2 font-mono text-sm text-muted-foreground">
                {progress.elapsedMonths} of about {progress.totalMonths} months
                elapsed
              </p>
            </div>
          ) : null}

          {/* Stat cards. Each one is a single published figure, labelled with
              where it came from - not a derived score. */}
          {/* Flex-wrap rather than a fixed column count: every card here is
              conditional, and a 3-across grid holding 3 of 4 cards leaves an
              empty cell that reads as a card that failed to load. */}
          <div className="mt-6 flex flex-wrap gap-3">
            {pace ? (
              <div className="min-w-0 flex-1 basis-60 border-2 border-border bg-background p-4">
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  DOL pace
                </p>{" "}
                <p className="mt-1 font-heading text-2xl font-black leading-none">
                  {pace.perBusinessDay.toLocaleString("en-US")}
                </p>{" "}
                <p className="mt-1 text-sm text-foreground/70">
                  decisions per working day, last {pace.businessDays}
                </p>
              </div>
            ) : null}
            {frontier ? (
              <div className="min-w-0 flex-1 basis-60 border-2 border-border bg-background p-4">
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Queue is at
                </p>{" "}
                <p className="mt-1 font-heading text-2xl font-black leading-none">
                  {formatMonth(frontier.analystQueueMonth)}
                </p>{" "}
                <p className="mt-1 text-sm text-foreground/70">
                  DOL analyst review, {frontier.asOf}
                </p>
              </div>
            ) : null}
            {estimate.monthsBehindFrontier !== null ? (
              <div className="min-w-0 flex-1 basis-60 border-2 border-border bg-background p-4">
                <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Your month
                </p>{" "}
                {/* Signed arithmetic reads backwards here: "-11 months behind
                    the queue" for a month the queue passed 11 months ago.
                    Say the direction in words and keep the number positive. */}
                <p className="mt-1 font-heading text-2xl font-black leading-none">
                  {Math.abs(estimate.monthsBehindFrontier)}
                </p>{" "}
                <p className="mt-1 text-sm text-foreground/70">
                  {estimate.monthsBehindFrontier > 0
                    ? "months until the queue reaches your month"
                    : estimate.monthsBehindFrontier === 0
                      ? "months away: the queue is at your month"
                      : "months since the queue passed your month"}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Where this case sits relative to DOL's published frontier. Skipped
          when the overdue hero above has already said exactly this. */}
      {frontier && position && !(estimate.position === "overdue" && !envelope) ? (
        <div className={cn("border-b-2 border-border p-6 sm:p-8", position.tone)}>
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
            Queue position
          </p>{" "}
          <p className="mt-2 font-heading text-xl font-black leading-tight sm:text-2xl">
            {position.heading}
          </p>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            DOL&apos;s analyst review queue is working{" "}
            <strong>{formatMonth(frontier.analystQueueMonth)}</strong>, as of{" "}
            {frontier.asOf}.
            {estimate.monthsBehindFrontier !== null && estimate.monthsBehindFrontier > 0
              ? ` Your month is ${estimate.monthsBehindFrontier} further on.`
              : ""}
          </p>
        </div>
      ) : null}

      {/* The queue itself, drawn. This is the only band on the page built on
          pending counts, which is why it carries its own attribution. */}
      {months.length > 0 ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          <h3 className="font-heading text-xl font-black leading-tight sm:text-2xl">
            How far DOL has got through each month
          </h3>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            {activeRange ? (
              <>
                DOL is visibly working{" "}
                <b className="font-bold text-foreground">
                  {formatMonth(activeRange.from)} to {formatMonth(activeRange.to)}
                </b>
                : those months have decisions in them and are not finished.
                Months above are done, months below have not been reached.
              </>
            ) : (
              <>
                Every filing month, oldest first. Months at the top are done
                and months at the bottom have not been reached.
              </>
            )}
          </p>

          <div className="mt-6 border-2 border-border bg-background p-4 sm:max-w-sm">
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Cases ahead of you
            </p>{" "}
            <p className="mt-1 font-heading text-4xl font-black leading-none">
              {queue.ahead.toLocaleString("en-US")}
            </p>{" "}
            <p className="mt-1 text-sm text-foreground/70">
              still undecided, filed before {formatMonth(month)}
            </p>
          </div>

          <QueueMonthChart
            className="mt-6"
            months={months}
            selectedMonth={month}
            anomalies={anomalies}
          />

          {/* Where the reader's own pending cases sit. DOL runs analyst
              review, RFI and audit as separate queues, and a case in one of
              the latter two is out of filing order entirely - which is the
              real answer to "my month has passed and I have nothing".

              The remainder is stated rather than hidden: the three buckets do
              not necessarily partition `pending`, and silently showing three
              numbers that do not add up to the fourth invites the reader to
              do the subtraction and conclude something is broken. */}
          {queue.subject && queue.subject.pending > 0 ? (
            <StagesLine subject={queue.subject} month={month} />
          ) : null}

          {/* Provenance where the data is, not in a footnote: these are the
              only figures here that DOL does not publish itself. */}
          {queueSource ? (
            <p className="mt-6 border-t-2 border-border pt-3 text-sm text-muted-foreground">
              <span className="font-bold text-foreground/80">Pending counts:</span>{" "}
              {queueSource}. DOL&apos;s own disclosure files carry a decision
              date on every record and no pending rows at all, so a count of
              what is still in front of you cannot be read from them.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Every supported model, side by side. */}
      {estimate.models.length > 0 ? (
        <div className="divide-y-2 divide-border">
          {estimate.models.map((model) => (
            <div key={model.id} className="p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                {model.label}
              </p>{" "}
              <p className="mt-2 font-heading text-3xl font-black leading-none sm:text-4xl">
                {formatMonth(model.estimatedDate.slice(0, 7))}
              </p>{" "}
              {/* The separator has to sit here, before the conditional. When
                  the range is absent this <p> is followed directly by the
                  basis paragraph, and the two run together. */}
              {model.earliestDate && model.latestDate ? (
                <p className="mt-2 text-base font-bold text-foreground/70">
                  Range {formatMonth(model.earliestDate.slice(0, 7))} to{" "}
                  {formatMonth(model.latestDate.slice(0, 7))}
                </p>
              ) : null}{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                {model.basis}
              </p>{" "}
              <p className="mt-2 text-sm text-foreground/60">Source: {model.source}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 sm:p-8">
          <p className="text-base leading-relaxed">
            There isn’t enough published DOL data to put a date on this filing
            month yet.
          </p>
        </div>
      )}

      {/* The models above give dates. This gives the reasoning behind them, and
          it is the one series on the page that DOL does not publish. */}
      {frontierHistory.length >= 2 ? (
        <div className="border-t-2 border-border p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black">How fast the queue is moving</h3>
          <FrontierProgressChart
            history={frontierHistory}
            filingMonth={month}
            className="mt-6"
          />
        </div>
      ) : null}

      {/* Caveats. Not boilerplate: each one is generated for this case. */}
      {estimate.caveats.length > 0 ? (
        <div className="border-t-2 border-border bg-muted p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <WarningIcon
              className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70"
              aria-hidden="true"
            />
            <div>
              <h3 className="font-heading text-base font-black">What this can’t tell you</h3>{" "}
              <ul className="mt-3 space-y-2">
                {estimate.caveats.map((c) => (
                  <li key={c} className="text-base leading-relaxed text-foreground/70">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {!compact && disclosure ? (
        <div className="border-t-2 border-border p-6 text-sm leading-relaxed text-foreground/60 sm:px-8">
          <InfoIcon className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
          Cohort figures are computed from{" "}
          {disclosure.uniqueCases.toLocaleString("en-US")} decided cases in DOL&apos;s
          disclosure files ({disclosure.sourceFiles.join(", ")}).
          {frontierAdvance
            ? ` Queue movement is measured across ${frontierAdvance.pointsUsed} months of determinations, ${formatMonth(frontierAdvance.fromMonth)} to ${formatMonth(frontierAdvance.toMonth)}.`
            : ""}
        </div>
      ) : null}
    </div>
  );
}
