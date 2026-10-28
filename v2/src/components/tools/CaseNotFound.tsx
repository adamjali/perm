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
import type { CohortMonth } from "@/lib/liveQueue";
import type { Wall } from "@/lib/casePosition";
import type { ParsedCaseNumber } from "@/lib/permCaseNumber";
import { DOL_CASE_STATUS_URL } from "@/components/queue/SourceNote";
import { budgetResetEastern, isLookupGap, type DiscoveryMiss } from "@/lib/dolMiss";
import { DOL_MISS } from "@/lib/dolMiss.messages";
import { intlLocale, localizedPath, type Lang } from "@/lib/i18n/lang";
import { dayLabel, intLabel, monthLabel } from "@/lib/i18n/format";
import { CASE_STATUS_EMPTY } from "./CaseStatusEmpty.messages";
import { CASE_NOT_FOUND, type CaseNotFoundText } from "./CaseNotFound.messages";
import { CASE_NUMBER_PLATE } from "./CaseNumberPlate.messages";

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
 * WHY IT HAPPENS, and the page says so rather than implying a problem: DOL's
 * live system has no exact match, the case was decided before the decided files
 * we hold begin (October 2015), or a digit is off. None of those are anything
 * wrong with the case.
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
  /** The page's language. English by default, and English output never changes. */
  lang?: Lang;
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
  lang = "en",
}: CaseNotFoundProps) {
  const t: CaseNotFoundText = CASE_NOT_FOUND[lang];
  const month = (iso: string) => monthLabel(iso, lang) ?? iso;
  const checked = mirrorSize ? t.checked(intLabel(mirrorSize, lang)) : null;
  if (isLookupGap(dolMiss)) {
    const retry = `${localizedPath("/perm-case-status", lang)}?case=${encodeURIComponent(caseNumber)}`;
    const which = dolMiss === "records" ? "records" : "other";
    return (
      <div>
        <AnswerPanel
          verdict={DOL_MISS[lang].verdict[dolMiss]}
          direction="flat"
          source={
            checked && dolMiss !== "records"
              ? `${checked}${dolMiss === "unavailable" ? t.afterDolUnavailable : t.afterNotAsked}`
              : undefined
          }
        >
          {t.gapLead[which]}{" "}
          <b className="font-mono" translate="no">
            {caseNumber}
          </b>
          {t.gapAfter[which]}
          {DOL_MISS[lang].clause(dolMiss, budgetResetEastern(new Date(), intlLocale(lang)))}
          {t.sep}
          <a href={retry} className="link">
            {t.tryAgain}
          </a>
          {t.orUse}
          <a href={DOL_CASE_STATUS_URL} rel="noopener noreferrer" className="link" hrefLang="en">
            {t.dolSearch}
          </a>
          {t.gapEnd}
        </AnswerPanel>
      </div>
    );
  }
  return (
    <div>
      <AnswerPanel
        verdict={t.notInRecords}
        direction="flat"
        label={<span translate="no">{caseNumber}</span>}
        source={checked ? `${checked}${t.thenAskedDol}` : undefined}
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
        {t.noRecordLead}
        {/* THE CASE-STATUS SEARCH, NOT THE PROCESSING-TIMES PAGE: the link says
            DOL's own system is the authority on THIS NUMBER. */}
        <a href={DOL_CASE_STATUS_URL} rel="noopener noreferrer" className="link" hrefLang="en">
          {t.dolSearch}
        </a>
        {t.noRecordEnd}
      </AnswerPanel>

      <PageSection title={t.whyTitle}>
        <ul className="max-w-3xl space-y-3 text-base leading-relaxed text-soft">
          <li>
            <b className="font-semibold text-foreground">{t.whyDol.lead}</b>
            {t.sep}
            {t.whyDol.rest}
          </li>{" "}
          <li>
            <b className="font-semibold text-foreground">{t.whyOld.lead}</b>
            {t.sep}
            {t.whyOld.rest}
          </li>{" "}
          <li>
            <b className="font-semibold text-foreground">{t.whyDigitLead}</b>
            {t.sep}
            {t.whyDigitRest}
            <Link href="/case-search" className="link" hrefLang={lang === "en" ? undefined : "en"}>
              {t.findByEmployer}
            </Link>
            {t.end}
          </li>
        </ul>{" "}
        {parsed ? (
          <FinePrint summary={t.numberSays} className="mt-4">
            <CaseNumberPlate parsed={parsed} lang={lang} />{" "}
            <p>{CASE_NUMBER_PLATE[lang].accuracy}</p>
          </FinePrint>
        ) : null}
      </PageSection>

      {isLegacy ? (
        <PageSection title={t.legacyTitle}>
          <p className="max-w-3xl text-base leading-relaxed text-soft">
            {t.legacyBefore}
            <b className="font-mono font-semibold text-foreground" translate="no">
              {caseNumber}
            </b>
            {t.legacyMiddle}
            <b className="font-semibold text-foreground">{t.legacyBold}</b>
            {t.legacyAfter}
          </p>
        </PageSection>
      ) : null}

      <FoldList>
        {parsed && cohort ? (
          // The heading carries the attribution: everything here is about a
          // month, and a reader who only reads headings must not think any of
          // it was measured on their case.
          <Fold title={t.monthTitle(month(cohort.month))} hint={t.monthHint}>
            <p className="max-w-2xl text-base leading-relaxed text-soft">
              <b className="font-semibold text-foreground">{t.notMeasuredBold(caseNumber)}</b>
              {t.notMeasuredRest(intLabel(cohort.total, lang))}
            </p>

            <FigureRow className="mt-6">
              <Figure label={t.filedThatMonth} value={intLabel(cohort.total, lang)} note={t.checkedAgainstDol} />
              <Figure
                label={t.stillUndecided}
                value={intLabel(cohort.pending, lang)}
                note={
                  cohort.decidedPct !== null
                    ? t.pctDecided(cohort.decidedPct.toLocaleString(intlLocale(lang), { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
                    : t.ofThatMonth
                }
              />
              {wall && !wall.isPastFront ? (
                <Figure label={t.filedBefore} value={intLabel(wall.ahead, lang)} note={t.filedBeforeNote} />
              ) : null}
            </FigureRow>

            {wall && !wall.isPastFront ? (
              <FigurePlate
                title={t.wallTitle}
                subject={t.wallSubject}
                className="mt-6"
                caption={t.wallCaption(month(cohort.month))}
                source={
                  publishedAsOf && dayLabel(publishedAsOf, lang)
                    ? t.wallSourceAsOf(dayLabel(publishedAsOf, lang) ?? publishedAsOf)
                    : t.wallSource
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
              <Link href={`/perm-queue/${cohort.month}`} className="link" hrefLang={lang === "en" ? undefined : "en"}>
                {t.fullSplit(month(cohort.month))}
              </Link>{" "}
              <Link href="/perm-processing-times" className="link" hrefLang={lang === "en" ? undefined : "en"}>
                {t.getTold}
              </Link>
            </p>
          </Fold>
        ) : null}
        <Fold title={t.wontSayTitle}>
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
  lang = "en",
}: {
  front: string | null;
  wallTotal: number | null;
  publishedFront: string | null;
  publishedAsOf: string | null;
  mirrorSize: number | null;
  lang?: Lang;
}) {
  const t = CASE_STATUS_EMPTY[lang];
  const facts: { label: string; value: string; note: string }[] = [];
  if (front) {
    facts.push({ label: t.oldestOpen, value: monthLabel(front, lang) ?? front, note: t.oldestOpenNote });
  }
  if (wallTotal !== null) {
    facts.push({ label: t.undecided, value: intLabel(wallTotal, lang), note: t.undecidedNote });
  }
  if (publishedFront && publishedFront !== front) {
    const asOf = dayLabel(publishedAsOf, lang);
    facts.push({
      label: t.dolWorking,
      value: monthLabel(publishedFront, lang) ?? publishedFront,
      note: asOf ? t.asOf(asOf) : t.analystReview,
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
      <PageSection title={t.sectionTitle}>
        <ul className="max-w-3xl space-y-3 text-base leading-relaxed text-soft">
          {t.bullets.map((b) => (
            <Fragment key={b.lead}>
              <li>
                <b className="font-semibold text-foreground">{b.lead}</b>
                {b.rest ? ` ${b.rest}` : null}
              </li>{" "}
            </Fragment>
          ))}
        </ul>
        {mirrorSize ? (
          <p className="mt-5 text-sm text-muted-foreground border-t-2 border-border">
            {t.searched(intLabel(mirrorSize, lang))}
          </p>
        ) : null}
      </PageSection>
    </div>
  );
}
