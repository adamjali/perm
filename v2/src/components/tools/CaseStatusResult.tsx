import Link from "next/link";
import { FinePrint } from "@/components/data/FinePrint";
import { Fragment } from "react";
import { BellIcon, WarningIcon } from "@phosphor-icons/react/ssr";

import { ChartTips } from "@/components/data/ChartTips";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { InsightLede, Verdict } from "@/components/tools/Insight";
import { CaseAlertForm } from "@/components/tools/CaseAlertForm";
import { CaseMilestones } from "@/components/tools/CaseMilestones";
import { CasePushAlert } from "@/components/tools/CasePushAlert";
import {
  CaseEstimate,
  CaseEstimatePanel,
  ESTIMATE_ANCHOR,
} from "@/components/tools/CaseEstimate";
import { CaseNumberPlate } from "@/components/tools/CaseNumberPlate";
import { SameDayCases } from "@/components/tools/SameDayCases";
import { QueueTape } from "@/components/tools/QueueTape";
import {
  CaseWall,
  CohortNeighbours,
  PastFrontNote,
} from "@/components/tools/CaseWall";
import {
  canQuoteCohortDuration,
  cohortMaturity,
  daysElapsed,
  statusCheckAge,
  type Wall,
} from "@/lib/casePosition";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import { PendingCensus } from "@/components/queue/PendingCensus";
import { StageBar, StageLegend } from "@/components/queue/StageBar";
import { groupByStage, prettyStatus } from "@/components/queue/stages";
import type { StatusCount } from "@/lib/liveQueue";
import { getStatusMeaning, KIND_LABEL } from "@/lib/permStatus";
import { statusAnchor } from "@/lib/statusDictionary";
import { isApproval } from "@/lib/caseStatusVocabulary";
import { parseCaseNumber } from "@/lib/permCaseNumber";
import type { RangeCoverage, RfiClock } from "@/lib/perm";
import { buildCaseEstimate, type CaseEstimate as Estimate } from "@/lib/caseEstimate";
import type { SameDay } from "@/lib/sameDay";
import type { CaseLookupResult } from "@/lib/turso/caseLookup";
import type { CaseWageContext, CohortDuration } from "@/lib/turso/caseContext";
import type { CohortMonth } from "@/lib/liveQueue";
import { cn } from "@/lib/utils";
import { DOL_CASE_STATUS_URL } from "@/components/queue/SourceNote";
import { formatInt } from "@/lib/format";

/**
 * Everything this project can honestly say about one case, arranged.
 *
 * ORDERED BY CERTAINTY, top to bottom, and that ordering is the argument.
 * The record first, because it is a fact about this case. Then the position,
 * which is a measurement taken today over a named population. Then the
 * status decoded, which is regulation. Then the comparisons, which are
 * statistics about other people. Then, last and explicitly, the things this
 * page refuses to say. A reader who stops early stops on firmer ground.
 *
 * THE TWO REFUSALS ARE STRUCTURAL, NOT EDITORIAL. No decision date is
 * predicted for the case, and its odds are never scored. The status figure
 * is a scale (how many cases sit in this status now) and never a
 * transition probability, because the mirror holds one observation per case
 * and cannot see transitions. Both are stated on the page rather than merely
 * observed in the code, since a reader cannot audit what they cannot see.
 */

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/** Below this many decided cases, a percentage is arithmetic on an anecdote. */
const MIN_RATE_SAMPLE = 20;

/** Where the answer card's "Email me when it changes" lands. */
const WATCH_ANCHOR = "watch";

export interface CaseStatusResultProps {
  result: CaseLookupResult;
  backlog: readonly CohortMonth[];
  cohortStatuses: readonly StatusCount[];
  wall: Wall | null;
  neighbours: readonly CohortMonth[];
  /** DOL's published analyst-review priority date, "YYYY-MM". */
  publishedFront: string | null;
  /** DOL's own as-of stamp for that position. */
  publishedAsOf: string | null;
  wage: CaseWageContext | null;
  duration: CohortDuration | null;
  /** Estimator data for the stage-aware estimate block. Null degrades to no block. */
  estimator: Parameters<typeof CaseEstimate>[0]["estimator"];
  /** Undecided cases filed before this one, or null when uncountable. */
  casesAhead?: number | null;
  /** DOL's measured decision rate, or null when unmeasurable. */
  decisionPace?: Parameters<typeof CaseEstimate>[0]["decisionPace"];
  sweepAgeDays?: number | null;
  stragglers?: Parameters<typeof CaseEstimate>[0]["stragglers"];
  /** The weekly backtest's measurement of the printed range, quoted under it. */
  rangeCoverage?: RangeCoverage | null;
  /** Measured stage ages, so the estimate reads today's numbers not a table. */
  measuredStageAges?: ReadonlyMap<string, number>;
  /** What usually happens next at this case's stage, when measurable. */
  stageExit?: { to: string; share: number; observed: number } | null;
  /** Measured time at this stage, once the data supports a median. */
  stageDuration?: {
    p50: number;
    eligible: number;
    entered: number;
    windowDays: number;
  } | null;
  /** For a case at RFI ISSUED: its RFI day and the measured RFI clock. */
  rfi?: { enteredOn: string | null; clock: RfiClock | null } | null;
  /** The PERM cases filed the same day, or null when unknown. */
  sameDay?: SameDay | null;
  /** "YYYY-MM-DD", passed in so every elapsed figure shares one clock. */
  today: string;
}

/**
 * Does DOL's disclosure record show a decision on this case?
 *
 * A decision is not the same as the case being OVER. A denial can be appealed
 * within 30 days (20 CFR 656.24(g)) and the case re-enters processing, which
 * is why this asks "is there a decision on the record" and not "is this case
 * finished". The two questions have different answers for six cases in the
 * corpus and the difference is the whole point of the banner it feeds.
 */
