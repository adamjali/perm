import Link from "next/link";
import { Fragment } from "react";

import { FigurePlate } from "@/components/tools/FigurePlate";
import { AnswerPanel } from "@/components/tools/Insight";
import { PageSection } from "@/components/data/PageSection";
import { Fold, FoldList } from "@/components/data/Fold";
import { FinePrint } from "@/components/data/FinePrint";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { WatchThisNumber } from "@/components/tools/WatchThisNumber";
import { CaseNumberPlate } from "@/components/tools/CaseNumberPlate";
import { CaseWall, CohortNeighbours } from "@/components/tools/CaseWall";
import { WontSay } from "@/components/tools/CaseStatusResult";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import type { CohortMonth } from "@/lib/liveQueue";
import type { Wall } from "@/lib/casePosition";
import type { ParsedCaseNumber } from "@/lib/permCaseNumber";
import { CASE_NUMBER_ACCURACY } from "@/lib/permCaseNumber";
import { DOL_CASE_STATUS_URL } from "@/components/queue/SourceNote";
import { isLookupGap, unsettledClause, unsettledVerdict, type DiscoveryMiss } from "@/lib/dolMiss";
import { formatInt } from "@/lib/format";

/**
 * A case number we hold no record for. A real state, not an error.
 *
 * THE WHOLE DESIGN PROBLEM IS ONE OF ATTRIBUTION. The filing month decodes
 * from the number itself, so the cohort around it can be shown even when the
 * case cannot be found, and a cohort figure sitting under somebody's own
 * case number reads as a figure about their case unless every single line
 * says otherwise. So nothing here is phrased as "your case", the heading
 * says what the numbers are about, and the first thing on the page is the
 * plain statement that the case was not found.
 *
 * WHY IT HAPPENS, and the page says so rather than implying a problem: the
 * per-case data starts at filings from mid-2023, DOL's decided files cover
 * FY2024 onward, and a case filed in the last few days may simply not have
 * been picked up yet. None of those are anything wrong with the case.
 */

export interface CaseNotFoundProps {
  caseNumber: string;
  /** Decoded from the number, when it decodes at all. */
  parsed: ParsedCaseNumber | null;
  /**
   * The legacy three-segment form, which carries no readable filing date.
   *
   * The two formats diverge here and the page has to as well. A current-format
   * number we cannot find still yields a filing month, so the cohort around it
   * is real context. A legacy one yields nothing, and showing a month anyway
   * would mean guessing: reading its middle block as a date is right 13.4% of
   * the time against 90.5% for the current format.
   */
  isLegacy?: boolean;
  cohort: CohortMonth | null;
  wall: Wall | null;
  neighbours: readonly CohortMonth[];
  publishedFront: string | null;
  publishedAsOf: string | null;
  mirrorSize: number | null;
  /**
   * Why DOL's live check could not settle it (caseLookup's `dolMiss`). Only
   * "none", or no value, may read as "no record": "unavailable" means DOL did
   * not answer in time and "not-asked" that it was not asked, and saying "no
   * record" for those would tell people DOL had no such case when it had only
   * been slow.
   */
  dolMiss?: DiscoveryMiss | "records" | null;
}

