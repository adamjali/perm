import Link from "next/link";
import { FinePrint } from "@/components/data/FinePrint";
import { Fragment } from "react";
import { WarningIcon } from "@phosphor-icons/react/ssr";

import { ChartTips } from "@/components/data/ChartTips";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { AnswerPanel } from "@/components/tools/Insight";
import { PageSection } from "@/components/data/PageSection";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { Fold, FoldList } from "@/components/data/Fold";
import { buttonVariants } from "@/components/ui/button";
import { CaseMilestones } from "@/components/tools/CaseMilestones";
import { AnswerNext } from "@/components/tools/AnswerNext";
import { RecordList, type RecordRow } from "@/components/data/RecordList";
import {
  CaseEstimate,
  CaseEstimatePanel,
  ESTIMATE_ANCHOR,
} from "@/components/tools/CaseEstimate";
import { CaseNumberPlate } from "@/components/tools/CaseNumberPlate";
import { LineAhead } from "@/components/tools/LineAhead";
import type { LineAheadRow } from "@/lib/queueAhead";
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
import { EstimateShown } from "@/components/analytics/EstimateShown";
import type { SameDay } from "@/lib/sameDay";
import type { CaseLookupResult } from "@/lib/db/caseLookup";
import type { CaseWageContext, CohortDuration } from "@/lib/db/caseContext";
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
  /** The same line split by filing month (lineAheadByMonth); drawn for a case in analyst review. */
  lineAhead?: LineAheadRow[] | null;
  /** DOL's measured decision rate, or null when unmeasurable. */
  decisionPace?: Parameters<typeof CaseEstimate>[0]["decisionPace"];
  sweepAgeDays?: number | null;
  stragglers?: Parameters<typeof CaseEstimate>[0]["stragglers"];
  /** The nightly backtest's measurement of the printed range, quoted under it. */
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
  lineAhead = null,
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

  // An action stage (an RFI, a notice of intent to deny, an audit) carries a
  // clock and someone who has to act, so its meaning is shown in the open; any
  // other status is explained in a fold.
  const actionStage = meaning?.kind === "action";

  return (
    <div>
      <Answer
        caseNumber={result.caseNumber}
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
        <Notice title={`DOL showed this status ${check.ageDays} days ago`}>
          , on {formatAsOf(check.date)}, and it hasn&apos;t been checked since. A recent change shows first on{" "}
          {/* DOL's case-status search, not its processing-times page, which can't show one case. */}
          <a href={DOL_CASE_STATUS_URL} rel="noopener noreferrer" className="link">
            flag.dol.gov
          </a>
          , DOL&apos;s own status page.
        </Notice>
      ) : null}

      {reopened && decided && live ? (
        <Notice title="DOL's file records a decision on this case, and it's back in processing.">
          {" "}DOL&apos;s quarterly file shows it {decided.status.toLowerCase()}
          {decided.decisionDate ? <> on {formatAsOf(decided.decisionDate)}</> : null}; DOL&apos;s live status is now{" "}
          {prettyStatus(live.status).toLowerCase()}, which is current. That&apos;s normal: a denial can be appealed
          within 30 days under{" "}
          <a href="https://www.ecfr.gov/current/title-20/section-656.24" rel="noopener noreferrer" className="link">
            20 CFR 656.24(g)
          </a>
          .
        </Notice>
      ) : null}

      {sourcesDisagree && decided && live ? (
        <Notice title="The two federal sources disagree about this case.">
          {" "}DOL&apos;s quarterly disclosure file records it as {decided.status.toLowerCase()}; the live status page
          shows {prettyStatus(live.status).toLowerCase()}. About one case in five thousand does this, usually after
          moving once the file closed. Both are shown below.
        </Notice>
      ) : null}

      {!isFinal && result.censusMissing ? (
        <Notice title="Some sections are missing today." tone="info">
          {" "}The daily count of every pending case, which places this one in its filing month, couldn&apos;t be
          read or is more than eight days old. The status above is current; the rest comes back when the count is
          rewritten, usually the next morning.
        </Notice>
      ) : null}

      {/* The line, then the estimate built on it: the question that brought
          most readers here. Each renders nothing when it can't be answered. */}
      {!isFinal && status?.trim().toUpperCase() === "ANALYST REVIEW" && lineAhead && lineAhead.length > 0 ? (
        <LineAhead rows={lineAhead} perDay={decisionPace?.pace ?? null} />
      ) : null}{" "}
      {estimate ? <CaseEstimatePanel est={estimate} dateShownAbove={!isFinal} /> : null}{" "}
      {estimate ? (
        <EstimateShown
          model={estimate.kind === "date" ? estimate.modelId : "none"}
          dated={estimate.kind === "date"}
          source="case-page"
        />
      ) : null}

      {decided ? <TheDecision decided={decided} duration={duration} cohort={cohort} wage={wage} /> : null}

      {meaning && actionStage ? (
        <PageSection title={<>What &ldquo;{meaning.label}&rdquo; means</>}>
          <StatusExplainer meaning={meaning} nowInStatus={statusOutlook?.nowInStatus ?? null} />
        </PageSection>
      ) : null}

      <TheRecord
        result={result}
        parsed={parsed}
        status={status}
        filingDate={filingDate}
        elapsed={elapsed}
        isFinal={isFinal}
        check={check}
      />

      {/* After DOL: the I-140 and I-485 have no federal per-case record, so
          this is the only trace of them, as labelled user reports. Rendered for
          decided cases too: a certified PERM is the case whose next stage
          people want to compare notes on. */}
      <CaseMilestones caseNumber={result.caseNumber} className="mt-12 sm:mt-16" />{" "}
      {sameDay ? <SameDayCases data={sameDay} className="mt-12 sm:mt-16" /> : null}

      <FoldList>
        {!isFinal && wall ? (
          <Fold title="Where it sits in the queue" hint="Undecided cases by filing month, and DOL's work front">
            <Position wall={wall} cohort={cohort} publishedFront={publishedFront} publishedAsOf={publishedAsOf} />
          </Fold>
        ) : null}
        {meaning && !actionStage ? (
          <Fold title={<>What &ldquo;{meaning.label}&rdquo; means</>} hint={KIND_LABEL[meaning.kind]}>
            <StatusExplainer meaning={meaning} nowInStatus={statusOutlook?.nowInStatus ?? null} />
          </Fold>
        ) : !meaning && status ? (
          <Fold title={<>What &ldquo;{prettyStatus(status)}&rdquo; means</>}>
            <UndecodedStatus />
          </Fold>
        ) : null}
        {!isFinal && cohort && groupByStage(cohortStatuses).pending > 0 ? (
          <Fold title={`Where the rest of ${formatMonth(cohort.month)} is`} hint="Analyst review, holds, RFIs and appeals">
            <CohortQueues counts={cohortStatuses} month={cohort.month} />
          </Fold>
        ) : null}
        {/* Pending only: on a decided case this read "0 of 15,330 still open". */}
        {!isFinal && neighbours.length > 1 && cohort ? (
          <Fold title="This filing month against its neighbours" hint="Two months either side">
            <Neighbours months={neighbours} month={cohort.month} />
          </Fold>
        ) : null}
        {employer ? (
          <Fold title="This employer's record" hint={`Every decided PERM case DOL published for ${employer.name}`}>
            <EmployerRecord employer={employer} />
          </Fold>
        ) : null}
        <Fold title="What this page won't tell you">
          <WontSay isFinal={isFinal} />
        </Fold>
      </FoldList>
    </div>
  );
}

