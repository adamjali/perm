import Link from "next/link";
import { DecidedTimeline } from "@/components/tools/DecidedTimeline";
import { StatusHistory } from "@/components/tools/StatusHistory";
import type { StatusEvent } from "@/lib/statusHistory";
import type { DecidedTimelineRead } from "@/lib/db/decidedTimeline";
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
import { PendingCensus } from "@/components/queue/PendingCensus";
import { StageBar, StageLegend } from "@/components/queue/StageBar";
import { groupByStage, prettyStatus } from "@/components/queue/stages";
import type { StatusCount } from "@/lib/liveQueue";
import { getStatusMeaning, kindLabel } from "@/lib/permStatus";
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
import { entityHref } from "@/lib/entityPayload";
import { Bold } from "@/components/i18n/Bold";
import type { Lang } from "@/lib/i18n/lang";
import { dayLabel, intLabel, moneyLabel, monthLabel, percentLabel } from "@/lib/i18n/format";
import {
  CASE_STATUS_RESULT,
  type CaseStatusResultText,
  type Linked,
  type MedianCompare,
} from "@/components/tools/CaseStatusResult.messages";
import { planHref } from "@/components/tools/planner/planUrl";
import { statusCasesHref } from "@/components/queue/statusLinks";

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

/**
 * The formatters every part of the result shares, in the reader's language. English prints exactly what
 * the site's English helpers print ("October 21, 2026", "November 2025", "93,219", "$120,500").
 */
interface Words {
  lang: Lang;
  t: CaseStatusResultText;
  day: (iso: string) => string | null;
  month: (ym: string) => string | null;
  int: (n: number) => string;
  money: (n: number) => string;
}

function wordsFor(lang: Lang): Words {
  return {
    lang,
    t: CASE_STATUS_RESULT[lang],
    day: (iso) => dayLabel(iso, lang),
    month: (ym) => monthLabel(ym, lang),
    int: (n) => intLabel(n, lang),
    money: (n) => moneyLabel(n, lang),
  };
}

/** Below this many decided cases, a percentage is arithmetic on an anecdote. */
const MIN_RATE_SAMPLE = 20;