export function CaseNotFound({
  caseNumber,
  parsed,
  isLegacy = false,
  cohort,
  wall,
  neighbours,
  publishedFront,
  publishedAsOf,
  mirrorSize,
  dolMiss = null,
}: CaseNotFoundProps) {
  const checked = mirrorSize ? `Checked ${formatInt(mirrorSize)} per-case statuses and DOL's FY2024 to FY2026 decided files` : null;
  if (isLookupGap(dolMiss)) {
    const retry = `/perm-case-status?case=${encodeURIComponent(caseNumber)}`;
    return (
      <div>
        <AnswerPanel
          verdict={unsettledVerdict(dolMiss)}
          direction="flat"
          source={
            checked
              && dolMiss !== "records"
              ? `${checked}; ${dolMiss === "unavailable" ? "DOL's live check didn't answer within 8 seconds" : "the live check with DOL wasn't made"}`
              : undefined
          }
        >
          {dolMiss === "records" ? "We couldn't check" : "We hold no record for"}{" "}
          <b className="font-mono">{caseNumber}</b>
          {dolMiss === "records" ? " just now: " : " yet, "}
          {unsettledClause(dolMiss)}{" "}
          <a href={retry} className="link">
            Try again
          </a>{" "}
          or use{" "}
          <a href={DOL_CASE_STATUS_URL} rel="noopener noreferrer" className="link">
            DOL&apos;s own case-status search
          </a>
          .
        </AnswerPanel>
      </div>
    );
  }
  return (
    <div>
      <AnswerPanel
        verdict="Not in our records"
        direction="flat"
        label={<span translate="no">{caseNumber}</span>}
        source={checked ? `${checked}, then asked DOL directly` : undefined}
        actions={
          // A number in the current format we can't find is usually a recent
          // filing, the case most worth watching. Legacy numbers are all
          // decided, so they get nothing.
          isLegacy ? undefined : (
            <div className="mt-6 border-t border-foreground/10 pt-6">
              <WatchThisNumber caseNumber={caseNumber} program="perm" variant="inline" />
            </div>
          )
        }
      >
        We hold no record for this number. That isn&apos;t a statement about the case, only that this project
        hasn&apos;t got it, and{" "}
        {/* THE CASE-STATUS SEARCH, NOT THE PROCESSING-TIMES PAGE: the link says
            DOL's own system is the authority on THIS NUMBER. */}
        <a href={DOL_CASE_STATUS_URL} rel="noopener noreferrer" className="link">
          DOL&apos;s own case-status search
        </a>{" "}
        is the authority either way.
      </AnswerPanel>

      <PageSection title="Why a real case can be missing here">
        <ul className="max-w-3xl space-y-3 text-base leading-relaxed text-soft">
          <li>
            <b className="font-semibold text-foreground">DOL doesn&apos;t return it.</b> A number we don&apos;t
            already hold is asked of DOL at the moment you search, so a filing from this week resolves. If DOL&apos;s
            own system has no exact match, neither do we.
          </li>{" "}
          <li>
            <b className="font-semibold text-foreground">It was filed before mid-2023.</b> The per-case status data
            doesn&apos;t reach further back, and DOL&apos;s published decision files start at fiscal year 2024.
          </li>{" "}
          <li>
            <b className="font-semibold text-foreground">A digit is off.</b> One wrong digit in the serial is still a
            well-formed number that belongs to nobody. Check it against the receipt, or{" "}
            <Link href="/case-search" className="link">
              find the case by employer name
            </Link>
            .
          </li>
        </ul>{" "}
        {parsed ? (
          <FinePrint summary="What the case number says" className="mt-4">
            <CaseNumberPlate parsed={parsed} />{" "}
            <p>{CASE_NUMBER_ACCURACY}</p>
          </FinePrint>
        ) : null}
      </PageSection>

      {isLegacy ? (
        <PageSection title="This is the older case-number format">
          <p className="max-w-3xl text-base leading-relaxed text-soft">
            Numbers like <b className="font-mono font-semibold text-foreground">{caseNumber}</b> are the older
            three-part format, used mostly in 2022 and 2023. Its middle digits aren&apos;t a filing date: read as one,
            they match DOL&apos;s receipt date only <b className="font-semibold text-foreground">13% of the time</b>,
            against 90% for the current format. Every case in this format is already decided and published, so a
            real one would be found here. Check the digits against the receipt.
          </p>
        </PageSection>
      ) : null}

      <FoldList>
        {parsed && cohort ? (
          // The heading carries the attribution: everything here is about a
          // month, and a reader who only reads headings must not think any of
          // it was measured on their case.
          <Fold title={`Cases filed in ${formatMonth(cohort.month)}`} hint="The month this number decodes to">
            <p className="max-w-2xl text-base leading-relaxed text-soft">
              <b className="font-semibold text-foreground">None of this was measured on {caseNumber}</b>, which we
              couldn&apos;t find. It describes the {formatInt(cohort.total)} cases we hold that were filed alongside
              it.
            </p>

            <FigureRow className="mt-6">
              <Figure label="Filed that month" value={formatInt(cohort.total)} note="cases checked against DOL" />
              <Figure
                label="Still undecided"
                value={formatInt(cohort.pending)}
                note={
                  cohort.decidedPct !== null ? `${cohort.decidedPct.toFixed(1)}% of the month is decided` : "of that month"
                }
              />
              {wall && !wall.isPastFront ? (
                <Figure
                  label="Filed before that month"
                  value={formatInt(wall.ahead)}
                  note="undecided, across every earlier month"
                />
              ) : null}
            </FigureRow>

            {wall && !wall.isPastFront ? (
              <FigurePlate
                title="The wall in front of that filing month"
                subject="Undecided cases by filing month"
                className="mt-6"
                caption={
                  <>
                    Drawn for {formatMonth(cohort.month)}, the month this number decodes to: the queue in front of
                    that month rather than in front of any one case.
                  </>
                }
                source={
                  publishedAsOf
                    ? `Per-case statuses from DOL's own case status system, checked daily · DOL queue position as of ${formatAsOf(publishedAsOf)}`
                    : "Per-case statuses from DOL's own case status system, checked daily"
                }
              >
                {/* Not "Yours": the case wasn't found, so this column is the
                    month the NUMBER decodes to and nothing more. */}
                <CaseWall wall={wall} publishedFront={publishedFront} attribution="month" />
              </FigurePlate>
            ) : null}

            {neighbours.length > 1 ? (
              <CohortNeighbours months={neighbours} subjectMonth={cohort.month} attribution="month" className="mt-6" />
            ) : null}

            <p className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <Link href={`/perm-queue/${cohort.month}`} className="link">
                The full split for {formatMonth(cohort.month)}
              </Link>{" "}
              <Link href="/perm-processing-times" className="link">
                Get told when DOL reaches that month
              </Link>
            </p>
          </Fold>
        ) : null}
        <Fold title="What this page won't tell you">
          <WontSay isFinal={false} />
        </Fold>
      </FoldList>
    </div>
  );
}