/**
 * A note about the record itself, above anything it qualifies: a figure the
 * reader has already absorbed can't be un-absorbed by a note under it.
 */
function Notice({
  title,
  tone = "warn",
  children,
}: {
  title: string;
  tone?: "warn" | "info";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "mt-6 flex items-start gap-2 border-l-2 px-4 py-3 text-base leading-relaxed text-soft",
        tone === "warn" ? "border-data-warn-ink bg-data-warn/8" : "border-border bg-muted",
      )}
    >
      <WarningIcon
        className={cn("mt-1 size-4 shrink-0", tone === "warn" ? "text-data-warn-ink" : "text-muted-foreground")}
        weight="fill"
        aria-hidden="true"
      />{" "}
      <span>
        <b className="font-semibold text-foreground">{title}</b>
        {children}
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* The answer, first: the status, the queue and the next step.         */
/* ------------------------------------------------------------------ */

function Answer({
  caseNumber,
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
  caseNumber: string;
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
   * an approval from a refusal. `isApproval` is a lookup against a set of
   * exactly one status rather than a substring test, so that CERTIFIED -
   * EXPIRED does not read as an approval on the strength of containing
   * "CERTIFIED".
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

  // THE PICTURE: DOL's tape of filing months, its work front flagged and this
  // case's month marked, for a pending case DOL hasn't reached yet. The same
  // tape the homepage draws, so the two teach one picture.
  const front = publishedFront ?? wall?.frontMonth ?? null;
  const filedMonth = filingDate?.slice(0, 7) ?? null;
  const gap = front && filedMonth ? monthsBetween(front, filedMonth) : null;
  const tape =
    !isFinal && wall && !wall.isPastFront && front && filedMonth && gap !== null && gap > 0 && gap <= 16 ? (
      <QueueTape
        frontierMonth={front}
        selectedMonth={filedMonth}
        monthsBehind={1}
        monthsAhead={gap + 1}
        aheadLabel={casesAhead !== null ? `${formatInt(casesAhead)} cases ahead` : undefined}
      />
    ) : null;

  const sourceBits = [
    check ? `DOL showed this status on ${formatAsOf(check.date)}` : null,
    publishedAsOf ? `DOL's queue position as of ${formatAsOf(publishedAsOf)}` : null,
  ].filter(Boolean);

  return (
    <AnswerPanel
      verdict={verdict}
      direction={direction}
      label={<span translate="no">{caseNumber}</span>}
      source={sourceBits.length > 0 ? sourceBits.join(" · ") : undefined}
      picture={tape}
      actions={
        isFinal ? (
          <DecidedNext status={status} approved={approved} />
        ) : (
          <AnswerNext
            caseNumber={caseNumber}
            program="perm"
            date={
              estimate?.kind === "date"
                ? `Around ${formatAsOf(estimate.estimatedDate) ?? estimate.estimatedDate}`
                : null
            }
            note={
              estimate?.kind === "date" ? (
                <a href={`#${ESTIMATE_ANCHOR}`} className="link inline-flex min-h-11 items-center">
                  How this is worked out
                </a>
              ) : estimate?.kind === "no-date" ? (
                <>
                  No date can honestly be put on this case yet.{" "}
                  <a href={`#${ESTIMATE_ANCHOR}`} className="link">
                    Here&apos;s why
                  </a>
                </>
              ) : null
            }
          />
        )
      }
    >
      {/* The status is stated as a LABEL, never slotted into a clause. "This
          case is in Analyst Review" reads fine and "This case is in In
          Process", "in Certified", "in Withdrawn" do not: eleven of the
          sixteen live statuses are not nouns a preposition can govern. */}
      {status ? (
        <>
          DOL&apos;s status for this case is{" "}
          <b className="font-semibold" translate="no">
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
          , and <b className="font-semibold">{formatInt(casesAhead ?? wall.ahead)}</b> cases in DOL&apos;s normal
          queue were filed before this one.
        </>
      ) : wall ? (
        <>DOL has already moved past this filing month, so filing order isn&apos;t what it&apos;s waiting on.</>
      ) : null}
    </AnswerPanel>
  );
}

/** Whole months from `from` to `to` ("YYYY-MM"); negative when `to` is earlier. */
function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return ((ty ?? 0) - (fy ?? 0)) * 12 + ((tm ?? 1) - (fm ?? 1));
}

