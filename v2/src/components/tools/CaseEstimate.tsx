import Link from "next/link";
import { Fragment } from "react";

import { FinePrint } from "@/components/data/FinePrint";
import { PageSection } from "@/components/data/PageSection";
import {
  buildCaseEstimate,
  type CaseEstimate as Estimate,
  type CaseEstimateInput,
} from "@/lib/caseEstimate";
import { formatAsOf } from "@/lib/dolFormat";
import { dayLabel, intLabel, percentLabel } from "@/lib/i18n/format";
import type { Lang } from "@/lib/i18n/lang";

import { ESTIMATE_PANEL } from "./CaseEstimate.messages";

/**
 * The estimate block on the case-status page: when could THIS case be
 * decided, given the stage it is actually at.
 *
 * NEVER FIRST. DOL's status leads the case page, because a fact about the
 * case outranks a statistic about its cohort. The answer panel above names
 * this estimate's date and holds the alert form (most visitors came for that
 * date); this section carries the window, the model and its basis.
 *
 * The stage adjustment is the point: a case at RFI reads its cohort's p90,
 * not the median (measured over 18 matured cohorts; see lib/queueForecast).
 * Appeals get the measured age and an honest "different proceeding" instead
 * of a date.
 */

/** A day in the page's language; English keeps DOL's own stamp format. */
const fmtDate = (iso: string, lang: Lang) => (lang === "en" ? formatAsOf(iso) : dayLabel(iso, lang)) ?? iso;
/** A count in the page's language; English as it always printed. */
const count = (n: number, lang: Lang) => (lang === "en" ? n.toLocaleString("en-US") : intLabel(n, lang));

export function CaseEstimate(props: CaseEstimateInput) {
  const est = buildCaseEstimate(props);
  return est ? <CaseEstimatePanel est={est} lang={props.lang} /> : null;
}

/** The anchor the case page's answer card links to. */
export const ESTIMATE_ANCHOR = "estimate";

/**
 * The panel itself, for a caller that already built the estimate: the case
 * page builds it once and shows its date in the answer card too, so the two
 * can never name different days.
 */
export function CaseEstimatePanel({
  est,
  dateShownAbove = false,
  lang = "en",
}: {
  est: Estimate;
  /**
   * The answer card above already names the date in large type, so the
   * panel leads with the window instead of printing the same day twice.
   */
  dateShownAbove?: boolean;
  /** The page's language. The estimate's own sentences come built in it (`buildCaseEstimate({ lang })`). */
  lang?: Lang;
}) {
  const t = ESTIMATE_PANEL[lang];
  if (est.kind === "no-date") {
    const days = (
      <b className="font-semibold text-foreground">
        {t.days(count(est.age.days, lang))}
      </b>
    );
    return (
      <PageSection id={ESTIMATE_ANCHOR} title={t.noDateTitle} lede={est.note}>
        {/* ONE SENTENCE PER MEANING. This block said "Cases at this stage
            have been pending a measured average of N days" for BOTH shapes,
            and in the overdue case N is this case's own wait, not an average
            of anything. Both numbers sit in the same range, so it read as
            true. */}
        <p className="text-sm text-muted-foreground">
          {est.age.of === "stage" ? t.stageAge(days) : t.caseAge(days)}
        </p>{" "}
        {/* THE MOST USEFUL TRUE THING WE HAVE FOR A CASE WITH NO DATE. An RFI
            is not an endpoint: of the exits we have watched, about nine in ten
            return to ANALYST REVIEW, which means the case rejoins the ordinary
            queue and the published queue position applies to it again. Nobody
            tells these readers that. Destinations only - the event log cannot
            say how long the detour lasts. */}
        {/* HOW LONG THE STAGE TAKES, once the data can answer. Absent until
            more than half the cases we watched ENTER this stage have been
            watched leaving it - before that the median has not been observed
            and any number would be extrapolation. It appears on its own, with
            no code change and no flag, the first time a stage crosses that
            line. RFI ISSUED crossed it by Oct 8 2026: of the 324 RFIs watched
            for 30 days, 276 had left on day 30, so its median reads 30. */}
        {est.stageDuration ? (
          <p className="mt-3 text-base leading-relaxed text-soft">
            {t.leave(
              <b className="font-semibold text-foreground">
                {t.aboutDays(count(est.stageDuration.p50, lang))}
              </b>,
            )}{" "}
            <span className="text-muted-foreground">
              {t.leaveMeasured(count(est.stageDuration.eligible, lang))}
            </span>
          </p>
        ) : null}{" "}
        {est.nextStep ? <NextStep step={est.nextStep} lang={lang} /> : null}
      </PageSection>
    );
  }

  // The date first, its window under it at a size that can't be missed, and
  // everything about how it's worked out folded below. The window isn't a
  // confidence interval, so each model words it for what it is.
  return (
    <PageSection id={ESTIMATE_ANCHOR} title={t.dateTitle}>
      {dateShownAbove ? null : (
        <p className="font-heading text-3xl font-bold">{t.around(fmtDate(est.estimatedDate, lang))}</p>
      )}{" "}
      <p className={dateShownAbove ? "max-w-2xl text-base leading-relaxed text-soft" : "mt-1 max-w-2xl text-base leading-relaxed text-soft"}>
        {est.earliestDate && est.latestDate
          ? t.window(est.modelId, est.rangeFrom === "measured", fmtDate(est.earliestDate, lang), fmtDate(est.latestDate, lang))
          : null}
        {t.totalDays(count(est.totalDays, lang))}
      </p>{" "}
      {est.stage ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-soft">{est.stage.note}</p>
      ) : null}{" "}
      <FinePrint summary={t.howSummary} className="mt-4">
        <p>{t.modelLine(est.modelLabel, est.basis, est.source)}</p>{" "}
        {est.stage ? <p>{t.adjusted(est.stage.percentile)}</p> : null}{" "}
        {est.caveats.map((c) => (
          <Fragment key={c}>
            {" "}
            <p>{c}</p>
          </Fragment>
        ))}{" "}
        <p>
          {t.everyModel(
            <Link href="/tools/perm-timeline-calculator">{t.calculatorLink}</Link>,
            <Link href="/methodology">{t.methodologyLink}</Link>,
          )}
        </p>
      </FinePrint>
    </PageSection>
  );
}

/** Where the cases we watched leave this stage went, as a share of the exits seen. */
function NextStep({ step, lang }: { step: { to: string; share: number; observed: number }; lang: Lang }) {
  const t = ESTIMATE_PANEL[lang];
  const analyst = step.to.toUpperCase() === "ANALYST REVIEW";
  const pct = Math.round(step.share * 100);
  return (
    <p className="mt-4 border-l-4 border-primary bg-muted px-4 py-3 text-base leading-relaxed text-soft">
      {t.nextStep(
        <b className="font-semibold text-foreground">{lang === "en" ? <>{pct}%</> : percentLabel(pct, lang, 0)}</b>,
        count(step.observed, lang),
        <b className="font-semibold text-foreground">
          {lang === "en" ? step.to.toLowerCase() : analyst ? t.analystReview : step.to.toUpperCase()}
        </b>,
        analyst,
      )}{" "}
      <span className="text-muted-foreground">{t.nextUnknown}</span>
    </p>
  );
}
