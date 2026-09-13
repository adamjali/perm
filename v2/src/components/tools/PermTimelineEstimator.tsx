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
import { CalendarDotIcon as CalendarClock, CaretRightIcon as CaretRight, InfoIcon, WarningIcon } from "@phosphor-icons/react";

import {
  estimateQueueDecision,
  type CohortStat,
  type DolFrontier,
  type MeasuredPace,
} from "@/lib/perm";
import type { Pace } from "@/lib/dolPace";
import { formatMonth } from "@/lib/dolFormat";
import { DateInput } from "@/components/forms/DateInput";

/** "Tue 14 Oct 2026". UTC so the label cannot slide a day by timezone. */
function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
import {
  FrontierProgressChart,
  type FrontierPoint,
} from "@/components/tools/FrontierProgressChart";
import { Label } from "@/components/ui";
import {
  deriveQueueAhead,
  findVolumeAnomalies,
  type MonthQueue,
  aheadOfDay,
  measureFilingRate,
} from "@/lib/queueAhead";
import { CaseNumberField } from "@/components/tools/CaseNumberField";
import { QueueMonthChart } from "@/components/tools/QueueMonthChart";
import { cn } from "@/lib/utils";

/**
 * The alphabet shape this component consumes, declared HERE rather than
 * imported from `@/lib/turso/alphabet`.
 *
 * That module carries `import "server-only"`, and this file is `"use client"`.
 * A type-only import is erased at compile, but Next resolves the module graph
 * before that erasure, so the import alone turned this route into a 404 - a
 * clean 404 with nothing in the dev log, which reads exactly like a missing
 * page. Verified by stashing: clean HEAD 200, the import 404.
 *
 * Structural, and only what is actually read. A server-only reader stays free
 * to carry more.
 */
interface AlphabetForClient {
  letters: ReadonlyArray<{ letter: string; deltaDays: number }>;
  cases: number;
}