/** A decided case's next step: what comes after PERM, or what a denial means. */
function DecidedNext({ status, approved }: { status: string | null; approved: boolean }) {
  const denied = status?.trim().toUpperCase().startsWith("DENIED") ?? false;
  const next = approved
    ? { href: "/tools/green-card-timeline", label: "What comes after a certified PERM", note: "The I-140 and the green card, step by step." }
    : denied
      ? { href: "/guides/perm-denied-what-happens-next", label: "What happens after a denial", note: "Reconsideration, appeal and refiling, and their deadlines." }
      : null;
  if (!next) return null;
  return (
    <div className="mt-6 border-t border-foreground/10 pt-6">
      <Link href={next.href} className={buttonVariants({ variant: "outline", size: "lg" })}>
        {next.label}
      </Link>{" "}
      <p className="mt-2 text-sm text-muted-foreground">{next.note}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The record: the facts, with nothing derived.                        */
/* ------------------------------------------------------------------ */

function TheRecord({
  result,
  parsed,
  status,
  filingDate,
  elapsed,
  isFinal,
  check,
}: {
  result: CaseLookupResult;
  parsed: ReturnType<typeof parseCaseNumber>;
  status: string | null;
  filingDate: string | null;
  elapsed: number | null;
  isFinal: boolean;
  check: ReturnType<typeof statusCheckAge>;
}) {
  const { live, decided } = result;
  const employerName = live?.employerName ?? decided?.employerName ?? null;
  const jobTitle = live?.jobTitle ?? decided?.jobTitle ?? null;

  const rows: RecordRow[] = [
    { label: "Status", value: status ? prettyStatus(status) : "Not recorded", raw: !!status },
    { label: "Case number", value: result.caseNumber, raw: true, mono: true },
    {
      label: "Filed",
      value: filingDate
        ? `${formatAsOf(filingDate)}${elapsed !== null && !isFinal ? ` (${formatInt(elapsed)} days ago)` : ""}`
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
    <PageSection title="The record" lede="As DOL holds it, with nothing worked out.">
      <RecordList rows={rows} />{" "}
      {parsed ? (
        <FinePrint summary="What the case number says" className="mt-3">
          <CaseNumberPlate parsed={parsed} recordedFilingDate={filingDate} />
        </FinePrint>
      ) : null}
    </PageSection>
  );
}

/* ------------------------------------------------------------------ */
/* Where it sits.                                                      */
/* ------------------------------------------------------------------ */

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
    <div>
      <p className="max-w-2xl text-base leading-relaxed text-soft">
        Counts from DOL&apos;s live status of every pending case, by filing month.
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

      <FigureRow className="mt-6">
        <Figure
          label="Filed in earlier months"
          value={formatInt(wall.ahead)}
          note="still waiting in DOL's normal queue"
        />
        <Figure
          label="Filed the same month"
          value={formatInt(wall.sameMonth)}
          note="still waiting, this case among them"
        />
        <Figure
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
      </FigureRow>

      {wall.isPastFront ? (
        <div className="mt-6">
          <PastFrontNote wall={wall} />
        </div>
      ) : (
        <FigurePlate
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
              ? `Per-case statuses from DOL's own case status system, checked daily · DOL queue position as of ${formatAsOf(publishedAsOf)}`
              : "Per-case statuses from DOL's own case status system, checked daily"
          }
        >
          <CaseWall wall={wall} publishedFront={publishedFront} />
        </FigurePlate>
      )}

      {cohort ? (
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground">
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
    </div>
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
    <PageSection
      title="What DOL recorded when it decided"
      lede="From the quarterly disclosure file, which carries fields the live status page doesn't."
    >
      <FigureRow>
        <Figure
          label="Outcome"
          value={prettyStatus(decided.status)}
          note={decided.decisionDate ? formatAsOf(decided.decisionDate) ?? "" : ""}
        />
        {decided.days !== null ? (
          <Figure
            label="Days taken"
            value={formatInt(decided.days)}
            note="from receipt to determination"
          />
        ) : null}
        {decided.wage !== null ? (
          <Figure
            label="Offered wage"
            value={money(decided.wage)}
            note={decided.socTitle ?? "as filed"}
          />
        ) : null}
        {decided.state ? (
          <Figure label="Worksite state" value={decided.state} note="as filed" />
        ) : null}
      </FigureRow>

      {quotable && duration && cohort && decided.days !== null ? (
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-soft">
          Across {formatInt(duration.n)} decided cases filed in{" "}
          {formatMonth(cohort.month)}, the middle one took{" "}
          <b className="font-semibold text-foreground">
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
    </PageSection>
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
          className="absolute top-0 -translate-x-1/2 whitespace-nowrap border border-foreground bg-primary px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-primary-foreground"
          style={{ left: `${subject}%` }}
        >
          {money(wage.wage)}
        </span>

        <div
          className="relative h-4 border border-input bg-background"
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
        <p className="absolute bottom-0 left-0 font-mono text-sm tabular-nums text-muted-foreground">
          {money(p5)}
        </p>{" "}
        <p
          className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap font-mono text-sm font-bold tabular-nums"
          style={{ left: `${clamp(at(p50))}%` }}
        >
          {money(p50)} median
        </p>{" "}
        <p className="absolute bottom-0 right-0 font-mono text-sm tabular-nums text-muted-foreground">
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
    <div className="max-w-3xl">
      <p className="text-base leading-relaxed text-soft">{meaning.summary}</p>{" "}
      {meaning.deadline ? (
        <p className="mt-4 border-l-2 border-data-warn-ink bg-data-warn/8 px-4 py-3 text-base leading-relaxed text-soft">
          <b className="font-semibold text-foreground">The clock:</b> {meaning.deadline}
        </p>
      ) : null}{" "}
      {meaning.action ? (
        <p className="mt-4 text-base leading-relaxed text-soft">
          <b className="font-semibold text-foreground">Who acts:</b> {meaning.action}
        </p>
      ) : null}{" "}
      {nowInStatus !== null ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          <b className="font-semibold text-foreground">{formatInt(nowInStatus)} cases</b> are in this status right
          now, across every filing month: how common it is, not how likely this case is to leave it. Status changes
          have only been recorded since August 2026, too short a record to price those odds.
        </p>
      ) : null}{" "}
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {meaning.cite ? (
          <a href={meaning.cite.href} rel="noopener noreferrer" className={cn("font-mono", "link")}>
            {meaning.cite.label}
          </a>
        ) : (
          <span className="text-muted-foreground">No published definition</span>
        )}{" "}
        <Link href={`/perm-case-statuses#${statusAnchor(meaning.status)}`} className="link">
          Every status, side by side
        </Link>
      </p>
    </div>
  );
}

function UndecodedStatus() {
  return (
    <p className="max-w-3xl text-base leading-relaxed text-soft">
      Not written up here yet, and DOL publishes no glossary, so this page won&apos;t guess. The notice DOL sent the
      employer explains it; their attorney has it.
    </p>
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
  const label = formatMonth(month) ?? month;

  return (
    <div>
      <p className="max-w-2xl text-base leading-relaxed text-soft">
        <b className="font-semibold text-foreground">{formatInt(split.ordinary)}</b> of the{" "}
        {formatInt(split.pending)} still open are in analyst review, which moves in filing order. A hold, an RFI, an
        audit or an appeal takes a case out of that order.
      </p>
      {/* The same drawing the month pages use, on the same data, so a reader
          arriving from /perm-queue/<month> isn't asked to learn a second chart. */}
      <ChartTips label={`Pending cases filed in ${label}, by stage`} className="mt-6">
        <StageBar stages={split.stages} scale="composition" tipHeading={`Filed in ${label}`} />
      </ChartTips>
      <StageLegend stages={split.stages} className="mt-4" />
      <FinePrint summary={`Every DOL status in ${label}`} className="mt-6">
        <PendingCensus
          stages={split.stages}
          caption={`Every DOL status a pending case filed in ${label} is currently in, grouped by queue`}
        />
      </FinePrint>
      <p className="mt-4 text-sm">
        <Link href={`/perm-queue/${month}`} className="link">
          The full split for {label}
        </Link>
      </p>
    </div>
  );
}

/** The filing month beside two months either side of it. */
function Neighbours({ months, month }: { months: readonly CohortMonth[]; month: string }) {
  return (
    <div>
      <p className="max-w-2xl text-base leading-relaxed text-soft">
        A month isn&apos;t slow or fast on its own. Two either side is enough to see whether{" "}
        {formatMonth(month)} is ordinary.
      </p>{" "}
      <CohortNeighbours months={months} subjectMonth={month} className="mt-5" />{" "}
      <p className="mt-4 text-sm">
        <Link href="/perm-queue" className="link">
          Every filing month
        </Link>
      </p>
    </div>
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
    <div>
      <p className="max-w-2xl text-base leading-relaxed text-soft">
        Across FY2024 to FY2026. It describes the employer&apos;s filings, not this case.
      </p>{" "}
      <div className="mt-5">
        <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-4">
          {figures.map((f) => (
            <Fragment key={f.label + f.value}>{" "}
            {/* One visible <dt>, not an sr-only label plus an aria-hidden
                twin. The twin version rendered every label TWICE into
                textContent, which is what Google reads. */}
            <div className="flex min-w-0 flex-row-reverse items-baseline justify-end gap-2">
              <dt className="text-sm text-muted-foreground">
                {f.label}
              </dt>{" "}
              <dd className="font-heading text-3xl font-bold leading-none tabular-nums">
                {f.value}
              </dd>
            </div>
            </Fragment>
          ))}
        </dl>

        <p className="mt-5 max-w-3xl text-base leading-relaxed text-soft">
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
            className="link"
          >
            Everything published about {employer.name}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The refusals, said out loud.                                        */
/* ------------------------------------------------------------------ */

export function WontSay({ isFinal }: { isFinal: boolean }) {
  return (
    <ul className="max-w-3xl space-y-4 text-base leading-relaxed text-soft">
      {!isFinal ? (
        <>
          <li>
            <b className="font-semibold text-foreground">A guaranteed decision date.</b> The estimate is a
            statistic, not a schedule: audits and appeals take cases out of order. Every model side by side is on
            the{" "}
            <Link href="/tools/perm-timeline-calculator" className="link">
              processing time calculator
            </Link>
            .
          </li>{" "}
          <li>
            <b className="font-semibold text-foreground">How likely this case is to be certified.</b> One odds
            figure would claim more than the data can support. The measured rates, factor by factor, are on the{" "}
            <Link href="/perm-denial-risk" className="link">
              denial-rate page
            </Link>
            .
          </li>
        </>
      ) : (
        <li>
          <b className="font-semibold text-foreground">What happens next for this case.</b> PERM is the first of
          three stages, and DOL publishes nothing about the next two against a case number. The{" "}
          <Link href="/tools/green-card-timeline" className="link">
            green card timeline
          </Link>{" "}
          covers the stages after this one.
        </li>
      )}{" "}
      <li>
        <b className="font-semibold text-foreground">Anything about the worker.</b> DOL&apos;s files name
        employers, job titles and case numbers, never the person, and neither does this site.
      </li>
    </ul>
  );
}