function isTerminalOnRecord(status: string): boolean {
  return ["certified", "denied", "withdrawn"].includes(status.toLowerCase());
}

export function CaseStatusResult({
  result,
  cohortStatuses,
  wall,
  neighbours,
  publishedFront,
  publishedAsOf,
  wage,
  duration,
  estimator,
  casesAhead = null,
  decisionPace = null,
  sweepAgeDays = null,
  stragglers = null,
  rangeCoverage = null,
  measuredStageAges,
  stageExit,
  stageDuration,
  rfi = null,
  sameDay,
  today,
}: CaseStatusResultProps) {
  const { live, decided, cohort, employer, statusOutlook } = result;

  // The live mirror knows about pending cases; DOL's disclosure files know
  // about decided ones and carry fields the mirror does not. Either can be
  // the only source present, so the status shown is whichever exists, with
  // the live one winning because it is the more current of the two.
  const status = live?.status ?? (decided ? decided.status.toUpperCase() : null);
  const meaning = status ? getStatusMeaning(status) : null;
  const isFinal = live ? live.isFinal : decided !== null;
  const filingDate = live?.filingDate ?? decided?.receivedDate ?? null;
  const parsed = parseCaseNumber(result.caseNumber);
  const check = statusCheckAge(live?.lastCheckedAt, today);
  const elapsed = daysElapsed(filingDate, today);
  // Built once: the answer card names its date and the panel below explains
  // it, so the two can never disagree.
  const estimate = buildCaseEstimate({
    filingDate,
    status,
    isFinal,
    estimator,
    casesAhead,
    decisionPace,
    sweepAgeDays,
    stragglers,
    rangeCoverage,
    measuredStageAges,
    stageExit,
    stageDuration,
    rfi,
    today,
  });

  // 54 cases in 277,016 carry a live status that contradicts DOL's decided
  // record. It is 0.02% of the overlap and it is the whole ballgame when it
  // is YOUR case, so it gets said rather than resolved by picking a winner.
  //
  // THE `live.isFinal` REQUIREMENT MISSED A WHOLE CLASS. Six cases read
  // "denied" in DOL's disclosure file and "RECONSIDERATION APPEALS" in the
  // live mirror. Those are not a stale source: a denial is NOT terminal, and
  // 20 CFR 656.24(g) gives the employer 30 days to ask the Certifying Officer
  // to reconsider, which puts the case back into processing. The mirror is the
  // CORRECT one there and the page rightly shows the appeal - but it said
  // nothing about DOL's file recording a denial, so somebody whose employer
  // had appealed saw no sign that a denial existed at all.
  //
  // So the banner now covers both directions, and `reopened` distinguishes
  // them, because they need opposite wording: one is two sources disagreeing,
  // the other is one case that genuinely moved twice.
  const reopened =
    !!live && !!decided && !live.isFinal && isTerminalOnRecord(decided.status);
  const sourcesDisagree =
    !!live &&
    !!decided &&
    live.isFinal &&
    !live.status.toLowerCase().startsWith(decided.status.toLowerCase());

  return (
    <div>
      <Answer
        status={status}
        isFinal={isFinal}
        meaning={meaning}
        filingDate={filingDate}
        elapsed={elapsed}
        wall={wall}
        decided={decided}
        check={check}
        publishedFront={publishedFront}
        publishedAsOf={publishedAsOf}
        casesAhead={casesAhead}
        estimate={estimate}
      />

      {check?.stale && !isFinal ? (
        <p className="mt-6 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base leading-relaxed text-foreground/80">
          <WarningIcon
            className="mt-1 h-4 w-4 shrink-0 text-data-warn-ink"
            weight="fill"
            aria-hidden="true"
          />{" "}
          <span>
            <b className="font-bold text-data-warn-ink">
              DOL showed this status {check.ageDays} days ago
            </b>
            , on {formatAsOf(check.date)}, and it hasn&apos;t been checked since. A recent change shows first
            on{" "}
            {/* DOL's case-status search, not its processing-times page, which can't show one case. */}
            <a
              href={DOL_CASE_STATUS_URL}
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              flag.dol.gov
            </a>
            , DOL&apos;s own status page.
          </span>
        </p>
      ) : null}

      {reopened && decided && live ? (
        <p className="mt-6 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base leading-relaxed text-foreground/80">
          <WarningIcon
            className="mt-1 h-4 w-4 shrink-0 text-data-warn-ink"
            weight="fill"
            aria-hidden="true"
          />{" "}
          <span>
            <b className="font-bold text-data-warn-ink">
              DOL&apos;s file records a decision on this case, and it is back in
              processing.
            </b>{" "}
            DOL&apos;s quarterly file shows it {decided.status.toLowerCase()}
            {decided.decisionDate ? <> on {formatAsOf(decided.decisionDate)}</> : null}
            ; DOL&apos;s live status is now {prettyStatus(live.status).toLowerCase()}, which is current. That&apos;s
            normal: a denial can be appealed within 30 days under{" "}
            <a
              href="https://www.ecfr.gov/current/title-20/section-656.24"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              20 CFR 656.24(g)
            </a>
            .
          </span>
        </p>
      ) : null}

      {sourcesDisagree && decided && live ? (
        <p className="mt-6 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base leading-relaxed text-foreground/80">
          <WarningIcon
            className="mt-1 h-4 w-4 shrink-0 text-data-warn-ink"
            weight="fill"
            aria-hidden="true"
          />{" "}
          <span>
            <b className="font-bold text-data-warn-ink">
              The two federal sources disagree about this case.
            </b>{" "}
            DOL&apos;s quarterly disclosure file records it as{" "}
            {decided.status.toLowerCase()}; the live status page shows{" "}
            {prettyStatus(live.status).toLowerCase()}. About one case in five thousand does this, usually after
            moving once the file closed. Both are shown below.
          </span>
        </p>
      ) : null}


      {/* The estimate, right after the answer: the question that brought
          most readers here, answered by the canonical models and adjusted for
          the stage this case is actually at. Renders nothing when no
          defensible estimate exists. */}
      {estimate ? <CaseEstimatePanel est={estimate} dateShownAbove={!isFinal} /> : null}{" "}
      {/* Only while the case can still change. On a decided one this would
          promise mail that can never arrive. Directly beneath the estimate on
          purpose: "email me when this changes" is the next step after reading
          a window, and the answer card's button lands here. */}
      {!isFinal ? (
        <div id={WATCH_ANCHOR} className="scroll-mt-[calc(var(--site-header-max-h,4.5rem)+1rem)]">
          <CaseAlertForm caseNumber={result.caseNumber} className="mt-8" />{" "}
          <CasePushAlert caseNumber={result.caseNumber} className="mt-4" />
        </div>
      ) : null}{" "}
      {/* The record's details below the next steps: the answer card already
          states the status, the filing date and the queue, so these two cards
          are reference, not the answer. */}
      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        {parsed ? (
          <CaseNumberPlate parsed={parsed} recordedFilingDate={filingDate} />
        ) : null}
        <TheRecord
          result={result}
          status={status}
          filingDate={filingDate}
          elapsed={elapsed}
          isFinal={isFinal}
          check={check}
        />
      </section>
      {/* After DOL: the I-140 and I-485 have no federal per-case record, so
          this is the only trace of them, as labelled user reports. Rendered for
          decided cases too, because a certified PERM is exactly the case whose
          next stage people want to compare notes on. */}
      <CaseMilestones caseNumber={result.caseNumber} className="mt-8" />{" "}
      {/* The cohort a reader actually compares themselves with: the cases
          DOL numbered the same day, and the ones right beside this number. */}
      {sameDay ? <SameDayCases data={sameDay} className="mt-8" /> : null}{" "}
      {!isFinal && wall ? (
        <Position
          wall={wall}
          cohort={cohort}
          publishedFront={publishedFront}
          publishedAsOf={publishedAsOf}
        />
      ) : null}

      {decided ? (
        <TheDecision decided={decided} duration={duration} cohort={cohort} wage={wage} />
      ) : null}

      {meaning ? (
        <StatusExplainer
          meaning={meaning}
          nowInStatus={statusOutlook?.nowInStatus ?? null}
        />
      ) : status ? (
        <UndecodedStatus status={status} />
      ) : null}

      {!isFinal && cohortStatuses.length > 0 && cohort ? (
        <CohortQueues counts={cohortStatuses} month={cohort.month} />
      ) : null}

      {!isFinal && result.censusMissing ? (
        <p role="status" className="mt-10 max-w-2xl border-2 border-border bg-tint-primary p-4 text-base leading-relaxed">
          <span className="font-bold">Some sections are missing today.</span> The daily count of every
          pending case, which places this one in its filing month and against its neighbours,
          couldn&apos;t be read or is more than eight days old. The status above is current; the
          rest comes back when the count is rewritten, usually the next morning.
        </p>
      ) : null}

      {/* Pending only, for the same reason the queue split is. On a decided
          case this rendered three rows of "0 of 15,330 still open (100%
          decided)", and the cohort context that IS useful for one is the
          duration comparison in the section above. */}
      {!isFinal && neighbours.length > 1 && cohort ? (
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-black">
            This filing month against its neighbours
          </h2>{" "}
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
            A month is not slow or fast on its own. Two either side is enough
            to see whether this one is ordinary, and{" "}
            {formatMonth(cohort.month)} is not the only thing DOL is holding.
          </p>
          <CohortNeighbours
            months={neighbours}
            subjectMonth={cohort.month}
            className="mt-5"
          />{" "}
          <p className="mt-4 text-sm text-muted-foreground">
            <Link
              href={`/perm-queue/${cohort.month}`}
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              The full split for {formatMonth(cohort.month)}
            </Link>{" "}
            ·{" "}
            <Link
              href="/perm-queue"
              className="font-bold underline underline-offset-2 hover:text-primary"
            >
              Every filing month
            </Link>
          </p>
        </section>
      ) : null}

      {employer ? <EmployerRecord employer={employer} /> : null}{" "}
      <WontSay isFinal={isFinal} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The answer, first, in one sentence with the figures inside it.      */
/* ------------------------------------------------------------------ */

function Answer({
  status,
  isFinal,
  meaning,
  filingDate,
  elapsed,
  wall,
  decided,
  check,
  publishedFront,
  publishedAsOf,
  casesAhead,
  estimate,
}: {
  status: string | null;
  isFinal: boolean;
  meaning: ReturnType<typeof getStatusMeaning>;
  filingDate: string | null;
  elapsed: number | null;
  wall: Wall | null;
  /**
   * Cases in the normal queue filed before this one, counted to the DAY (the
   * estimate's own input). `wall.ahead` counts whole earlier months only, so
   * it leaves out cases filed earlier in this case's own month; this sentence
   * and the estimate below must give one number.
   */
  casesAhead: number | null;
  decided: CaseLookupResult["decided"];
  check: ReturnType<typeof statusCheckAge>;
  publishedFront: string | null;
  publishedAsOf: string | null;
  /** The estimate the panel below explains, built once by the caller. */
  estimate: Estimate | null;
}) {
  const verdict = meaning ? KIND_LABEL[meaning.kind] : isFinal ? "Decided" : "Pending";

  /*
   * A DENIAL IS NOT GOOD NEWS.
   *
   * All four terminal statuses share `kind: "decided"` - CERTIFIED,
   * CERTIFIED - EXPIRED, DENIED and WITHDRAWN - so the kind alone cannot tell
   * an approval from a refusal. A rule like `isFinal ? "good" : "flat"` would
   * draw a denied case with a green badge, a ▲ mark and the word "Denied" set
   * in the brand lime: the success colour on the worst outcome the process
   * has, for someone opening their own case number.
   *
   * `isApproval` is a lookup against a set of exactly one status rather than a
   * substring test, precisely so that CERTIFIED - EXPIRED does not read as an
   * approval on the strength of containing "CERTIFIED".
   */
  const approved = status !== null && isApproval(status);
  const direction =
    meaning?.kind === "action" || meaning?.kind === "appeal"
      ? "warn"
      : isFinal
        ? approved
          ? "good"
          : "bad"
        : "flat";

  const sourceBits = [
    check ? `DOL showed this status on ${formatAsOf(check.date)}` : null,
    publishedAsOf ? `DOL's queue position as of ${formatAsOf(publishedAsOf)}` : null,
  ].filter(Boolean);

  return (
    <InsightLede
      verdict={verdict}
      direction={direction as "good" | "warn" | "flat"}
      source={sourceBits.length > 0 ? sourceBits.join(" · ") : undefined}
      actions={isFinal ? undefined : <NextSteps estimate={estimate} />}
    >
      {/* The status is stated as a LABEL, never slotted into a clause. "This
          case is in Analyst Review" reads fine and "This case is in In
          Process", "in Certified", "in Withdrawn" do not: eleven of the
          sixteen live statuses are not nouns a preposition can govern. */}
      {status ? (
        <>
          DOL&apos;s status for this case is{" "}
          <b
            className={
              direction === "bad" ? "text-data-bad-on-ink" : "text-primary-on-ink"
            }
          >
            {prettyStatus(status)}
          </b>
          .
        </>
      ) : (
        <>This case is in DOL&apos;s records.</>
      )}{" "}
      {filingDate ? (
        <>
          It was filed {formatAsOf(filingDate)}
          {elapsed !== null && !isFinal ? <>, {formatInt(elapsed)} days ago</> : null}.
        </>
      ) : null}{" "}
      {isFinal && decided?.decisionDate ? (
        <>
          DOL decided it {formatAsOf(decided.decisionDate)}
          {decided.days !== null ? <>, {formatInt(decided.days)} days after filing</> : null}.
        </>
      ) : wall && !wall.isPastFront ? (
        <>
          {publishedFront ? (
            <>
              DOL says it&apos;s working {formatMonth(publishedFront)}
              {publishedFront !== wall.frontMonth ? (
                <> (the oldest month still open is {formatMonth(wall.frontMonth)})</>
              ) : null}
            </>
          ) : (
            <>The oldest month still open is {formatMonth(wall.frontMonth)}</>
          )}
          , and {formatInt(casesAhead ?? wall.ahead)} cases in DOL&apos;s normal queue
          were filed before this one.
        </>
      ) : wall ? (
        <>
          DOL has already moved past this filing month, so filing order is not
          what it is waiting on.
        </>
      ) : null}
    </InsightLede>
  );
}

/**
 * What most people open a pending case for, on the answer card itself: when
 * it could be decided, and a way to hear when it moves. The date is the
 * estimate panel's own (built once by the caller), and both links land
 * further down this page, so nothing here is a second estimate.
 */
function NextSteps({ estimate }: { estimate: Estimate | null }) {
  const link =
    "inline-flex min-h-[44px] items-center text-base font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary";
  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-background/25 pt-5 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      {estimate?.kind === "date" ? (
        <p>
          <span className="block font-mono text-sm uppercase tracking-wider text-background/70">
            Estimated decision
          </span>{" "}
          <span className="block font-heading text-2xl font-black sm:text-3xl">
            Around {formatAsOf(estimate.estimatedDate) ?? estimate.estimatedDate}
          </span>{" "}
          <a href={`#${ESTIMATE_ANCHOR}`} className={link}>
            How this estimate is worked out
          </a>
        </p>
      ) : estimate?.kind === "no-date" ? (
        <p className="max-w-xl text-base leading-relaxed text-background/80">
          No date can honestly be put on this case yet.{" "}
          <a href={`#${ESTIMATE_ANCHOR}`} className={link}>
            Here&apos;s why
          </a>
        </p>
      ) : null}{" "}
      <a
        href={`#${WATCH_ANCHOR}`}
        className="inline-flex min-h-[48px] items-center justify-center gap-2 self-start border-2 border-background bg-primary px-5 font-mono text-sm font-bold uppercase tracking-[0.1em] text-primary-foreground transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:self-auto"
      >
        <BellIcon className="h-4 w-4" weight="fill" aria-hidden="true" />{" "}
        {/* The alert form's own button label, so the action keeps one name. */}
        Email me changes
      </a>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The record: the facts, with nothing derived.                        */
/* ------------------------------------------------------------------ */

function TheRecord({
  result,
  status,
  filingDate,
  elapsed,
  isFinal,
  check,
}: {
  result: CaseLookupResult;
  status: string | null;
  filingDate: string | null;
  elapsed: number | null;
  isFinal: boolean;
  check: ReturnType<typeof statusCheckAge>;
}) {
  const { live, decided } = result;
  const employerName = live?.employerName ?? decided?.employerName ?? null;
  const jobTitle = live?.jobTitle ?? decided?.jobTitle ?? null;

  // The status is why the visitor is here; it must not weigh the same as
  // "Job title". It leads the card at display size, toned by its kind, and
  // the dl below keeps the supporting facts.
  const kind = status ? getStatusMeaning(status)?.kind ?? null : null;
  const statusTone =
    kind === "decided"
      ? "bg-foreground text-background"
      : kind === "action"
        ? "bg-data-warn/15"
        : "bg-tint-primary";

  // `raw` rows are DOL's own words (a name, a title): a browser translating
  // the page leaves them as DOL printed them, so they still match the record.
  const rows: { label: string; value: React.ReactNode; raw?: boolean }[] = [
    {
      label: "Filed",
      value: filingDate
        ? `${formatAsOf(filingDate)}${
            elapsed !== null && !isFinal ? ` (${formatInt(elapsed)} days ago)` : ""
          }`
        : "Not recorded",
    },
    { label: "Employer", value: employerName ?? "Not recorded", raw: !!employerName },
    { label: "Job title", value: jobTitle ?? "Not recorded", raw: !!jobTitle },
    {
      label: "Checked against DOL",
      value: check
        ? `${formatAsOf(check.date)} (${check.ageDays === 0 ? "today" : `${check.ageDays} days ago`})`
        : "Not recorded",
    },
  ];

  return (
    <div className="border-2 border-border bg-card shadow-hard">
      <p className="border-b-2 border-border px-4 py-2 font-mono text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground sm:px-5">
        The record
      </p>
      <div className={`border-b-2 border-border px-4 py-4 sm:px-5 ${statusTone}`}>
        <p className={`font-mono text-sm font-bold uppercase tracking-[0.1em] ${kind === "decided" ? "text-background/80" : "text-muted-foreground"}`}>
          {kind ? KIND_LABEL[kind] : "Status"}
        </p>{" "}
        <p className="mt-1 font-heading text-2xl font-black leading-tight" translate={status ? "no" : undefined}>
          {status ? prettyStatus(status) : "Not recorded"}
        </p>
      </div>
      <dl className="px-4 py-4 sm:px-5">
        {rows.map((r) => (
          <Fragment key={r.label}>{" "}
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-border/50 py-2 last:border-b-0">
            <dt className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground">
              {r.label}
            </dt>{" "}
            <dd className="min-w-0 text-right text-base font-bold" translate={r.raw ? "no" : undefined}>
              {r.value}
            </dd>
          </div>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Where it sits.                                                      */
/* ------------------------------------------------------------------ */

function Stat({
  label,
  value,
  note,
  emphasis,
}: {
  label: string;
  value: string;
  note: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 flex-1 basis-56 border-2 p-4",
        emphasis ? "border-foreground bg-card shadow-hard" : "border-border bg-background",
      )}
    >
      <p className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>{" "}
      <p className="mt-1 font-heading text-4xl font-black leading-none tabular-nums">
        {value}
      </p>{" "}
      <p className="mt-1.5 text-sm leading-snug text-foreground/70">{note}</p>
    </div>
  );
}

function Position({
  wall,
  cohort,
  publishedFront,
  publishedAsOf,
}: {
  wall: Wall;
  cohort: CaseLookupResult["cohort"];
  publishedFront: string | null;
  publishedAsOf: string | null;
}) {
  const maturity = cohort ? cohortMaturity({ ...cohort, decidedPct: cohort.decidedPct }) : "unknown";

  return (
    <section className="mt-12">
      <h2 className="font-heading text-2xl font-black">Where it sits</h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
        Counts from DOL&apos;s live status of every pending case, by filing
        month.
      </p>{" "}

      {/* The one drawing that carries the whole mental model: DOL's tape of
          filing months with its work front, and this case's month marked on
          it. Same component the data hub draws, so the two surfaces teach
          the same picture. */}
      {cohort ? (
        <QueueTape
          frontierMonth={wall.frontMonth}
          selectedMonth={cohort.month}
          className="mt-6"
        />
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Stat
          emphasis
          label="Filed in earlier months"
          value={formatInt(wall.ahead)}
          note="still waiting in DOL's normal queue"
        />
        <Stat
          label="Filed the same month"
          value={formatInt(wall.sameMonth)}
          note="still waiting, this case among them"
        />
        <Stat
          label="Behind the work front"
          value={
            wall.isPastFront
              ? `${Math.abs(wall.monthsBehindFront)} ahead`
              : `${wall.monthsBehindFront} ${wall.monthsBehindFront === 1 ? "month" : "months"}`
          }
          note={
            wall.isPastFront
              ? `oldest month still open: ${formatMonth(wall.frontMonth)}, newer than this case`
              : `oldest month still open: ${formatMonth(wall.frontMonth)}`
          }
        />
      </div>

      {wall.isPastFront ? (
        <div className="mt-6 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
          <PastFrontNote wall={wall} />
        </div>
      ) : (
        <FigurePlate
          n="01"
          title="The wall in front of this case"
          subject="Undecided cases by filing month"
          className="mt-6"
          caption={
            <>
              The wait is not spread evenly. Two months carry most of it, which
              is why the queue can look stalled for a while and then move
              several months at once.
            </>
          }
          source={
            publishedAsOf
              ? `Per-case statuses via a third-party mirror of DOL's FLAG · DOL queue position as of ${formatAsOf(publishedAsOf)}`
              : "Per-case statuses via a third-party mirror of DOL's FLAG"
          }
        >
          <CaseWall wall={wall} publishedFront={publishedFront} />
        </FigurePlate>
      )}

      {cohort ? (
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-foreground/70">
          {formatInt(cohort.total)} cases were filed in {formatMonth(cohort.month)}.{" "}
          <b className="font-bold text-foreground">
            {formatInt(cohort.decided)} of them have been decided
          </b>{" "}
          so far, which is {cohort.decidedPct.toFixed(1)}% of the month.
          {maturity === "untouched" ? (
            <>
              {" "}
              That is early enough that the decided cases are almost entirely
              withdrawals rather than cases that ran their course, so no
              duration is quoted for this month.
            </>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Decided: DOL's own record.                                          */
/* ------------------------------------------------------------------ */

function TheDecision({
  decided,
  duration,
  cohort,
  wage,
}: {
  decided: NonNullable<CaseLookupResult["decided"]>;
  duration: CohortDuration | null;
  cohort: CaseLookupResult["cohort"];
  wage: CaseWageContext | null;
}) {
  const quotable =
    duration !== null &&
    cohort !== null &&
    canQuoteCohortDuration(duration.n, cohort.total);

  return (
    <section className="mt-12">
      <h2 className="font-heading text-2xl font-black">
        What DOL recorded when it decided
      </h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
        Straight from the quarterly disclosure file, which carries fields the
        live status page does not.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Stat
          emphasis
          label="Outcome"
          value={prettyStatus(decided.status)}
          note={decided.decisionDate ? formatAsOf(decided.decisionDate) ?? "" : ""}
        />
        {decided.days !== null ? (
          <Stat
            label="Days taken"
            value={formatInt(decided.days)}
            note="from receipt to determination"
          />
        ) : null}
        {decided.wage !== null ? (
          <Stat
            label="Offered wage"
            value={money(decided.wage)}
            note={decided.socTitle ?? "as filed"}
          />
        ) : null}
        {decided.state ? (
          <Stat label="Worksite state" value={decided.state} note="as filed" />
        ) : null}
      </div>

      {quotable && duration && cohort && decided.days !== null ? (
        <p className="mt-6 max-w-3xl border-2 border-border bg-card p-5 text-base leading-relaxed text-foreground/80 shadow-hard">
          Across {formatInt(duration.n)} decided cases filed in{" "}
          {formatMonth(cohort.month)}, the middle one took{" "}
          <b className="font-bold text-foreground">
            {formatInt(duration.medianDays ?? 0)} days
          </b>
          , and half of them landed between {formatInt(duration.p25Days ?? 0)} and{" "}
          {formatInt(duration.p75Days ?? 0)}. This one took {formatInt(decided.days)}
          {duration.medianDays !== null
            ? decided.days > duration.medianDays
              ? `, which is ${formatInt(decided.days - duration.medianDays)} days longer than the middle of its month.`
              : decided.days < duration.medianDays
                ? `, which is ${formatInt(duration.medianDays - decided.days)} days quicker than the middle of its month.`
                : ", exactly the middle of its month."
            : "."}
        </p>
      ) : null}

      {wage ? <WageLadder wage={wage} /> : null}
    </section>
  );
}

/**
 * Where one offered wage sits against its occupation's ladder.
 *
 * EVERY MARK IS AT ITS OWN COORDINATE. The first version laid the percentile
 * labels out with `justify-between`, which spaces five labels EVENLY across a
 * rail whose values are not evenly spaced: the 25th percentile label sat at
 * 25% of the width while its value sat at 38% of the range. That is the same
 * defect this codebase already carries a post-mortem for, where a diagram's
 * right-hand rail label was drawn 204 units from the date it named. A label
 * and the thing it names share one coordinate or the drawing is fiction.
 *
 * THE FILL CARRIES THE MIDDLE HALF. A flat tinted track behind a marker is
 * decoration, and a filled progress track is a dashboard tell. Filling only
 * p25 to p75 makes the shaded part mean something a reader can use: this is
 * the band half of these jobs pay in.
 */
function WageLadder({ wage }: { wage: CaseWageContext }) {
  const row = wage.inState ?? wage.occupation;
  const scope = wage.inState
    ? `${wage.socTitle ?? wage.socCode} in ${wage.state}`
    : (wage.socTitle ?? wage.socCode);

  const { p5, p25, p50, p75, p95 } = row;
  // The rail needs both ends and a middle. Without them there is no axis to
  // place anything on, and half a ladder would misplace every mark on it.
  if (p5 === null || p95 === null || p50 === null || p95 <= p5) return null;

  const span = p95 - p5;
  const at = (v: number) => ((v - p5) / span) * 100;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));
  const subject = clamp(at(wage.wage));
  const bandFrom = p25 !== null ? clamp(at(p25)) : null;
  const bandTo = p75 !== null ? clamp(at(p75)) : null;

  return (
    <FigurePlate
      n="02"
      title="Where this wage sits"
      subject={scope}
      className="mt-6"
      caption={
        <>
          The shaded band is the middle half
          {p25 !== null && p75 !== null ? (
            <>
              , {money(p25)} to {money(p75)}
            </>
          ) : null}
          . Certified cases only: a denied application&apos;s offered wage was
          never agreed to by anybody, so putting it in the ladder would price
          the job at a figure no employer had to pay.
        </>
      }
      source={`DOL quarterly disclosure files · ${formatInt(row.n)} certified cases`}
    >
      <ChartTips label={`Where this wage sits among certified ${scope} wages`} className="pb-9 pt-9">
        {/* The subject rides above the rail so a wage at either end is never
            clipped by it, and it is translated by its own half-width rather
            than nudged, so the point of the marker is the coordinate.

            DELIBERATELY `bg-primary` AND NOT THE -ink VARIANT, unlike the
            rail tick below. This chip carries text, and no fixed text colour
            clears 4.5:1 on `--data-good-ink` in BOTH themes: it is #1D8229 in
            light and #2ECC40 in dark, so black fails light and white fails
            dark. `--primary` is lime in both, `--primary-foreground` is #000
            in both, and the pair measures 9.83:1 either way. The shape itself
            is delimited by a 2px near-black border, so the fill is not the
            only thing carrying it. */}
        <span
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap border-2 border-foreground bg-primary px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-primary-foreground"
          style={{ left: `${subject}%` }}
        >
          {money(wage.wage)}
        </span>

        <div
          className="relative h-4 border-2 border-border bg-background"
          data-tip={[
            scope,
            `This case: ${money(wage.wage)}`,
            `5th percentile: ${money(p5)}`,
            p25 !== null ? `25th percentile: ${money(p25)}` : null,
            `Median: ${money(p50)}`,
            p75 !== null ? `75th percentile: ${money(p75)}` : null,
            `95th percentile: ${money(p95)}`,
            `${formatInt(row.n)} certified cases`,
          ]
            .filter(Boolean)
            .join("\n")}
        >
          {bandFrom !== null && bandTo !== null && bandTo > bandFrom ? (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 bg-foreground/20"
              style={{ left: `${bandFrom}%`, width: `${bandTo - bandFrom}%` }}
            />
          ) : null}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground"
            style={{ left: `${clamp(at(p50))}%` }}
          />
          {/* The subject's own tick, on the rail rather than only above it.
              -ink for the same reason the wall bars use it: a 2px mark
              carrying meaning at 2.05:1 is not perceivable on paper. */}
          <span
            aria-hidden="true"
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 bg-data-good-ink"
            style={{ left: `${subject}%` }}
          />
        </div>

        {/* Three labels, each at its own coordinate. Five would collide at
            their true positions, and the two that go are the ones the caption
            states in prose instead. */}
        {/* The three labels are absolutely positioned, so they are visually
            separate and textually adjacent: without these spaces an extractor
            reads "$63,695$109,283 median$158,683". The rendered glue detector
            misses this one because it requires a word character on both sides
            and "$" is not one; the source gate is what caught it. */}
        <p className="absolute bottom-0 left-0 font-mono text-sm tabular-nums text-foreground/70">
          {money(p5)}
        </p>{" "}
        <p
          className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap font-mono text-sm font-bold tabular-nums"
          style={{ left: `${clamp(at(p50))}%` }}
        >
          {money(p50)} median
        </p>{" "}
        <p className="absolute bottom-0 right-0 font-mono text-sm tabular-nums text-foreground/70">
          {money(p95)}
        </p>
      </ChartTips>
    </FigurePlate>
  );
}

/* ------------------------------------------------------------------ */
/* What the status means.                                              */
/* ------------------------------------------------------------------ */

function StatusExplainer({
  meaning,
  nowInStatus,
}: {
  meaning: NonNullable<ReturnType<typeof getStatusMeaning>>;
  nowInStatus: number | null;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-heading text-2xl font-black">
        What &ldquo;{meaning.label}&rdquo; means
      </h2>
      <div className="mt-5 border-2 border-border bg-card shadow-hard">
        <div className="flex flex-wrap items-center gap-3 border-b-2 border-border px-6 py-3">
          <Verdict direction={meaning.kind === "action" ? "warn" : "flat"}>
            {KIND_LABEL[meaning.kind]}
          </Verdict>{" "}
          {meaning.cite ? (
            <a
              href={meaning.cite.href}
              rel="noopener noreferrer"
              className="font-mono text-sm font-bold underline underline-offset-2 hover:text-primary"
            >
              {meaning.cite.label}
            </a>
          ) : (
            <span className="font-mono text-sm text-muted-foreground">
              No published definition
            </span>
          )}
        </div>

        <div className="px-6 py-5">
          <p className="max-w-3xl text-base leading-relaxed text-foreground/80">
            {meaning.summary}
          </p>{" "}
          <p className="mt-2 text-sm">
            <Link
              href={`/perm-case-statuses#${statusAnchor(meaning.status)}`}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              Every status, side by side
            </Link>
          </p>{" "}

          {meaning.deadline ? (
            <p className="mt-4 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base leading-relaxed">
              <b className="font-bold text-data-warn-ink">The clock:</b>{" "}
              {meaning.deadline}
            </p>
          ) : null}

          {meaning.action ? (
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-foreground/80">
              <b className="font-bold text-foreground">Who acts:</b>{" "}
              {meaning.action}
            </p>
          ) : null}

          {nowInStatus !== null ? (
            <p className="mt-4 border-t-2 border-border pt-4 text-base leading-relaxed text-foreground/70">
              <b className="font-bold text-foreground">
                {formatInt(nowInStatus)} cases
              </b>{" "}
              are in this status right now, across every filing month: how common it is, not how likely this
              case is to leave it. Status changes have only been recorded since August 2026, too short a record
              to price those odds.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function UndecodedStatus({ status }: { status: string }) {
  return (
    <section className="mt-12">
      <h2 className="font-heading text-2xl font-black">
        What &ldquo;{prettyStatus(status)}&rdquo; means
      </h2>{" "}
      <p className="mt-4 max-w-3xl border-2 border-border bg-card p-6 text-base leading-relaxed text-foreground/80 shadow-hard">
        Not written up here yet, and DOL publishes no glossary, so this page won&apos;t guess. The notice DOL
        sent the employer explains it; their attorney has it.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Which queue the rest of the month is in.                            */
/* ------------------------------------------------------------------ */

function CohortQueues({
  counts,
  month,
}: {
  counts: readonly StatusCount[];
  month: string;
}) {
  const split = groupByStage(counts);
  if (split.pending === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="font-heading text-2xl font-black">
        Which queue the rest of {formatMonth(month)} is in
      </h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
        Analyst review moves in filing order. A hold, an RFI, an audit or an
        appeal takes a case out of that order.
      </p>

      <div className="mt-5 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <p className="text-base leading-relaxed text-foreground/80">
          <b className="font-bold text-foreground">{formatInt(split.ordinary)}</b> of
          the {formatInt(split.pending)} still open are in analyst review.
        </p>
        {/* The same drawing language the month pages use, on the same data,
            so a reader arriving here from /perm-queue/<month> is not asked to
            learn a second chart of one thing. */}
        <ChartTips label={`Pending cases filed in ${formatMonth(month) ?? month}, by stage`} className="mt-6">
          <StageBar stages={split.stages} scale="composition" tipHeading={`Filed in ${formatMonth(month) ?? month}`} />
        </ChartTips>
        <StageLegend stages={split.stages} className="mt-4" />
        <FinePrint summary="Every DOL status in this month" className="mt-6">
          <PendingCensus
            stages={split.stages}
            caption={`Every DOL status a pending case filed in ${formatMonth(month)} is currently in, grouped by queue`}
          />
        </FinePrint>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The employer's own record.                                          */
/* ------------------------------------------------------------------ */

/**
 * The employer's record, as a run of figures rather than a second stat grid.
 *
 * WHY NOT THE SAME CELLS AS "WHERE IT SITS". Two identical modules on one
 * page is the lazy answer, and these two blocks are not carrying the same
 * shape of information. The position figures are the page's own subject and
 * earn full-size cells. This is a short secondary record whose real job is to
 * hand the reader off to the entity page, so it reads as one dense line with
 * the numbers in it. Density 7 wants figures separated by hairlines, not
 * boxed one per card.
 */
function EmployerRecord({
  employer,
}: {
  employer: NonNullable<CaseLookupResult["employer"]>;
}) {
  const thin = employer.total < MIN_RATE_SAMPLE;
  const figures: { value: string; label: string }[] = [
    { value: formatInt(employer.total), label: "decided cases" },
    { value: formatInt(employer.certified), label: "certified" },
    ...(employer.denied > 0
      ? [{ value: formatInt(employer.denied), label: "denied" }]
      : []),
    ...(employer.medianDays !== null
      ? [
          {
            value: formatInt(Math.round(employer.medianDays)),
            label: "median days",
          },
        ]
      : []),
    ...(thin
      ? []
      : [{ value: `${employer.approvalRate.toFixed(1)}%`, label: "certified" }]),
  ];

  return (
    <section className="mt-12">
      <h2 className="font-heading text-2xl font-black">
        This employer&apos;s own record
      </h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
        Every decided PERM case DOL published for {employer.name}, across
        FY2024 to FY2026. It describes the employer&apos;s filings, not this
        case.
      </p>

      <div className="mt-5 border-2 border-border bg-card p-5 shadow-hard sm:p-6">
        <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-4">
          {figures.map((f) => (
            <Fragment key={f.label + f.value}>{" "}
            {/* One visible <dt>, not an sr-only label plus an aria-hidden
                twin. The twin version rendered every label TWICE into
                textContent, which is what Google reads. */}
            <div className="flex min-w-0 flex-row-reverse items-baseline justify-end gap-2">
              <dt className="font-mono text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {f.label}
              </dt>{" "}
              <dd className="font-heading text-3xl font-black leading-none tabular-nums">
                {f.value}
              </dd>
            </div>
            </Fragment>
          ))}
        </dl>

        <p className="mt-5 border-t-2 border-border pt-4 text-base leading-relaxed text-foreground/80">
          {thin ? (
            employer.total === employer.certified ? (
              <>
                A clean record over {formatInt(employer.total)} cases is worth knowing
                and it is not a rate. At this volume one denial would move the
                figure by tens of percentage points, so the counts are here and
                the percentage is not.
              </>
            ) : (
              <>
                At {formatInt(employer.total)} decided cases this is too small a
                sample to carry a percentage, so the counts are here and the
                rate is not.
              </>
            )
          ) : (
            <>
              {employer.approvalRate.toFixed(1)}% of {formatInt(employer.total)}{" "}
              decided cases were certified. That describes what DOL did with
              this sponsor&apos;s past filings and carries no claim about this
              one.
            </>
          )}{" "}
          <Link
            href={`/perm-employers/${employer.slug}`}
            className="font-bold underline underline-offset-2 hover:text-primary"
          >
            Everything published about {employer.name}
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The refusals, said out loud.                                        */
/* ------------------------------------------------------------------ */

export function WontSay({ isFinal }: { isFinal: boolean }) {
  return (
    <section className="mt-12 border-2 border-border bg-foreground p-6 text-background shadow-hard sm:p-8">
      <h2 className="font-heading text-2xl font-black">
        What this page will not tell you
      </h2>{" "}
      <ul className="mt-4 max-w-3xl space-y-4 text-base leading-relaxed text-background/85">
        {!isFinal ? (
          <>
            <li>
              <b className="font-bold text-primary-on-ink">
                A guaranteed decision date.
              </b>{" "}
              The estimate is a statistic, not a schedule: audits and appeals
              take cases out of order. Every model side by side is on the{" "}
              <Link
                href="/tools/perm-timeline-calculator"
                className="font-bold text-primary-on-ink underline underline-offset-2"
              >
                processing time calculator
              </Link>
              .
            </li>{" "}
            <li>
              <b className="font-bold text-primary-on-ink">
                How likely this case is to be certified.
              </b>{" "}
              One odds figure would claim more than the data can support. The
              measured rates, factor by factor, are on the{" "}
              <Link
                href="/perm-denial-risk"
                className="font-bold text-primary-on-ink underline underline-offset-2"
              >
                denial-rate page
              </Link>
              .
            </li>
          </>
        ) : (
          <li>
            <b className="font-bold text-primary-on-ink">
              What happens next for this case.
            </b>{" "}
            PERM is the first of three stages, and DOL publishes nothing about
            the next two against a case number. The{" "}
            <Link
              href="/tools/green-card-timeline"
              className="font-bold text-primary-on-ink underline underline-offset-2"
            >
              green card timeline
            </Link>{" "}
            covers the stages after this one.
          </li>
        )}{" "}
        <li>
          <b className="font-bold text-primary-on-ink">
            Anything about the worker.
          </b>{" "}
          DOL&apos;s files name employers, job titles and case numbers, never
          the person, and neither does this site.
        </li>
      </ul>
    </section>
  );
}
