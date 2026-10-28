/**
 * The per-case decision estimate: cohort models, adjusted for the stage the
 * case is actually at.
 *
 * COMPOSITION, NOT A NEW MODEL. The models come from the canonical
 * `estimateQueueDecision` (the same composite the timeline calculator
 * renders); the stage placement comes from `queueForecast`'s measured
 * percentile table (RFI sits at its cohort's p90, a hold at p75, appeals get
 * no percentile at all). This file only decides which piece speaks for one
 * concrete case, and where the honest answer is a refusal.
 *
 * THE ESTIMATE IS LABELED AS AN ESTIMATE, EVERYWHERE IT RENDERS. The case
 * page's first block is still the federal record; this is the block after
 * it, and it never upgrades a cohort statistic into a promise about the
 * case. The page's remaining structural refusal - no odds scoring - stands:
 * a date window from a named model is checkable, "87% chance of approval"
 * is not.
 */

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

import {
  estimateQueueDecision,
  estimateRfiCase,
  type EstimateModel,
  type EstimateModelId,
  type EstimateNote,
  type MeasuredPace,
  type RangeCoverage,
  type RangeNote,
  type RfiClock,
} from "@/lib/perm";
import { ESTIMATE_TEXT, type EstimateLibText, type StageKey } from "@/lib/caseEstimate.messages";
import { dayLabel, intLabel, monthLabel, percentLabel } from "@/lib/i18n/format";
import { intlLocale, type Lang } from "@/lib/i18n/lang";
import {
  COHORT_PERCENTILE_FACTOR,
  placeCaseInCohort,
} from "@/lib/queueForecast";
import type { StragglerRates } from "@/lib/stragglerRates";
import type { EstimatorData } from "@/lib/db/estimate";

export interface CaseEstimateInput {
  /**
   * Measured stage ages from `stage_stats`, keyed by status. Optional: absent,
   * `placeCaseInCohort` falls back to its own table, which is what shipped
   * before this existed.
   */
  measuredStageAges?: ReadonlyMap<string, number>;
  /**
   * Where cases at this status have actually been observed to go next, as a
   * share of the exits we watched. Optional and often absent.
   */
  stageExit?: { to: string; share: number; observed: number } | null;
  /**
   * How long this stage has actually been taking, or null while too few of the
   * cases we watched enter it have left for the median to be observed. Turns
   * itself on when the data supports it; nothing here needs a flag.
   */
  stageDuration?: {
    p50: number;
    eligible: number;
    entered: number;
    windowDays: number;
  } | null;
  /** The case's filing date, `YYYY-MM-DD`, or null when unknown. */
  filingDate: string | null;
  /** Live DOL status, or null. */
  status: string | null;
  isFinal: boolean;
  estimator: Pick<
    EstimatorData,
    "frontier" | "cohorts" | "frontierAdvance"
  > | null;
  /**
   * Undecided cases filed before this one, from the live census, or null.
   *
   * With it the decision-pace model runs and leads; without it the estimate
   * falls back to the month-granular models exactly as it did before. Never
   * approximated here - the census is the only thing that can count it.
   */
  casesAhead?: number | null;
  /**
   * DOL's measured decision rate and how long ago we measured it.
   *
   * `sweepAgeDays` is passed through rather than checked here because the
   * calculator's own refusal ladder owns that decision, and duplicating it
   * is how two surfaces end up disagreeing about whether a case is datable.
   */
  decisionPace?: MeasuredPace | null;
  sweepAgeDays?: number | null;
  /**
   * How fast DOL is deciding the in-line cases its queue has passed, measured
   * nightly, or null when that measurement is stale or thin. Only a case in
   * analyst review behind the queue uses it; without it that case gets no date.
   */
  stragglers?: StragglerRates | null;
  /** The nightly backtest's measurement of the printed range, quoted in its caveat. */
  rangeCoverage?: RangeCoverage | null;
  /**
   * For a case at RFI ISSUED: the day our sweep saw it enter RFI, and the RFI
   * clock the nightly backtest measures. With both, the case is dated from its
   * own RFI day (estimateRfiCase); without either, it gets what it got before.
   */
  rfi?: { enteredOn: string | null; clock: RfiClock | null } | null;
  /** `YYYY-MM-DD`, injected so the function stays pure. */
  today: string;
  /**
   * The language the estimate's sentences are in. English (the default) is the text the API and the scorecard
   * read, unchanged; a translated case page passes its own (src/lib/caseEstimate.messages.ts).
   */
  lang?: Lang;
}