/**
 * The page with nothing typed in yet.
 *
 * An empty screen is an invitation to act, and it is also the version of this
 * page that search engines index, so it states what the tool does and what
 * the queue looks like today rather than rendering a bare input.
 */
export function CaseStatusEmpty({
  front,
  wallTotal,
  publishedFront,
  publishedAsOf,
  mirrorSize,
}: {
  front: string | null;
  wallTotal: number | null;
  publishedFront: string | null;
  publishedAsOf: string | null;
  mirrorSize: number | null;
}) {
  const facts: { label: string; value: string; note: string }[] = [];
  if (front) {
    facts.push({
      label: "Oldest month still open",
      value: formatMonth(front) ?? front,
      note: "the oldest filing month DOL hasn't substantially decided",
    });
  }
  if (wallTotal !== null) {
    facts.push({
      label: "Undecided cases",
      value: formatInt(wallTotal),
      note: "across every filing month, the whole wall",
    });
  }
  if (publishedFront && publishedFront !== front) {
    facts.push({
      label: "DOL is working",
      value: formatMonth(publishedFront) ?? publishedFront,
      note: publishedAsOf ? `as of ${formatAsOf(publishedAsOf)}` : "analyst review",
    });
  }

  return (
    <div>
      {facts.length > 0 ? (
        <FigureRow>
          {facts.map((f) => (
            <Fragment key={f.label}>
              {" "}
              <Figure label={f.label} value={f.value} note={f.note} />
            </Fragment>
          ))}
        </FigureRow>
      ) : null}{" "}
      <PageSection title="What a case number gets you here">
        <ul className="max-w-3xl space-y-3 text-base leading-relaxed text-soft">
          <li>
            <b className="font-semibold text-foreground">The status, decoded.</b> DOL shows one word and explains
            none of them. Some mean waiting and some mean a 30-day clock is running on the employer.
          </li>{" "}
          <li>
            <b className="font-semibold text-foreground">The position.</b> How many undecided cases were filed
            before it, and how far its filing month sits behind the month DOL is working.
          </li>{" "}
          <li>
            <b className="font-semibold text-foreground">An estimated decision date, and an email when it moves.</b>
          </li>{" "}
          <li>
            <b className="font-semibold text-foreground">For a decided case, DOL&apos;s own file.</b> The outcome,
            the days it took, the offered wage against its occupation, and the worksite state.
          </li>
        </ul>
        {mirrorSize ? (
          <p className="mt-5 text-sm text-muted-foreground border-t-2 border-border">
            Searched against {formatInt(mirrorSize)} per-case statuses, read from DOL&apos;s own case-status search,
            plus DOL&apos;s published decisions for FY2024 to FY2026. Nothing is stored and nothing is sent anywhere
            else.
          </p>
        ) : null}
      </PageSection>
    </div>
  );
}
