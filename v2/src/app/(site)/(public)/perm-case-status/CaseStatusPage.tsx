import type { Metadata } from "next";
import { withSocialCard } from "@/lib/socialCard";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WarningIcon } from "@phosphor-icons/react/ssr";

import { DataProvenance } from "@/components/data/DataProvenance";
import { FaqList } from "@/components/tools/FaqList";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { CASE_STATUS_FRAME, CaseStatusHead, CheckAnother, LookupSkeleton } from "./CaseStatusShell";
import { CASE_STATUS } from "./caseStatus.messages";
import { localizedPath, pageAlternates, type Lang } from "@/lib/i18n/lang";
import { CaseNotFound, CaseStatusEmpty } from "@/components/tools/CaseNotFound";
import { CaseStatusResult } from "@/components/tools/CaseStatusResult";
import { PwdLookup } from "@/components/tools/PwdStatusResult";
import { LcaLookup } from "@/components/tools/LcaStatusResult";
import { SeasonalLookup } from "@/components/tools/SeasonalStatusResult";
import { buildWall, neighbourMonths } from "@/lib/casePosition";
import { isLegacyCaseNumber, normaliseCaseNumber } from "@/lib/caseNumberShape";
import { looksLikeReceipt, normaliseReceipt } from "@/lib/uscis/receipt";
import { findFront, type CohortMonth } from "@/lib/liveQueue";
import { openGraphBase } from "@/lib/openGraphBase";
import { parseCaseNumber } from "@/lib/permCaseNumber";
import { getMonthBacklog } from "@/lib/db/backlog";
import { getCaseWageContext, getCohortDuration } from "@/lib/db/caseContext";
import { lookupCase } from "@/lib/db/caseLookup";
import { getDecidedTimeline } from "@/lib/db/decidedTimeline";
import { normalisePwdCaseNumber } from "@/lib/db/pwdCases";
import { normaliseLcaCaseNumber } from "@/lib/db/lcaCases";
import { normaliseSeasonalCaseNumber } from "@/lib/db/seasonalCases";
import { getEstimatorData } from "@/lib/db/estimate";
import { caseEstimateInputs } from "@/lib/caseEstimateInputs";
import { getPermDayQueue } from "@/lib/db/permDayQueue";
import { getDecisionPace } from "@/lib/db/decisionPace";
import { getStragglerRates } from "@/lib/db/stragglers";
import { getRangeCoverage } from "@/lib/db/rangeCoverage";
import { getRfiClock, rfiEnteredOn } from "@/lib/db/rfiClock";
import { getSweepCoverage } from "@/lib/db/sweepCoverage";
import { getSameDay } from "@/lib/db/sameDay";
import {
  getStageStats,
  ageByStatusFrom,
  exitMixFor,
  stageDurationFor,
} from "@/lib/db/stageStats";
import { getLiveBacklog, getLiveMirrorSize } from "@/lib/db/publicData";
import { MoreText } from "@/components/data/MoreText";
import { buttonVariants } from "@/components/ui/button";
import { SEARCH_TEXT_MAX, SEARCH_TEXT_MIN } from "@/lib/search/limits";
import { caseSearchHref } from "@/lib/caseSearchPlan";