export type CaseEstimate =
  | {
      kind: "date";
      /**
       * WHICH model produced the date and band.
       *
       * The UI needs it because a band's MEANING comes from its model, and
       * these are not the same kind of claim. `decision-pace` gives either
       * a range the nightly backtest measured for that distance or, where
       * none is measured yet, a pace scenario that held for under half of
       * real decisions; its caveat quotes which and how often it held.
       * `queue-advance` gives the spread of DOL's own observed frontier
       * movement. Labelling them the same way is how a scenario gets read as
       * a confidence interval.
       */
      modelId: EstimateModelId;
      /** decision-pace only: whether the range was measured or the pace rule's. */
      rangeFrom?: "measured" | "pace";
      /** Stage-adjusted central estimate, `YYYY-MM-DD`. */
      estimatedDate: string;
      /** The unadjusted model date, for the delta line. */
      modelDate: string;
      earliestDate: string | null;
      latestDate: string | null;
      /** Stage-adjusted calendar days from filing. */
      totalDays: number;
      /** Which model produced the base figure. */
      modelLabel: string;
      basis: string;
      source: string;
      /** Null when the status is unmeasured and the estimate is unadjusted. */
      stage: { percentile: number; note: string } | null;
      caveats: string[];
    }
  | {
      kind: "no-date";
      /** Why no date exists for this case, in one sentence. */
      note: string;
      /**
       * A measured waiting time, and WHOSE it is.
       *
       * Two producers mean different things: the stage branch carries the
       * measured population mean for the stage (170 to 714 days, from
       * queueForecast), and the overdue branch carries `today - this case's
       * filing date`. One sentence for both ("Cases at this stage have been
       * pending a measured average of N days") would present one case's own
       * wait as a population average, and nobody would notice, because both
       * numbers are in the same range and both look plausible. The
       * discriminator is here so the copy cannot claim more than the number
       * is.
       */
      age:
        | { of: "stage"; days: number }
        | { of: "this-case"; days: number };
      /**
       * What usually happens NEXT at this stage, when we have watched enough
       * exits to say. This is the most useful true thing available to a reader
       * whose case has no date: of the RFI exits observed, about nine in ten
       * return to ANALYST REVIEW rather than to a decision, so an RFI is a
       * detour back into the ordinary queue and not an endpoint.
       *
       * Destinations only. The event log cannot see an entry from before it
       * opened, so it can say WHERE a case goes and nothing about how
       * long it takes to get there.
       */
      nextStep?: { to: string; share: number; observed: number } | null;
      /** Measured time at this stage, once enough watched entrants have left. */
      stageDuration?: {
        p50: number;
        eligible: number;
        entered: number;
        windowDays: number;
      } | null;
    };

/* ------------------------------------------------------------------ */
/* The sentences in a translated page's language, from the same figures */
/* ------------------------------------------------------------------ */

type Translation = { t: EstimateLibText; lang: Exclude<Lang, "en"> };