export interface CaseStatusResultProps {
  /** A decided case's own dates, wage request to decision (perm_cases joined to pwd_cases). */
  timeline?: DecidedTimelineRead | null;
  /** Every status change our checks saw for this case (perm_case_events). */
  history?: StatusEvent[] | null;
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
  /** The page's language; English by default. */
  lang?: Lang;
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
  timeline = null,
  history = null,
  today,
  lang = "en",
}: CaseStatusResultProps) {
  const { live, decided, cohort, employer, statusOutlook } = result;
  const w = wordsFor(lang);
  const { t } = w;

  // The live mirror knows about pending cases; DOL's disclosure files know
  // about decided ones and carry fields the mirror does not. Either can be
  // the only source present, so the status shown is whichever exists, with
  // the live one winning because it is the more current of the two.
  const status = live?.status ?? (decided ? decided.status.toUpperCase() : null);
  const meaning = status ? getStatusMeaning(status, lang) : null;
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
    lang,
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

  // An action stage (an RFI, a NORD, an audit) carries a
  // clock and someone who has to act, so its meaning is shown in the open; any
  // other status is explained in a fold.
  const actionStage = meaning?.kind === "action";

  // DOL's words as printed: lower-cased inside the English sentence (as it always was), DOL's own capitals in
  // a translation, where they stand as the term the reader looks for on DOL's page.
  const dolWord = (s: string, pretty: boolean) =>
    lang === "en" ? (pretty ? prettyStatus(s) : s).toLowerCase() : s.toUpperCase();
  const staleParts = check ? t.staleBody(w.day(check.date) ?? check.date) : null;
  const reopenedParts =
    reopened && decided && live
      ? t.reopenedBody(
          dolWord(decided.status, false),
          decided.decisionDate ? w.day(decided.decisionDate) : null,
          dolWord(live.status, true),
        )
      : null;

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
        w={w}
      />

      {check?.stale && !isFinal ? (
        <Notice title={t.staleTitle(check.ageDays)}>
          {staleParts?.[0]}
          {/* DOL's case-status search, not its processing-times page, which can't show one case. */}
          <a href={DOL_CASE_STATUS_URL} rel="noopener noreferrer" className="link">
            flag.dol.gov
          </a>
          {staleParts?.[1]}
        </Notice>
      ) : null}

      {reopened && decided && live ? (
        <Notice title={t.reopenedTitle}>
          {reopenedParts?.[0]}
          <a href="https://www.ecfr.gov/current/title-20/section-656.24" rel="noopener noreferrer" className="link">
            20 CFR 656.24(g)
          </a>
          {reopenedParts?.[1]}
        </Notice>
      ) : null}

      {sourcesDisagree && decided && live ? (
        <Notice title={t.disagreeTitle}>
          {t.disagreeBody(dolWord(decided.status, false), dolWord(live.status, true))}
        </Notice>
      ) : null}

      {!isFinal && result.censusMissing ? (
        <Notice title={t.censusTitle} tone="info">
          {t.censusBody}
        </Notice>
      ) : null}

      {/* The line, then the estimate built on it: the question that brought
          most readers here. Each renders nothing when it can't be answered. */}
      {!isFinal && status?.trim().toUpperCase() === "ANALYST REVIEW" && lineAhead && lineAhead.length > 0 ? (
        <LineAhead rows={lineAhead} perDay={decisionPace?.pace ?? null} lang={lang} />
      ) : null}{" "}
      {estimate ? <CaseEstimatePanel est={estimate} dateShownAbove={!isFinal} lang={lang} /> : null}{" "}
      {estimate ? (
        <EstimateShown
          model={estimate.kind === "date" ? estimate.modelId : "none"}
          dated={estimate.kind === "date"}
          source="case-page"
        />
      ) : null}

      {decided ? <TheDecision decided={decided} duration={duration} cohort={cohort} wage={wage} w={w} /> : null}{" "}
      {decided ? <DecidedTimeline read={timeline} lang={lang} /> : null}{" "}
      <StatusHistory events={history} filedOn={filingDate} lang={lang} />

      {meaning && actionStage ? (
        <PageSection title={t.means(meaning.label)}>
          <StatusExplainer meaning={meaning} nowInStatus={statusOutlook?.nowInStatus ?? null} w={w} />
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
        w={w}
      />

      {/* After DOL: the I-140 and I-485 have no federal per-case record, so
          this is the only trace of them, as labelled user reports. Rendered for
          decided cases too: a certified PERM is the case whose next stage
          people want to compare notes on. */}
      <CaseMilestones caseNumber={result.caseNumber} className="mt-12 sm:mt-16" />{" "}
      {sameDay ? <SameDayCases data={sameDay} className="mt-12 sm:mt-16" lang={lang} /> : null}

      <FoldList>
        {!isFinal && wall ? (
          <Fold title={t.queueFoldTitle} hint={t.queueFoldHint}>
            <Position wall={wall} cohort={cohort} publishedFront={publishedFront} publishedAsOf={publishedAsOf} w={w} />
          </Fold>
        ) : null}
        {meaning && !actionStage ? (
          <Fold title={t.means(meaning.label)} hint={kindLabel(meaning.kind, lang)}>
            <StatusExplainer meaning={meaning} nowInStatus={statusOutlook?.nowInStatus ?? null} w={w} />
          </Fold>
        ) : !meaning && status ? (
          <Fold title={t.means(prettyStatus(status))}>
            <UndecodedStatus w={w} />
          </Fold>
        ) : null}
        {!isFinal && cohort && groupByStage(cohortStatuses).pending > 0 ? (
          <Fold title={t.restTitle(w.month(cohort.month) ?? cohort.month)} hint={t.restHint}>
            <CohortQueues counts={cohortStatuses} month={cohort.month} w={w} />
          </Fold>
        ) : null}
        {/* Pending only: on a decided case this read "0 of 15,330 still open". */}
        {!isFinal && neighbours.length > 1 && cohort ? (
          <Fold title={t.neighboursTitle} hint={t.neighboursHint}>
            <Neighbours months={neighbours} month={cohort.month} w={w} />
          </Fold>
        ) : null}
        {employer ? (
          <Fold title={t.employerTitle} hint={t.employerHint(employer.name)}>
            <EmployerRecord employer={employer} w={w} />
          </Fold>
        ) : null}
        <Fold title={t.wontSayTitle}>
          <WontSay isFinal={isFinal} lang={lang} />
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
  w,
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
  w: Words;
}) {
  const { t, lang } = w;
  const verdict = meaning ? kindLabel(meaning.kind, lang) : isFinal ? t.verdictDecided : t.verdictPending;

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
        aheadLabel={casesAhead !== null ? t.aheadLabel(w.int(casesAhead)) : undefined}
        lang={lang}
      />
    ) : null;

  const sourceBits = [
    check ? t.sourceShown(w.day(check.date) ?? check.date) : null,
    publishedAsOf ? t.sourceQueue(w.day(publishedAsOf) ?? publishedAsOf) : null,
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
          <DecidedNext
            status={status}
            approved={approved}
            filingDate={filingDate}
            decisionDate={decided?.decisionDate ?? null}
            t={t}
          />
        ) : (
          <AnswerNext
            caseNumber={caseNumber}
            program="perm"
            lang={lang}
            dateLabel={t.estimatedDecision}
            date={estimate?.kind === "date" ? t.around(w.day(estimate.estimatedDate) ?? estimate.estimatedDate) : null}
            note={
              estimate?.kind === "date" ? (
                <a href={`#${ESTIMATE_ANCHOR}`} className="link inline-flex min-h-11 items-center">
                  {t.howWorkedOut}
                </a>
              ) : estimate?.kind === "no-date" ? (
                <>
                  {t.noDateYet}{" "}
                  <a href={`#${ESTIMATE_ANCHOR}`} className="link">
                    {t.hereIsWhy}
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
          {t.statusIs[0]}
          <b className="font-semibold" translate="no">
            {prettyStatus(status)}
          </b>
          {t.statusIs[1]}
        </>
      ) : (
        <>{t.inRecords}</>
      )}
      {t.sep}
      {filingDate ? t.filed(w.day(filingDate) ?? filingDate, elapsed !== null && !isFinal ? w.int(elapsed) : null) : null}
      {t.sep}
      {isFinal && decided?.decisionDate ? (
        t.decidedOn(
          w.day(decided.decisionDate) ?? decided.decisionDate,
          decided.days !== null ? w.int(decided.days) : null,
        )
      ) : wall && !wall.isPastFront ? (
        <Bold
          className="font-semibold"
          parts={t.working(
            publishedFront ? (w.month(publishedFront) ?? publishedFront) : null,
            w.month(wall.frontMonth) ?? wall.frontMonth,
            publishedFront !== null && publishedFront !== wall.frontMonth,
            w.int(casesAhead ?? wall.ahead),
          )}
        />
      ) : wall ? (
        <>{t.pastFront}</>
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

/** The planner, filled in from the case: certified on its decision day when DOL has decided, else filed on its filing day. */
function planHrefFor(filingDate: string | null, decisionDate: string | null): string {
  return filingDate ? planHref({ permFiled: filingDate, permCertified: decisionDate }) : "/tools/green-card-timeline";
}

/** A decided case's next step: what comes after PERM, or what a denial means. */
function DecidedNext({
  status,
  approved,
  filingDate,
  decisionDate,
  t,
}: {
  status: string | null;
  approved: boolean;
  filingDate: string | null;
  decisionDate: string | null;
  t: CaseStatusResultText;
}) {
  const denied = status?.trim().toUpperCase().startsWith("DENIED") ?? false;
  const next = approved
    ? { href: planHrefFor(filingDate, decisionDate), ...t.planNext }
    : denied
      ? { href: "/guides/perm-denied-what-happens-next", ...t.deniedNext }
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
  w,
}: {
  result: CaseLookupResult;
  parsed: ReturnType<typeof parseCaseNumber>;
  status: string | null;
  filingDate: string | null;
  elapsed: number | null;
  isFinal: boolean;
  check: ReturnType<typeof statusCheckAge>;
  w: Words;
}) {
  const { t } = w;
  const { live, decided } = result;
  const employerName = live?.employerName ?? decided?.employerName ?? null;
  const jobTitle = live?.jobTitle ?? decided?.jobTitle ?? null;

  const rows: RecordRow[] = [
    { label: t.row.status, value: status ? prettyStatus(status) : t.notRecorded, raw: !!status },
    { label: t.row.caseNumber, value: result.caseNumber, raw: true, mono: true },
    {
      label: t.row.filed,
      value: filingDate
        ? t.filedRow(w.day(filingDate) ?? filingDate, elapsed !== null && !isFinal ? w.int(elapsed) : null)
        : t.notRecorded,
    },
    { label: t.row.employer, value: employerName ?? t.notRecorded, raw: !!employerName },
    { label: t.row.jobTitle, value: jobTitle ?? t.notRecorded, raw: !!jobTitle },
    {
      label: t.row.checked,
      value: check ? t.checkedRow(w.day(check.date) ?? check.date, check.ageDays, w.int(check.ageDays)) : t.notRecorded,
    },
  ];

  return (
    <PageSection title={t.recordTitle} lede={t.recordLede}>
      <RecordList rows={rows} />{" "}
      {parsed ? (
        <FinePrint summary={t.numberSays} className="mt-3">
          <CaseNumberPlate parsed={parsed} recordedFilingDate={filingDate} lang={w.lang} />
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
  w,
}: {
  wall: Wall;
  cohort: CaseLookupResult["cohort"];
  publishedFront: string | null;
  publishedAsOf: string | null;
  w: Words;
}) {
  const { t, lang } = w;
  const maturity = cohort ? cohortMaturity({ ...cohort, decidedPct: cohort.decidedPct }) : "unknown";
  const front = w.month(wall.frontMonth) ?? wall.frontMonth;
  const behind = Math.abs(wall.monthsBehindFront);

  return (
    <div>
      <p className="max-w-2xl text-base leading-relaxed text-soft">{t.positionIntro}</p>{" "}

      {/* The one drawing that carries the whole mental model: DOL's tape of
          filing months with its work front, and this case's month marked on
          it. Same component the data hub draws, so the two surfaces teach
          the same picture. */}
      {cohort ? (
        <QueueTape
          frontierMonth={wall.frontMonth}
          selectedMonth={cohort.month}
          className="mt-6"
          lang={lang}
        />
      ) : null}

      <FigureRow className="mt-6">
        <Figure label={t.earlierMonths.label} value={w.int(wall.ahead)} note={t.earlierMonths.note} />
        <Figure label={t.sameMonth.label} value={w.int(wall.sameMonth)} note={t.sameMonth.note} />
        <Figure
          label={t.behindFront}
          value={
            wall.isPastFront
              ? t.monthsAhead(String(behind))
              : t.monthsBehind(wall.monthsBehindFront, String(wall.monthsBehindFront))
          }
          note={t.frontNote(front, wall.isPastFront)}
        />
      </FigureRow>

      {wall.isPastFront ? (
        <div className="mt-6 border-2 shadow-hard p-6 sm:p-8 bg-card border-border">
          <PastFrontNote wall={wall} lang={lang} />
        </div>
      ) : (
        <FigurePlate
          title={t.wallTitle}
          subject={t.wallSubject}
          className="mt-6"
          caption={<>{t.wallCaption}</>}
          source={t.wallSource(publishedAsOf ? (w.day(publishedAsOf) ?? publishedAsOf) : null)}
        >
          <CaseWall wall={wall} publishedFront={publishedFront} lang={lang} />
        </FigurePlate>
      )}

      {cohort ? (
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground">
          <Bold
            parts={t.cohortLine(
              w.int(cohort.total),
              w.month(cohort.month) ?? cohort.month,
              w.int(cohort.decided),
              percentLabel(cohort.decidedPct, lang, 1),
            )}
          />
          {maturity === "untouched" ? t.cohortUntouched : null}
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
  w,
}: {
  decided: NonNullable<CaseLookupResult["decided"]>;
  duration: CohortDuration | null;
  cohort: CaseLookupResult["cohort"];
  wage: CaseWageContext | null;
  w: Words;
}) {
  const { t } = w;
  const quotable =
    duration !== null &&
    cohort !== null &&
    canQuoteCohortDuration(duration.n, cohort.total);

  return (
    <PageSection title={t.decisionTitle} lede={t.decisionLede}>
      <FigureRow>
        <Figure
          label={t.outcome}
          value={prettyStatus(decided.status)}
          note={decided.decisionDate ? w.day(decided.decisionDate) ?? "" : ""}
        />
        {decided.days !== null ? (
          <Figure label={t.daysTaken.label} value={w.int(decided.days)} note={t.daysTaken.note} />
        ) : null}
        {decided.wage !== null ? (
          <Figure label={t.offeredWage} value={w.money(decided.wage)} note={decided.socTitle ?? t.asFiled} />
        ) : null}
        {decided.state ? <Figure label={t.worksiteState} value={decided.state} note={t.asFiled} /> : null}
      </FigureRow>

      {quotable && duration && cohort && decided.days !== null ? (
        <p className="mt-6 max-w-3xl text-base leading-relaxed text-soft border-2 shadow-hard p-5 bg-card border-border">
          <Bold
            className="font-semibold text-foreground"
            parts={t.duration(
              w.int(duration.n),
              w.month(cohort.month) ?? cohort.month,
              w.int(duration.medianDays ?? 0),
              w.int(duration.p25Days ?? 0),
              w.int(duration.p75Days ?? 0),
              w.int(decided.days),
              medianCompare(decided.days, duration.medianDays, w),
            )}
          />
        </p>
      ) : null}

      {wage ? <WageLadder wage={wage} w={w} /> : null}
    </PageSection>
  );
}

/** How a decided case's days compare with its month's middle, for the sentence that says so. */
function medianCompare(days: number, median: number | null, w: Words): MedianCompare {
  if (median === null) return { kind: "none" };
  if (days > median) return { kind: "longer", diff: w.int(days - median) };
  if (days < median) return { kind: "quicker", diff: w.int(median - days) };
  return { kind: "same" };
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
function WageLadder({ wage, w }: { wage: CaseWageContext; w: Words }) {
  const { t, money } = w;
  const row = wage.inState ?? wage.occupation;
  const scope = wage.inState
    ? t.wageScope(wage.socTitle ?? wage.socCode, String(wage.state))
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
      title={t.wageTitle}
      subject={scope}
      className="mt-6"
      caption={<>{t.wageBand(p25 !== null ? money(p25) : null, p75 !== null ? money(p75) : null)}</>}
      source={t.wageSource(w.int(row.n))}
    >
      <ChartTips label={t.wageChart(scope)} className="pb-9 pt-9">
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
          className="relative h-4 border-input bg-background border"
          data-tip={[
            scope,
            t.wageTip.thisCase(money(wage.wage)),
            t.wageTip.p5(money(p5)),
            p25 !== null ? t.wageTip.p25(money(p25)) : null,
            t.wageTip.median(money(p50)),
            p75 !== null ? t.wageTip.p75(money(p75)) : null,
            t.wageTip.p95(money(p95)),
            t.wageTip.certified(w.int(row.n)),
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
          {t.medianMark(money(p50))}
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
  w,
}: {
  meaning: NonNullable<ReturnType<typeof getStatusMeaning>>;
  nowInStatus: number | null;
  w: Words;
}) {
  const { t } = w;
  return (
    <div className="max-w-3xl">
      <p className="text-base leading-relaxed text-soft">{meaning.summary}</p>{" "}
      {meaning.deadline ? (
        <p className="mt-4 border-l-2 border-data-warn-ink bg-data-warn/8 px-4 py-3 text-base leading-relaxed text-soft">
          <b className="font-semibold text-foreground">{t.clock}</b> {meaning.deadline}
        </p>
      ) : null}{" "}
      {meaning.action ? (
        <p className="mt-4 text-base leading-relaxed text-soft">
          <b className="font-semibold text-foreground">{t.whoActs}</b> {meaning.action}
        </p>
      ) : null}{" "}
      {nowInStatus !== null ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          <Bold className="font-semibold text-foreground" parts={t.nowIn(w.int(nowInStatus))} />
        </p>
      ) : null}{" "}
      <p className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {meaning.cite ? (
          <a href={meaning.cite.href} rel="noopener noreferrer" className={cn("font-mono", "link")}>
            {meaning.cite.label}
          </a>
        ) : (
          <span className="text-muted-foreground">{t.noDefinition}</span>
        )}{" "}
        <Link href={`/perm-case-statuses#${statusAnchor(meaning.status)}`} className="link">
          {t.everyStatus}
        </Link>
      </p>
    </div>
  );
}

function UndecodedStatus({ w }: { w: Words }) {
  return <p className="max-w-3xl text-base leading-relaxed text-soft">{w.t.undecoded}</p>;
}

/* ------------------------------------------------------------------ */
/* Which queue the rest of the month is in.                            */
/* ------------------------------------------------------------------ */

function CohortQueues({
  counts,
  month,
  w,
}: {
  counts: readonly StatusCount[];
  month: string;
  w: Words;
}) {
  const { t, lang } = w;
  const split = groupByStage(counts);
  if (split.pending === 0) return null;
  const label = w.month(month) ?? month;

  return (
    <div>
      <p className="max-w-2xl text-base leading-relaxed text-soft">
        <Bold className="font-semibold text-foreground" parts={t.inOrder(w.int(split.ordinary), w.int(split.pending))} />
      </p>
      {/* The same drawing the month pages use, on the same data, so a reader
          arriving from /perm-queue/<month> isn't asked to learn a second chart. */}
      <ChartTips label={t.stageChart(label)} className="mt-6">
        <StageBar stages={split.stages} scale="composition" tipHeading={t.stageTipHeading(label)} lang={lang} />
      </ChartTips>
      <StageLegend stages={split.stages} className="mt-4" lang={lang} />
      <FinePrint summary={t.everyStatusIn(label)} className="mt-6">
        <PendingCensus
          stages={split.stages}
          caption={t.censusCaption(label)}
          hrefFor={(status) => statusCasesHref(status, month)}
          lang={lang}
        />
      </FinePrint>
      <p className="mt-4 text-sm">
        <Link href={`/perm-queue/${month}`} className="link">
          {t.fullSplit(label)}
        </Link>
      </p>
    </div>
  );
}

/** The filing month beside two months either side of it. */
function Neighbours({ months, month, w }: { months: readonly CohortMonth[]; month: string; w: Words }) {
  return (
    <div>
      <p className="max-w-2xl text-base leading-relaxed text-soft">{w.t.neighboursIntro(w.month(month) ?? month)}</p>{" "}
      <CohortNeighbours months={months} subjectMonth={month} className="mt-5" lang={w.lang} />{" "}
      <p className="mt-4 text-sm">
        <Link href="/perm-queue" className="link">
          {w.t.everyMonth}
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
  w,
}: {
  employer: NonNullable<CaseLookupResult["employer"]>;
  w: Words;
}) {
  const { t, lang } = w;
  const thin = employer.total < MIN_RATE_SAMPLE;
  const rate = percentLabel(employer.approvalRate, lang, 1);
  const figures: { value: string; label: string }[] = [
    { value: w.int(employer.total), label: t.fig.decided },
    { value: w.int(employer.certified), label: t.fig.certified },
    ...(employer.denied > 0 ? [{ value: w.int(employer.denied), label: t.fig.denied }] : []),
    ...(employer.medianDays !== null
      ? [{ value: w.int(Math.round(employer.medianDays)), label: t.fig.medianDays }]
      : []),
    ...(thin ? [] : [{ value: rate, label: t.fig.rate }]),
  ];

  return (
    <div>
      <p className="max-w-2xl text-base leading-relaxed text-soft">{t.employerIntro}</p>{" "}
      <div className="mt-5 border-2 shadow-hard p-5 sm:p-6 bg-card border-border">
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

        <p className="mt-5 max-w-3xl text-base leading-relaxed text-soft border-t-2 border-border">
          {thin
            ? employer.total === employer.certified
              ? t.cleanRecord(w.int(employer.total))
              : t.thinRecord(w.int(employer.total))
            : t.rateRecord(rate, w.int(employer.total))}
          {t.sep}
          <Link
            href={entityHref("employer", employer.slug)}
            className="link"
          >
            {t.everythingAbout(employer.name)}
          </Link>
          {t.end}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The refusals, said out loud.                                        */
/* ------------------------------------------------------------------ */

export function WontSay({ isFinal, lang = "en" }: { isFinal: boolean; lang?: Lang }) {
  const { wontSay } = CASE_STATUS_RESULT[lang] as CaseStatusResultText;
  return (
    <ul className="max-w-3xl space-y-4 text-base leading-relaxed text-soft">
      {!isFinal ? (
        <>
          <li>
            <b className="font-semibold text-foreground">{wontSay.date.lead}</b>
            <LinkedText parts={wontSay.date.body} href="/tools/perm-timeline-calculator" />
          </li>{" "}
          <li>
            <b className="font-semibold text-foreground">{wontSay.odds.lead}</b>
            <LinkedText parts={wontSay.odds.body} href="/perm-denial-risk" />
          </li>
        </>
      ) : (
        <li>
          <b className="font-semibold text-foreground">{wontSay.next.lead}</b>
          <LinkedText parts={wontSay.next.body} href="/tools/green-card-timeline" />
        </li>
      )}{" "}
      <li>
        <b className="font-semibold text-foreground">{wontSay.worker.lead}</b>
        {wontSay.worker.body}
      </li>
    </ul>
  );
}

/** A sentence around one internal link, in the order the language puts them. */
function LinkedText({ parts, href }: { parts: Linked; href: string }) {
  return (
    <>
      {parts[0]}
      <Link href={href} className="link">
        {parts[1]}
      </Link>
      {parts[2]}
    </>
  );
}