/**
 * One PERM case number in, everything we can honestly say about it out.
 *
 * THE ROUTE IS `/perm-case-status` AND NOT `/tools/case-status`. Two reasons,
 * and the first is the weaker one: the phrase people type is "check my PERM
 * case status", and the path carries it. The real reason is that `/tools/*`
 * on this site means a CALCULATOR, something you configure to get an
 * estimate, and this computes nothing. It reads a federal record and shows
 * it, which puts it with `/perm-cases`, `/perm-queue` and `/perm-employers`
 * at the top level, all of which it links into.
 *
 * A PLAIN GET FORM, SO THE ANSWER HAS AN ADDRESS. `?case=` makes a result
 * shareable and bookmarkable, which the I-485 work established as the single
 * thing attorneys get the most out of, and it means the page works with
 * JavaScript off. Two things follow that are easy to miss:
 *
 *   1. Query-string results are `noindex`. A case number in a URL is an
 *      unbounded crawl space, and it is a federal identifier that resolves to
 *      an employer and a job title. Neither belongs in a search index. The
 *      canonical is the bare path on every variant.
 *   2. The number would otherwise reach PostHog verbatim in `$current_url` on
 *      every autocaptured event. `redactCaseParam` in instrumentation-client
 *      strips it before send.
 *
 * THE SHELL RENDERS BEFORE THE LOOKUP. The reads are a second or two against
 * a remote SQLite, so the header, the form and the explainer sit outside the
 * Suspense boundary and paint immediately. Somebody who mistyped a digit can
 * start again without waiting for the answer to a question they did not mean
 * to ask.
 */


/**
 * The page's metadata in one language. English is canonical at the bare path; a translation is canonical at its
 * own `/<lang>/perm-case-status`, and every version names all six (hreflang must be reciprocal).
 */
export async function caseStatusMetadata(lang: Lang, raw: string | undefined): Promise<Metadata> {
  const t = CASE_STATUS[lang];
  const hasCase = typeof raw === "string" && raw.trim().length > 0;
  const path = localizedPath("/perm-case-status", lang);
  return withSocialCard({
    title: t.metaTitle,
    description: t.metaDescription,
    // The bare path on every variant. A result page is one of ~412,000, and
    // they are all the same page with a different argument.
    alternates: { canonical: path, languages: pageAlternates("/perm-case-status") },
    robots: hasCase ? { index: false, follow: true } : undefined,
    openGraph: {
      ...openGraphBase,
      title: `${t.metaTitle} | PERM Tracker`,
      description: t.metaDescription,
      url: path,
    },
  }, "perm-case-status");
}

/**
 * UTC, deliberately, and shared by every elapsed figure on the page.
 *
 * Every date in this project is a UTC ISO string from DOL, and `daysElapsed`
 * parses both ends as UTC. Deriving "today" from the server's local zone
 * instead would make a filing date and the day count disagree by one for a
 * few hours each night, on a page whose whole argument is that its figures
 * are checkable.
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Is this typed text plausibly an employer NAME rather than a mistyped number?
 *
 * Two letters somewhere and not mostly digits. A half-typed case number
 * ("G-100-2612") is mostly digits and punctuation, so it stays on the
 * "wrong shape" branch where the format hint helps; "Microsoft" does not, and
 * gets offered the search that can actually answer it.
 */
function looksLikeName(input: string): boolean {
  const t = input.trim();
  if (t.length < SEARCH_TEXT_MIN || t.length > SEARCH_TEXT_MAX) return false;
  const letters = (t.match(/[A-Za-z]/g) ?? []).length;
  const digits = (t.match(/\d/g) ?? []).length;
  return letters >= 2 && letters > digits;
}

/**
 * The whole page in one language. The English route (`page.tsx`) and the translated ones
 * (`[lang]/perm-case-status/page.tsx`) render exactly this, so the two can't drift.
 */