const num = (v: number, x: Translation) => intLabel(v, x.lang);
const share = (v01: number, x: Translation) => percentLabel(Math.round(v01 * 100), x.lang, 0);
const monthIn = (ym: string, x: Translation) => monthLabel(ym, x.lang) ?? ym;
const dayIn = (iso: string, x: Translation) => dayLabel(iso, x.lang) ?? iso;
const decimal2 = (v: number, x: Translation) =>
  new Intl.NumberFormat(intlLocale(x.lang), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
/** A lead-in and the sentence after it: a space between them, none in Chinese. */
const joined = (x: Translation, ...parts: string[]) => parts.join(x.lang === "zh" ? "" : " ");

function rangeIn(r: RangeNote, x: Translation): string {
  const { t } = x;
  switch (r.kind) {
    case "measured-served":
    case "measured-row": {
      const sentence = r.kind === "measured-served" ? t.rangeServed : t.rangeRow;
      const wait = t.waitDays(r.judgeDays, num(r.judgeDays, x));
      return joined(x, t.rangeMeasuredLead, sentence(num(r.judged, x), share(r.insideShare, x), share(r.stuckShare, x), wait));
    }
    case "measured":
      return t.rangeMeasuredLead;
    case "pace-far":
      return joined(x, t.rangePaceLead, t.rangeFar);
    case "pace-untested":
      return joined(x, t.rangePaceLead, t.rangeUntested);
    case "pace-tested":
      return joined(
        x,
        t.rangePaceLead,
        t.rangeTested(
          percentLabel(r.insidePct, x.lang, 0),
          num(r.judged, x),
          r.within7Pct !== null ? percentLabel(r.within7Pct, x.lang, 0) : null,
        ),
      );
  }
}

function noteIn(n: EstimateNote, x: Translation): string {
  const { t } = x;
  switch (n.kind) {
    case "overdue":
      return t.overdue(monthIn(n.filingMonth, x), n.months, num(n.months, x));
    case "range":
      return rangeIn(n.range, x);
    case "pace-absent": {
      const why =
        n.why === "stale-data"
          ? t.paceStale(n.sweepAgeDays, num(n.sweepAgeDays, x))
          : n.why === "pace-unmeasurable"
            ? t.paceUnmeasurable
            : n.why === "no-count"
              ? t.paceNoCount
              : t.paceNoRate;
      return joined(x, t.paceAbsent, why);
    }
    case "cohort-unstarted":
      return t.cohortUnstarted(monthIn(n.filingMonth, x));
    case "cohort-open":
      return t.cohortOpen(monthIn(n.filingMonth, x));
    case "no-data":
      return t.noData;
    case "out-of-order":
      return t.outOfOrder;
  }
}

/** A model's label, basis and source from its figures; the English when a model carries none. */
function modelIn(m: EstimateModel, x: Translation): { label: string; basis: string; source: string } {
  const { t } = x;
  const f = m.facts;
  if (!f) return { label: m.label, basis: m.basis, source: m.source };
  switch (f.id) {
    case "decision-pace":
      return {
        label: t.modelLabel["decision-pace"],
        basis: t.basisPace(num(f.casesAhead, x), num(f.pace, x), num(f.rawDays, x)),
        source: t.sourcePace,
      };
    case "queue-advance":
      return {
        label: t.modelLabel["queue-advance"],
        basis: t.basisAdvance(monthIn(f.queueMonth, x), f.monthsBehind, num(f.monthsBehind, x), decimal2(f.rate, x)),
        source: t.sourceAdvance(dayIn(f.asOf, x)),
      };
    case "dol-average":
      return {
        label: t.modelLabel["dol-average"],
        basis: t.basisAverage(num(f.avgDays, x)),
        source: t.sourceAverage(dayIn(f.asOf, x)),
      };
    case "cohort-percentile":
      return {
        label: t.modelLabel["cohort-percentile"],
        basis: t.basisCohort(num(f.decided, x), monthIn(f.month, x), num(f.medianDays, x)),
        source: t.sourceCohort,
      };
    case "cohort-shape":
      return {
        label: t.modelLabel["cohort-shape"],
        basis: t.basisShape(num(f.decided, x), num(f.total, x), monthIn(f.month, x), num(f.fromPercentile, x)),
        source: t.sourceShape,
      };
  }
}

/** A stage's note from the stage table, in the page's language. */
function stageNoteIn(status: string | null, english: string, x: Translation | null): string {
  if (!x || !status) return english;
  return x.t.stage[status.trim().toUpperCase() as StageKey] ?? english;
}

/**
 * Build the estimate for one case, or null when nothing defensible exists.
 *
 * Null - never a guess - for: a decided case (nothing left to estimate), a
 * case with no filing date (A- numbers cannot be date-decoded), missing
 * estimator data (deploy skew), or a month no model can speak to.
 */
export function buildCaseEstimate(input: CaseEstimateInput): CaseEstimate | null {
  if (input.isFinal) return null;
  const lang = input.lang ?? "en";
  const x: Translation | null = lang === "en" ? null : { t: ESTIMATE_TEXT[lang], lang };
  if (!input.filingDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.filingDate)) return null;

  // A decision already EXISTS for this case - the outcome just hasn't
  // settled into the live status yet. Offering "when could this be decided"
  // here would estimate an event that has already happened, which is the
  // most checkably-wrong sentence this page could print. Caught on the first
  // rendered QA pass against a real case in exactly this state.
  const canon = input.status?.trim().toUpperCase().replace(/\s+/g, " ");
  if (canon === "DETERMINATION ISSUED") return null;

  // AN RFI IS DATED FROM ITS OWN DAY (Oct 8 2026). It isn't in filing order,
  // so the cases-ahead date doesn't apply; the record does. Of the RFIs our
  // sweep followed from their first day, nearly all moved on day 31 of our
  // record (the 30-day response window, seen a day late), most went back to
  // analyst review, and DOL decided those a few days later.
  const clock = input.rfi?.clock ?? null;
  if (canon === "RFI ISSUED" && clock && input.rfi?.enteredOn) {
    const r = estimateRfiCase({ enteredOn: input.rfi.enteredOn, today: input.today, clock });
    if (r.kind === "estimate") {
      const entered = input.rfi.enteredOn;
      const longDay = (iso: string) => format(parseISO(iso), "MMMM d, yyyy");
      const caveats = x
        ? [
            clock.slowEndFrom === "measured"
              ? x.t.rfiLateMeasured(num(clock.slowEndDays, x))
              : x.t.rfiLateEstimate(num(clock.slowEndDays, x)),
            x.t.rfiMoreTime,
          ]
        : [
            clock.slowEndFrom === "measured"
              ? `The late end allows ${clock.slowEndDays} days after the 30, the slowest tenth of the RFIs we've followed.`
              : `The late end allows ${clock.slowEndDays} days after the 30, an immigration attorney's estimate, until our record has followed enough RFIs that long to measure it.`,
            "An employer can ask for more time, and DOL can ask a second time; either moves the date, and the status above will show it.",
          ];
      if (clock.test && clock.test.decided >= 30 && clock.test.typicalMissDays !== null) {
        caveats.push(
          x
            ? x.t.rfiTested(
                num(clock.test.judged, x),
                clock.test.typicalMissDays,
                num(clock.test.typicalMissDays, x),
                share(clock.test.insideShare, x),
              )
            : `Tested on ${clock.test.judged.toLocaleString("en-US")} RFIs from days it wasn't drawn from, the date was typically ${clock.test.typicalMissDays} ${clock.test.typicalMissDays === 1 ? "day" : "days"} off and ${Math.round(clock.test.insideShare * 100)}% were decided inside the range.`,
        );
      }
      return {
        kind: "date",
        modelId: "rfi-clock",
        estimatedDate: r.date,
        modelDate: r.date,
        earliestDate: r.earliest,
        latestDate: r.latest,
        totalDays: differenceInCalendarDays(parseISO(r.date), parseISO(input.filingDate)),
        modelLabel: x ? x.t.modelLabel["rfi-clock"] : "Request for information",
        basis: x
          ? x.t.rfiBasis(dayIn(entered, x), num(clock.watched, x), num(clock.leaveDays.p50, x), num(clock.afterLeaveDays.p50, x))
          : `Our daily check saw DOL issue a request for information on this case on ${longDay(entered)}. ` +
            `Of the ${clock.watched.toLocaleString("en-US")} RFIs we've followed from their first day, nearly all moved on day ${clock.leaveDays.p50} of our record ` +
            `(the 30-day response window; the check sees each move a day after DOL makes it), most went back to analyst review, ` +
            `and DOL decided those a median ${clock.afterLeaveDays.p50} days later.`,
        source: x
          ? x.t.sourceCheck
          : "PERM Tracker's daily check of every pending PERM case on DOL's FLAG system, measured again every night",
        stage: null,
        caveats,
      };
    }
    if (r.reason === "past-window") {
      return {
        kind: "no-date",
        note: x
          ? x.t.rfiPastWindow(
              num(r.daysInRfi ?? differenceInCalendarDays(parseISO(input.today), parseISO(input.rfi.enteredOn)), x),
            )
          : r.detail,
        age: { of: "this-case", days: differenceInCalendarDays(parseISO(input.today), parseISO(input.filingDate)) },
        nextStep: input.stageExit ?? null,
        stageDuration: input.stageDuration ?? null,
      };
    }
  }

  // Appeals first: they are a different proceeding, and even a perfect cohort
  // model has no standing to date them. The measured age is the honest read.
  const place = placeCaseInCohort(input.status, input.measuredStageAges);
  if (place && place.percentile === null) {
    return {
      kind: "no-date",
      note: stageNoteIn(input.status, place.note, x),
      age: { of: "stage", days: place.observedAgeDays },
      nextStep: input.stageExit ?? null,
      stageDuration: input.stageDuration ?? null,
    };
  }

  if (!input.estimator) return null;

  const est = estimateQueueDecision({
    filingDate: input.filingDate,
    today: input.today,
    frontier: input.estimator.frontier,
    cohorts: input.estimator.cohorts,
    frontierAdvanceRate: input.estimator.frontierAdvance
      ? input.estimator.frontierAdvance.rate
      : null,
    casesAhead: input.casesAhead ?? null,
    decisionPace: input.decisionPace ?? null,
    sweepAgeDays: input.sweepAgeDays ?? null,
    rangeCoverage: input.rangeCoverage ?? null,
    frontierAdvanceRange:
      input.estimator.frontierAdvance &&
      input.estimator.frontierAdvance.slowest &&
      input.estimator.frontierAdvance.fastest
        ? {
            slowest: input.estimator.frontierAdvance.slowest,
            fastest: input.estimator.frontierAdvance.fastest,
          }
        : null,
  });

  // A CASE STILL IN LINE BEHIND THE QUEUE IS DATED BY THE RATE DOL IS
  // DECIDING EXACTLY THAT GROUP AT, even while DOL's published average would
  // still name a future day (Oct 7 2026). That average is filed + ~336 days,
  // a mean dragged out by audits, and on the day DOL moved past November 2025
  // it dated the 3,194 November cases still in analyst review typically 29
  // days late; the measured rate was typically 6 days off, and level or best
  // on every origin tested. scripts/backtest_queue.py re-measures it nightly
  // (its "passed" section).
  const s = input.stragglers;
  if (est.position === "overdue" && canon === "ANALYST REVIEW" && s) {
    const today = parseISO(input.today);
    const at = (n: number) => format(addDays(today, n), "yyyy-MM-dd");
    const passedBy =
      est.monthsBehindFrontier !== null ? Math.abs(est.monthsBehindFrontier) : null;
    return {
      kind: "date",
      modelId: "stragglers",
      estimatedDate: at(s.medianDays),
      modelDate: at(s.medianDays),
      earliestDate: at(1),
      latestDate: at(s.p80Days),
      totalDays: differenceInCalendarDays(addDays(today, s.medianDays), parseISO(input.filingDate)),
      modelLabel: x ? x.t.modelLabel.stragglers : "Behind DOL's queue",
      basis: x
        ? x.t.stragglerBasis({
            months: passedBy,
            monthsText: passedBy ? num(passedBy, x) : "",
            windowDays: num(s.windowDays, x),
            decided: num(s.decided, x),
            pool: num(s.pool, x),
            rate: share(s.dailyRate, x),
            median: num(s.medianDays, x),
            p80: num(s.p80Days, x),
          })
        : `DOL's queue ${passedBy ? `passed this filing month ${passedBy} month${passedBy === 1 ? "" : "s"} ago` : "has passed this filing month"}, ` +
          `and this case is still in analyst review. Over the last ${s.windowDays} days DOL decided ` +
          `${s.decided.toLocaleString("en-US")} of the ${s.pool.toLocaleString("en-US")} cases in the same spot, ` +
          `about ${Math.round(s.dailyRate * 100)}% a day: half within ${s.medianDays} days, eight in ten within ${s.p80Days}.`,
      source: x
        ? x.t.sourceCheck
        : "PERM Tracker's daily check of every pending PERM case on DOL's FLAG system, measured again every night",
      stage: null,
      caveats: [
        x
          ? x.t.stragglerCaveat
          : "A case can still leave the line for an audit, a request for information or a hold, and a rate can't see that coming. If the status above changes, this estimate does too.",
      ],
    };
  }
  // Models arrive most-defensible-first; the head is the one the timeline
  // page leads with too. No models means no answer, not a made-up one -
  // except the overdue case, where the absence IS the answer: the calculator
  // withholds every filing-anchored model once the frontier has passed the
  // month (their dates have already elapsed), and what remains true is that
  // a case still pending here is out of filing order.
  const model = est.models[0];
  if (!model) {
    if (est.position === "overdue") {
      const passedBy =
        est.monthsBehindFrontier !== null
          ? Math.abs(est.monthsBehindFrontier)
          : null;
      return {
        kind: "no-date",
        nextStep: input.stageExit ?? null,
        stageDuration: input.stageDuration ?? null,
        note: x
          ? x.t.overdueNote(passedBy, passedBy ? num(passedBy, x) : "")
          : `DOL's queue ${passedBy ? `passed this filing month ${passedBy} month${passedBy === 1 ? "" : "s"} ago` : "has passed this filing month"}. ` +
            "A case still pending at that point has usually been taken out of filing order by an audit, a request for information, or a hold, and none of those can be dated from the filing month. The live status above is the accurate read.",
        // THIS case's own wait, not a population statistic. The overdue
        // branch has no measured stage to average over - that is what makes
        // it the overdue branch.
        age: {
          of: "this-case",
          days: differenceInCalendarDays(
            parseISO(input.today),
            parseISO(input.filingDate),
          ),
        },
      };
    }
    return null;
  }

  const factor =
    place && place.percentile !== null
      ? (COHORT_PERCENTILE_FACTOR[place.percentile] ?? 1)
      : 1;

  const filing = parseISO(input.filingDate);
  const shiftDate = (iso: string | null): string | null => {
    if (!iso) return null;
    const days = differenceInCalendarDays(parseISO(iso), filing);
    return format(addDays(filing, Math.round(days * factor)), "yyyy-MM-dd");
  };

  const totalDays = Math.round(model.totalDays * factor);
  const caveats = x ? est.notes.map((n) => noteIn(n, x)) : [...est.caveats];
  if (!place && input.status) {
    caveats.push(
      x
        ? x.t.unmeasuredStage
        : "This status hasn't been measured against its filing month, so the estimate reads the middle of the month rather than adjusting for the stage.",
    );
  }
  const words = x ? modelIn(model, x) : { label: model.label, basis: model.basis, source: model.source };

  return {
    kind: "date",
    modelId: model.id,
    ...(model.rangeFrom ? { rangeFrom: model.rangeFrom } : {}),
    estimatedDate: format(addDays(filing, totalDays), "yyyy-MM-dd"),
    modelDate: model.estimatedDate,
    earliestDate: shiftDate(model.earliestDate),
    latestDate: shiftDate(model.latestDate),
    totalDays,
    modelLabel: words.label,
    basis: words.basis,
    source: words.source,
    stage:
      place && place.percentile !== null
        ? { percentile: place.percentile, note: stageNoteIn(input.status, place.note, x) }
        : null,
    caveats,
  };
}