export interface PermTimelineEstimatorProps {
  frontier: DolFrontier | null;
  /**
   * The measured employer-initial ordering, or null when the doc is missing.
   *
   * DOL works a filing month alphabetically by employer, so this is the term
   * that turns a MONTH into a DAY. It is never invented: with no doc, or no
   * initial chosen, the estimate stays at month resolution and says so.
   */
  alphabet?: AlphabetForClient | null;
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
   * DOL's decision rate as `measurePace` reads it, distinct from `pace` above.
   *
   * `pace` is the display figure - decisions per WORKING day over a long
   * series, shown as a stat. This is the CALENDAR rate the decision-pace
   * model divides by, measured over the last 28 observed days with its own
   * p10/p90 band. They are different numbers on purpose and both are real;
   * the model needs the calendar one because a wait spans weekends.
   */
  decisionPace?: MeasuredPace | null;
  /** Days since our sweep last read DOL; past 3 the model withholds. */
  sweepAgeDays?: number | null;
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
        {" "}
        </Fragment>
      ))}
      {rest > 0 ? `, and ${fmt(rest)} in none of those three` : ""}. A case in
      a request for information or an audit is out of filing order, and DOL
      publishes those queues separately.
    </p>
  );
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
  alphabet = null,
  frontierAdvance,
  disclosure,
  frontierHistory = [],
  today,
  pace = null,
  decisionPace = null,
  sweepAgeDays = null,
  months = [],
  activeRange = null,
  queueSource = null,
  compact = false,
  initialMonth = null,
  className,
}: PermTimelineEstimatorProps) {
  const selectId = useId();
  // Default to the caller's prefill (the homepage's "estimate from your
  // filing month" path arrives with ?month=), else a month DOL is plausibly
  // working, so the empty state shows a real answer rather than an empty
  // frame. The prefill must exist in the option list or it is ignored - a
  // month the select cannot show would desynchronise control and estimate.
  /**
   * The filing date, as one ISO string. THE source of truth.
   *
   * WAS TWO SELECTS - a month list and a day list - and the month list could
   * only ever offer months that already exist. The owner asked for an
   * unbounded forward range, and a `<select>` cannot hold one: you cannot
   * enumerate every future month. A date field can, and it collapses the two
   * controls into the one thing a person actually knows.
   *
   * `month` derives from it, so every consumer below (the queue band, the
   * frontier chart, the stages line) is unchanged.
   */
  /**
   * EMPTY UNTIL SOMEBODY PICKS A DATE.
   *
   * It used to open on DOL's current frontier month, so the page showed a
   * full answer - a date, a window, a queue position - for a month the reader
   * had never chosen. That reads as "here is your estimate" when it is really
   * "here is an example", and a reader took it for their own.
   *
   * A prefill is still honoured when it was ASKED for: `?date=`, `?month=`,
   * or the `initialMonth` prop that the homepage hand-off uses. Those are a
   * choice made elsewhere; the bare page is not.
   */
  const [filedOn, setFiledOn] = useState<string>(() =>
    initialMonth && /^\d{4}-\d{2}$/.test(initialMonth) ? `${initialMonth}-15` : "",
  );

  /** Nothing downstream may render an answer without one. */
  const hasDate = /^\d{4}-\d{2}-\d{2}$/.test(filedOn);

  /**
   * A safe date for the arithmetic while the field is empty.
   *
   * The calculator is a pure function over a valid date and would throw on
   * "". Computing against the frontier keeps every hook unconditional - React
   * requires that - and the RENDER is gated on `hasDate`, so none of it
   * reaches the page until a date is chosen.
   */
  const effectiveFiledOn = hasDate
    ? filedOn
    : `${frontier ? frontier.analystQueueMonth : today.slice(0, 7)}-15`;

  const month = effectiveFiledOn.slice(0, 7);

  /** A date after today is a plan, not a record, and reads differently. */
  const isFuture = hasDate && filedOn > today;

  /**
   * How fast cases are arriving, over months that have stopped growing.
   *
   * Only ever used for a FUTURE date: today's backlog alone would give every
   * future date the same answer. Null when there is too little settled data,
   * and the copy says so rather than inventing a rate.
   */
  const filingRate = useMemo(() => measureFilingRate(months, today), [months, today]);
  const pendingNow = useMemo(
    () => months.reduce((a, m) => a + m.pending, 0),
    [months],
  );

  /** What every model is anchored to. */
  const filingDate = effectiveFiledOn;

  // ?month= prefill, read AFTER mount on purpose. Reading searchParams
  // server-side would opt the whole route into dynamic rendering - the exact
  // defect that once made every public page a server render per visit - and
  // reading window.location in the state initializer would render different
  // HTML than the server sent. A post-mount set is hydration-safe and keeps
  // the page static.
  // Optional, and optional is the point: the estimate is honest at month
  // resolution, and the initial is what sharpens it to a day. Empty means
  // "not told", never "A".
  const [initial, setInitial] = useState<string>("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // `?date=` is new and exact; `?month=` is the existing contract that
    // links elsewhere on the site still use, and it lands on the 15th - the
    // same midpoint the picker used before a day could be given at all.
    const d = q.get("date");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setFiledOn(d);
      return;
    }
    const m = q.get("month");
    if (m && /^\d{4}-\d{2}$/.test(m)) setFiledOn(`${m}-15`);
    // No disable needed any more: this used to close over `options`, the
    // month list, and had to suppress the dependency warning. The field takes
    // any date, the list is gone, and the effect now closes over nothing but
    // a setter - which React guarantees is stable. Runs once, as intended.
  }, []);

  const letterDelta = useMemo(() => {
    if (!alphabet || !initial) return null;
    return alphabet.letters.find((l) => l.letter === initial)?.deltaDays ?? null;
  }, [alphabet, initial]);

  /**
   * The measured span of the whole alphabet, for when no initial is chosen.
   *
   * Without an initial the reader's position in the filing month is unknown,
   * and the band has to say so - otherwise choosing a letter returns a date
   * outside the range the page just printed, which is what a reader caught.
   * Derived from the same doc the per-letter shift comes from; null when the
   * measurement is absent, and then nothing widens.
   */
  const letterSpread = useMemo(() => {
    if (!alphabet || alphabet.letters.length === 0) return null;
    const d = alphabet.letters.map((l) => l.deltaDays);
    return { min: Math.min(...d), max: Math.max(...d) };
  }, [alphabet]);

  const estimate = useMemo(
    () =>
      estimateQueueDecision({
        filingDate,
        today,
        frontier,
        cohorts,
        frontierAdvanceRate: frontierAdvance ? frontierAdvance.rate : null,
        frontierAdvanceRange:
          frontierAdvance && frontierAdvance.slowest && frontierAdvance.fastest
            ? { slowest: frontierAdvance.slowest, fastest: frontierAdvance.fastest }
            : null,
        // MEASURED OR ABSENT, never a default. `letterDeltaDays` shifts every
        // model by the ordering DOL actually works in; with no initial chosen
        // it is null and the calculator behaves exactly as before.
        letterDeltaDays: letterDelta,
        letterSpreadDays: letterSpread,
        // The picker chooses a MONTH, so the 15th is the honest midpoint and
        // `casesAheadOfDay` prorates that month's own pending accordingly.
        // Absent months or pace, the model is omitted and the month-granular
        // ones answer exactly as they did before.
        // `aheadOfDay` rather than `casesAheadOfDay`: the second returns null
        // for any month the census lacks, which is right for a date BEFORE
        // our data and wrong for one after it. A future filer has every
        // pending case ahead of them, plus whoever files in the meantime.
        casesAhead: months.length
          ? (aheadOfDay(months, filingDate, {
              today,
              filingRate: filingRate ? filingRate.perDay : null,
            })?.total ?? null)
          : null,
        decisionPace,
        sweepAgeDays,
      }),
    // `month` is deliberately absent: `filingDate` is derived from it, so
    // listing both re-runs the memo twice for one change. `filingRate` IS
    // listed even though it derives from `months` and `today` - it is read
    // inside, and a memo that reads a value it does not depend on is the
    // shape that goes stale the first time the derivation changes.
    [filingDate, today, frontier, cohorts, frontierAdvance, letterDelta,
     months, decisionPace, sweepAgeDays, filingRate, letterSpread],
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
   * individual models still available, behind the disclosure below.
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
   * The answer as the LEAD model states it, when that model can place a case
   * inside its filing month - and the cross-model envelope otherwise.
   *
   * WHY THIS EXISTS NOW. The display used to print a month unless the employer
   * initial was supplied, on the reasoning that "DOL publishes at MONTH
   * resolution and works alphabetically within it, so the initial is the only
   * thing that says where in the month a case falls". That was true of every
   * model anchored to a filing month. It is NOT true of decision-pace, which
   * counts the undecided cases filed before yours - that number places you
   * inside the month directly, and it moves with the day you filed.
   *
   * So a day is printed when a day is earned, and the two things that earn one
   * are now the counting model and the measured initial, not the initial
   * alone. Leaving it as it was meant a reader could pick their filing day,
   * watch the arithmetic change underneath, and still be shown a month.
   *
   * It also settles a split between this page and the case page, which has
   * always shown the leading model's own band rather than a span across
   * models. Two surfaces describing one estimate should not disagree about
   * what the estimate is.
   */
  const lead = estimate.models[0] ?? null;
  const leadIsCounting = lead?.id === "decision-pace";
  const dayEarned = leadIsCounting || letterDelta !== null;
  const shown = useMemo(() => {
    if (leadIsCounting && lead?.earliestDate && lead?.latestDate) {
      return {
        anchor: lead.estimatedDate,
        earliest: lead.earliestDate,
        latest: lead.latestDate,
        fromLead: true,
      };
    }
    return envelope ? { ...envelope, fromLead: false } : null;
  }, [leadIsCounting, lead, envelope]);


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

  function handleDecode(parsed: { filingMonth: string; filingDate: string }) {
    // THE WARNING IS GONE BECAUSE THE RANGE IS. It existed to say "that month
    // is outside the range this calculator covers" - a dropdown of months
    // that already exist. The field takes any date now, so a decoded number
    // is simply accepted, day and all.
    setCaseWarning(null);
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.filingDate)) {
      setFiledOn(parsed.filingDate);
    } else if (/^\d{4}-\d{2}$/.test(parsed.filingMonth)) {
      setFiledOn(`${parsed.filingMonth}-15`);
    }
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
        {/* NO INTRO PARAGRAPH. It restated the heading ("When will DOL
            decide my PERM?" / "Pick the date DOL received your ETA-9089")
            and then added a provenance claim that the page makes again at
            the bottom. A label the reader is about to read does not need a
            paragraph introducing it. */}

        {/* `grid-cols-1` AND `[&>*]:min-w-0`, both required: below the
            breakpoint a grid with no column track sizes its items to their
            content, and on iOS a date control's content contribution comes
            from the user agent rather than from us. That pair is what fixed
            the form overflow across /tools and it is not optional here. */}
        <div className="mt-6 grid grid-cols-1 [&>*]:min-w-0 sm:max-w-xs">
          <div>
            <Label htmlFor={selectId} className="text-sm font-bold">
              {isFuture ? "Date you expect to file" : "Date DOL received your case"}
            </Label>
            <DateInput
              id={selectId}
              value={filedOn}
              onChange={(e) => {
                const v = e.target.value;
                // EMPTY IS A VALID STATE, not an invalid one. The first
                // version only accepted a complete date, so clearing the
                // field left the old answer on screen with nothing in the
                // box - the page said one thing and the control said another.
                if (v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v)) setFiledOn(v);
              }}
              // NO BORDER OR HEIGHT HERE. `DateInput` already carries
              // `border-2` and `shadow-hard-sm`; stacking another border on
              // top drew the heavy double-edged box a reader called out, and
              // `min-h-[44px]` fought its own `h-11`. Let the control style
              // itself.
              className="mt-2"
            />
          </div>
        </div>
        {/* ONE LINE, AND ONLY WHEN IT EARNS ITS PLACE. This was three
            sentences under every state. The midpoint hint is only useful
            while the field is EMPTY; the future-date arithmetic is only
            useful once a future date is actually chosen. Neither needs to
            be on screen the rest of the time. */}
        {!hasDate ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Only know the month? The 15th is a fair midpoint.
          </p>
        ) : isFuture ? (
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {filingRate
              ? `${pendingNow.toLocaleString("en-US")} waiting now, plus about ${Math.round(filingRate.perDay).toLocaleString("en-US")} a day filed before you get there.`
              : `${pendingNow.toLocaleString("en-US")} waiting now. Too little settled data to project the rest.`}
          </p>
        ) : null}

        {/* SECONDARY INPUTS ARE DISCLOSURES, NOT PEERS.
            All three fields used to sit at the same weight with a paragraph
            each - ten lines of grey prose before any answer existed. The
            reader knows one thing for certain (when they filed); the other
            two are refinements, and a refinement should not compete with the
            question. Both are one line closed.

            The alphabet's own explanation moved OUT of here: it explains a
            number, so it belongs beside the number it moves, under "How this
            was worked out", not under the control that feeds it. */}
        <details className="group mt-6 border-t-2 border-border pt-4">
            <summary className="cursor-pointer list-none text-sm font-bold marker:content-none">
              <span className="inline-flex items-center gap-2">
                <CaretRight
                  className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
                  aria-hidden="true"
                />
                Narrow it down
                <span className="font-normal text-muted-foreground">
                  employer initial, or a case number
                </span>
              </span>
            </summary>

            {/* `grid-cols-1` and `[&>*]:min-w-0` are not optional around a
                form control: below the breakpoint a grid with no column track
                sizes its items to their content, and on iOS a select's
                content contribution comes from the user agent. The gate
                caught this the moment the disclosure was added. */}
            <div className="mt-4 grid grid-cols-1 gap-5 [&>*]:min-w-0 sm:max-w-md">
              {alphabet ? (
                <div>
                  <Label htmlFor={`${selectId}-initial`} className="text-sm font-bold">
                    First letter of the employer&apos;s name
                  </Label>
                  <select
                    id={`${selectId}-initial`}
                    value={initial}
                    onChange={(e) => setInitial(e.target.value)}
                    className="mt-2 block w-full min-w-0 min-h-[44px] border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    <option value="">Any</option>
                    {alphabet.letters.map((l) => (
                      <option key={l.letter} value={l.letter}>
                        {l.letter}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

      
            </div>
        </details>

        <CaseNumberField
          className="mt-6"
          onDecode={handleDecode}
          warning={caseWarning}
        />
      </div>

      {/* THE ANSWER, at the size the question was asked. Everything in this
          band is a bound some model below already published, or arithmetic on
          the month the reader picked. */}
      {/* NOTHING BELOW RENDERS UNTIL A DATE IS CHOSEN. The page used to open
          on DOL's current frontier month and show a complete answer for a
          month nobody had picked - a date, a window, a queue position - which
          reads as "your estimate" rather than "an example". */}
      {!hasDate ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          <p className="text-base text-foreground/70">
            Pick a date above and this fills in: when DOL is likely to decide,
            the range around it, and where the case sits in the queue.
          </p>
        </div>
      ) : null}
      {hasDate && (shown || estimate.position === "overdue") ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          {shown ? (
            /* The anchor leads and the window follows. A range-only headline
               read as "we don't know" next to rivals printing one confident
               date; one date with no range is the opposite failure (the four
               public estimators disagree by ~9 months on identical input).
               So: the most defensible model's own date, big, with the full
               envelope right under it, and the models behind a disclosure
               rather than competing with it at display size. */
            <>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Most likely
              </p>{" "}
              {/* A DAY ONLY WHEN A DAY IS EARNED. DOL publishes at MONTH
                  resolution and works alphabetically within it, so the initial
                  is the only thing that says where in the month a case falls.
                  Without it the anchor is a month, because printing a day we
                  cannot place inside the month is precision we do not have. */}
              <p className="mt-2 font-heading text-3xl font-black leading-[1.05] sm:text-5xl">
                {dayEarned
                  ? `Around ${fmtDay(shown.anchor)}`
                  : `Around ${formatMonth(shown.anchor.slice(0, 7))}`}
              </p>{" "}
              <p className="mt-3 font-heading text-lg font-bold sm:text-xl">
                Likely decision window:{" "}
                {dayEarned ? (
                  <>
                    {fmtDay(shown.earliest)}
                    <span className="text-muted-foreground"> to </span>
                    {fmtDay(shown.latest)}
                  </>
                ) : shown.earliest.slice(0, 7) === shown.latest.slice(0, 7) ? (
                  formatMonth(shown.earliest.slice(0, 7))
                ) : (
                  <>
                    {formatMonth(shown.earliest.slice(0, 7))}
                    <span className="text-muted-foreground"> to </span>
                    {formatMonth(shown.latest.slice(0, 7))}
                  </>
                )}
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                {shown.fromLead
                  ? "If DOL holds its recent pace. That is a pace scenario, not a confidence interval - tested against past cases it contained the real decision date about 57% of the time, and closer to 41% within two months of a decision. The other models are under “How this was worked out” below."
                  : envelope && envelope.modelCount === 1
                    ? "One model has enough published data to answer for this month."
                    : `The window comes from ${envelope?.modelCount ?? 0} models on different bases, spread across ${envelope?.spanMonths ?? 0} months. They are never averaged into one number, because the spread is the honest part. Open "How this was worked out" to see each.`}
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
      {hasDate && frontier && position && !(estimate.position === "overdue" && !envelope) ? (
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
      {hasDate && months.length > 0 ? (
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

      {/* ONE ANSWER, THEN THE WORKING. These used to render side by side, each
          date at text-4xl, so the page showed up to four equally loud and
          different answers and left the reader to pick. The headline above is
          the answer; this is how it was reached, for anyone who wants it.
          Adam, 2026-09-10: "everything should be focused on one main answer,
          and the rest is secondary and you can see it if you'd like but not
          the main thing". */}
      {hasDate && estimate.models.length > 0 ? (
        <details className="group border-t-2 border-border">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 p-6 sm:p-8">
            <span className="font-heading text-base font-black">
              How this was worked out
            </span>{" "}
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {estimate.models.length}{" "}
              {estimate.models.length === 1 ? "model" : "models"}
              <span className="ml-2 inline-block transition-transform group-open:rotate-90">
                &rsaquo;
              </span>
            </span>
          </summary>
          <div className="divide-y-2 divide-border border-t-2 border-border">
          {estimate.models.map((model, i) => (
            <div key={model.id} className="p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                {model.label}
                {i === 0 ? (
                  <span className="ml-2 text-primary">· the one above</span>
                ) : null}
              </p>{" "}
              {/* Secondary size on purpose. A model in here is the WORKING,
                  and at display size it competes with the answer. */}
              <p className="mt-2 font-heading text-xl font-black leading-tight sm:text-2xl">
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
        </details>
      ) : (
        <div className="p-6 sm:p-8">
          <p className="text-base leading-relaxed">
            There isn’t enough published DOL data to put a date on this filing
            month yet.
          </p>
        </div>
      )}

      {/* THE ALPHABET'S EXPLANATION, BESIDE THE NUMBER IT MOVES.
          It used to sit under the letter select as three lines of prose that
          every reader saw whether or not they had chosen a letter. It
          explains a term that only exists once a letter IS chosen, so it
          belongs here and only then. Relocated, not deleted - the
          measurement is the reason anyone should believe the shift is small. */}
      {hasDate && alphabet && letterDelta !== null ? (
        <p className="border-t-2 border-border px-6 py-4 text-sm text-muted-foreground sm:px-8">
          DOL works a filing month alphabetically by employer.{" "}
          <span className="font-bold text-foreground">
            {initial || "This initial"} moves it{" "}
            {Math.abs(Math.round(letterDelta))}{" "}
            {Math.abs(Math.round(letterDelta)) === 1 ? "day" : "days"}{" "}
            {letterDelta < 0 ? "earlier" : "later"}
          </span>
          . The whole alphabet is worth about{" "}
          {Math.round(
            Math.max(...alphabet.letters.map((l) => l.deltaDays)) -
              Math.min(...alphabet.letters.map((l) => l.deltaDays)),
          )}{" "}
          days, over {alphabet.cases.toLocaleString("en-US")} decided cases.
        </p>
      ) : null}

      {/* The models above give dates. This gives the reasoning behind them, and
          it is the one series on the page that DOL does not publish. */}
      {hasDate && frontierHistory.length >= 2 ? (
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
      {hasDate && estimate.caveats.length > 0 ? (
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