export async function CaseStatusPage({ lang, raw }: { lang: Lang; raw: string | undefined }) {
  const t = CASE_STATUS[lang];
  const typed = typeof raw === "string" ? raw : "";
  // A USCIS receipt (EAC2190123456) is a different agency's record and has
  // its own page. Checked before anything DOL-shaped: a reader holding an
  // I-140 receipt is on the wrong page, not holding a bad number, and
  // "not the shape of a PERM case number" would be true and useless.
  const uscisReceipt = typed.trim().length > 0 ? normaliseReceipt(typed) : null;
  if (uscisReceipt) redirect(`/uscis-case-status?receipt=${encodeURIComponent(uscisReceipt)}`);
  // A prevailing wage number (P-100-...) takes its own path: same page, same
  // form, a different table and a different queue. Checked FIRST, because the
  // PERM shape rule accepts any letter and would otherwise send it to the
  // PERM lookup, which refuses to record it and reports "not found".
  const pwdNumber = typed.trim().length > 0 ? normalisePwdCaseNumber(typed) : null;
  const lcaNumber = !pwdNumber && typed.trim().length > 0 ? normaliseLcaCaseNumber(typed) : null;
  // H-2A (H-300), H-2B (H-400) and H-2B wage (P-400) numbers, before the
  // PERM shape rule claims them.
  const seasonalNumber =
    !pwdNumber && !lcaNumber && typed.trim().length > 0 ? normaliseSeasonalCaseNumber(typed) : null;
  const caseNumber =
    !pwdNumber && !lcaNumber && !seasonalNumber && typed.trim().length > 0
      ? normaliseCaseNumber(typed)
      : null;
  const malformed =
    typed.trim().length > 0 &&
    caseNumber === null &&
    pwdNumber === null &&
    lcaNumber === null &&
    seasonalNumber === null;

  // An employer name rather than a number: the search that can answer it,
  // with no stop on a "wrong shape" page first. The homepage box posts here.
  if (malformed && !looksLikeReceipt(typed) && looksLikeName(typed)) {
    redirect(caseSearchHref({ q: typed }));
  }
  const hasNumber = !!(pwdNumber || lcaNumber || seasonalNumber || caseNumber);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage" as const,
    mainEntity: t.faqs.map((f) => ({
      "@type": "Question" as const,
      name: f.q,
      acceptedAnswer: { "@type": "Answer" as const, text: f.a },
    })),
  };

  return (
    <div className={CASE_STATUS_FRAME}>
      <div className="pt-8 sm:pt-10" />
      <JsonLdScript schema={faqSchema} />

      <CaseStatusHead typed={typed} withBox={!hasNumber} lang={lang} />

      {/* A translation says what it is and where the authority is, above everything it translates. */}
      {lang !== "en" ? (
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {t.machine}{" "}
          <Link href={typed ? `/perm-case-status?case=${encodeURIComponent(typed)}` : "/perm-case-status"} className="link" hrefLang="en">
            {t.readInEnglish}
          </Link>
        </p>
      ) : null}

      {/* The warning sits ABOVE anything it qualifies and nothing is computed
          from bad input. A figure the reader has already absorbed cannot be
          un-absorbed by a note underneath it. */}
      {malformed ? (
        <p className="mt-6 flex items-start gap-2 border-l-2 border-data-warn-ink bg-data-warn/8 px-4 py-3 text-base leading-relaxed text-soft border-2">
          <WarningIcon className="mt-1 size-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>
            <b className="font-semibold text-foreground">{t.malformedLead}</b> {t.malformedBody}
          </span>
        </p>
      ) : null}
      {malformed && looksLikeReceipt(typed) ? (
        <div className="mt-4 bg-tint p-5 border-2 border-border">
          <p className="text-base leading-relaxed">
            <b className="font-semibold">{t.receiptLead}</b> {t.receiptBody}
          </p>{" "}
          <p className="mt-3">
            <Link href="/uscis-case-status" className={buttonVariants({ variant: "outline" })}>
              {t.receiptButton}
            </Link>
          </p>
        </div>
      ) : null}
      <div className="mt-8">
        {pwdNumber ? (
          <Suspense key={pwdNumber} fallback={<LookupSkeleton />}>
            <PwdLookup caseNumber={pwdNumber} />
          </Suspense>
        ) : seasonalNumber ? (
          <Suspense key={seasonalNumber} fallback={<LookupSkeleton />}>
            <SeasonalLookup caseNumber={seasonalNumber} />
          </Suspense>
        ) : lcaNumber ? (
          <Suspense key={lcaNumber} fallback={<LookupSkeleton />}>
            <LcaLookup caseNumber={lcaNumber} />
          </Suspense>
        ) : caseNumber ? (
          <Suspense key={caseNumber} fallback={<LookupSkeleton />}>
            <Lookup caseNumber={caseNumber} />
          </Suspense>
        ) : (
          <Suspense fallback={<LookupSkeleton />}>
            <Empty lang={lang} />
          </Suspense>
        )}
      </div>

      {hasNumber ? <CheckAnother typed={typed} lang={lang} /> : null}

      <section className="mt-12 border-t border-border pt-8 sm:mt-16">
        <h2 className="font-heading text-2xl font-bold">{t.faqTitle}</h2>{" "}
        <FaqList items={t.faqs} />
      </section>

      <DataProvenance datasets={["perm-case-status", "perm-cases", "processing-times"]} lang={lang} />
      <MoreText gist={t.provenanceGist} className="mt-2">
        <p className="text-sm text-muted-foreground">
          {t.provenanceBody}{" "}
          <a href="https://flag.dol.gov" rel="noopener noreferrer" className="link">
            {t.checkYourself}
          </a>
          .
        </p>
      </MoreText>

      <ToolPageFooter
        currentHref="/perm-case-status"
        reading={[
          { href: "/tools/perm-timeline-calculator", ...t.readingWait },
          { href: "/perm-queue", ...t.readingQueue },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * The reads, arranged so the slow ones overlap.
 *
 * `lookupCase` runs its own joins and is the long pole, so the three reads
 * that do not depend on its result go alongside it rather than after it. The
 * month-shaped reads have to wait, because the authoritative filing month is
 * the one in DOL's record, not the one decoded from the number: those agree
 * for 89% of cases and a month boundary is exactly where the other 11% would
 * silently produce a cohort belonging to somebody else.
 *
 * Every read is defaulted rather than allowed to throw. A frontend deployed
 * ahead of its data hits precisely this window, and each section renders its
 * own absence.
 */
async function Lookup({ caseNumber }: { caseNumber: string }) {
  const today = todayUtc();

  const [result, backlog, estimator, mirrorSize, decisionPace, sweep, stragglers, rangeCoverage, rfiClock, byDay] =
    await Promise.all([
      lookupCase(caseNumber).catch(() => null),
      getLiveBacklog().catch((): CohortMonth[] => []),
      getEstimatorData().catch(() => null),
      getLiveMirrorSize().catch(() => 0),
      // Both defaulted to null rather than allowed to throw: without them the
      // decision-pace model is omitted and the month-granular models answer,
      // which is exactly the behaviour that shipped before this existed.
      getDecisionPace().catch(() => null),
      getSweepCoverage().catch(() => null),
      // Null when stale or thin; a case behind the queue then gets no date.
      getStragglerRates().catch(() => null),
      // The nightly backtest's measured range coverage, quoted under the range.
      getRangeCoverage().catch(() => null),
      // The RFI clock, for a case at RFI ISSUED.
      getRfiClock().catch(() => null),
      // The line by filing day, for the share of the case's own month ahead of it.
      getPermDayQueue(),
    ]);
  // Only an RFI case is dated from its RFI day; one point read when it is.
  const rfiEntered =
    result?.live?.status?.trim().toUpperCase() === "RFI ISSUED"
      ? await rfiEnteredOn(caseNumber).catch(() => null)
      : null;

  // Inputs to the decision-pace model, both null-safe, from the SAME helper
  // the daily scorecard records with (see caseEstimateInputs.ts): a graded
  // number must be the number a reader was shown.
  const { casesAhead, sweepAgeDays, lineAhead } = caseEstimateInputs({
    backlog,
    filingDate: result?.live?.filingDate ?? null,
    sweepFinishedOn: sweep?.finishedOn ?? null,
    today,
    byDay,
  });

  const publishedFront = estimator?.frontier?.analystQueueMonth ?? null;
  const publishedAsOf = estimator?.frontier?.asOf ?? null;

  const found = !!result && (result.live !== null || result.decided !== null);
  const parsed = parseCaseNumber(caseNumber);

  // The record's month when we have one, the decoded month otherwise. The
  // second is only ever used to give a NOT-FOUND number some context, and
  // that section labels every figure as belonging to the month rather than
  // to the case.
  const month =
    result?.live?.filingDate?.slice(0, 7) ??
    result?.decided?.receivedDate?.slice(0, 7) ??
    parsed?.filingMonth ??
    null;

  const wall = month ? buildWall(backlog, month) : null;
  const neighbours = month ? neighbourMonths(backlog, month, 2) : [];
  const cohortRow = month
    ? (backlog.find((m) => m.month === month) ?? null)
    : null;

  if (!found) {
    return (
      <CaseNotFound
        caseNumber={caseNumber}
        parsed={parsed}
        isLegacy={isLegacyCaseNumber(caseNumber)}
        cohort={cohortRow}
        wall={wall}
        neighbours={neighbours}
        publishedFront={publishedFront}
        publishedAsOf={publishedAsOf}
        mirrorSize={mirrorSize || null}
        // A lookup that threw is "our records couldn't be read", never "not found".
        dolMiss={result ? (result.dolMiss ?? null) : "records"}
      />
    );
  }

  const isDecided = result.decided !== null;
  const [monthBacklog, wage, duration, stageStats, sameDay, timeline] = await Promise.all([
    month ? getMonthBacklog(month).catch(() => null) : Promise.resolve(null),
    // Only for a decided case: a pending one has no wage in DOL's files, and
    // asking for one is a round trip that can only ever return null.
    isDecided
      ? getCaseWageContext(caseNumber).catch(() => null)
      : Promise.resolve(null),
    isDecided && month
      ? getCohortDuration(month).catch(() => null)
      : Promise.resolve(null),
    // Measured stage ages. Absent, the estimate falls back to the table in
    // queueForecast, which is exactly what shipped before this existed.
    getStageStats().catch(() => null),
    // Four bounded primary-key reads; a failure only drops the section.
    getSameDay(result.caseNumber).catch(() => null),
    // A decided case's own dates: one primary-key read joined to its wage request. A failure
    // only drops the section, like the wage ladder above.
    isDecided ? getDecidedTimeline(result.caseNumber).catch(() => null) : Promise.resolve(null),
  ]);

  return (
    <CaseStatusResult
      result={result}
      backlog={backlog}
      cohortStatuses={monthBacklog?.statuses ?? []}
      wall={wall}
      neighbours={neighbours}
      publishedFront={publishedFront}
      publishedAsOf={publishedAsOf}
      wage={wage}
      duration={duration}
      estimator={estimator}
      casesAhead={casesAhead}
      lineAhead={lineAhead}
      decisionPace={decisionPace?.pace ?? null}
      stragglers={stragglers}
      rangeCoverage={rangeCoverage}
      rfi={{ enteredOn: rfiEntered, clock: rfiClock }}
      sweepAgeDays={sweepAgeDays}
      measuredStageAges={ageByStatusFrom(stageStats)}
      stageExit={exitMixFor(stageStats, result.live?.status ?? "")}
      stageDuration={stageDurationFor(stageStats, result.live?.status ?? "")}
      sameDay={sameDay}
      timeline={timeline}
      today={today}
    />
  );
}

/** The page with nothing typed in: still the national picture, not a blank. */
async function Empty({ lang }: { lang: Lang }) {
  const [backlog, estimator, mirrorSize] = await Promise.all([
    getLiveBacklog().catch((): CohortMonth[] => []),
    getEstimatorData().catch(() => null),
    getLiveMirrorSize().catch(() => 0),
  ]);
  const front = findFront(backlog);
  return (
    <CaseStatusEmpty
      front={front?.month ?? null}
      wallTotal={front?.wallTotal ?? null}
      publishedFront={estimator?.frontier?.analystQueueMonth ?? null}
      publishedAsOf={estimator?.frontier?.asOf ?? null}
      mirrorSize={mirrorSize || null}
      lang={lang}
    />
  );
}

