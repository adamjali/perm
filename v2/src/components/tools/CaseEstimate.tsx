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

const fmtDate = (iso: string) => formatAsOf(iso) ?? iso;

export function CaseEstimate(props: CaseEstimateInput) {
  const est = buildCaseEstimate(props);
  return est ? <CaseEstimatePanel est={est} /> : null;
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
}: {
  est: Estimate;
  /**
   * The answer card above already names the date in large type, so the
   * panel leads with the window instead of printing the same day twice.
   */
  dateShownAbove?: boolean;
}) {
  if (est.kind === "no-date") {
    return (
      <PageSection id={ESTIMATE_ANCHOR} title="No date can honestly be put on this case" lede={est.note}>
        {/* ONE SENTENCE PER MEANING. This block said "Cases at this stage
            have been pending a measured average of N days" for BOTH shapes,
            and in the overdue case N is this case's own wait, not an average
            of anything. Both numbers sit in the same range, so it read as
            true. */}
        <p className="text-sm text-muted-foreground">
          {est.age.of === "stage" ? (
            <>
              Cases at this stage have been pending a measured average of{" "}
              <b className="font-semibold text-foreground">
                {est.age.days.toLocaleString("en-US")} days
              </b>{" "}
              since filing.
            </>
          ) : (
            <>
              This case has been pending{" "}
              <b className="font-semibold text-foreground">
                {est.age.days.toLocaleString("en-US")} days
              </b>{" "}
              since it was filed.
            </>
          )}
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
            Cases that reach this stage leave it after{" "}
            <b className="font-semibold text-foreground">
              about {est.stageDuration.p50.toLocaleString("en-US")} days
            </b>
            {" "}(the median).{" "}
            <span className="text-muted-foreground">
              Measured over {est.stageDuration.eligible.toLocaleString("en-US")} cases followed from arrival: time
              at this stage, not time to a decision.
            </span>
          </p>
        ) : null}{" "}
        {est.nextStep ? (
          <p className="mt-4 border-l-4 border-primary bg-muted px-4 py-3 text-base leading-relaxed text-soft">
            What usually happens next:{" "}
            <b className="font-semibold text-foreground">
              {Math.round(est.nextStep.share * 100)}%
            </b>{" "}
            of the {est.nextStep.observed.toLocaleString("en-US")} cases we have
            watched leave this stage went to{" "}
            <b className="font-semibold text-foreground">
              {est.nextStep.to.toLowerCase()}
            </b>
            {est.nextStep.to.toUpperCase() === "ANALYST REVIEW"
              ? " - back into the ordinary queue, where DOL's published position applies again."
              : "."}{" "}
            <span className="text-muted-foreground">
              How long that takes is not something we can measure yet.
            </span>
          </p>
        ) : null}
      </PageSection>
    );
  }

  // The date first, its window under it at a size that can't be missed, and
  // everything about how it's worked out folded below. The window isn't a
  // confidence interval, so each model words it for what it is.
  return (
    <PageSection id={ESTIMATE_ANCHOR} title="When this case could be decided">
      {dateShownAbove ? null : (
        <p className="font-heading text-3xl font-bold">Around {fmtDate(est.estimatedDate)}</p>
      )}{" "}
      <p className={dateShownAbove ? "max-w-2xl text-base leading-relaxed text-soft" : "mt-1 max-w-2xl text-base leading-relaxed text-soft"}>
        {est.earliestDate && est.latestDate ? (
          <>
            {est.modelId === "decision-pace"
              ? est.rangeFrom === "measured"
                ? "Going by how far recent decisions landed from their dates, between "
                : "If DOL keeps its recent pace, between "
              : est.modelId === "queue-advance"
                ? "At the fastest and slowest the queue has moved, between "
                : est.modelId === "rfi-clock"
                  ? "Going by how RFIs have gone, between "
                : est.modelId === "stragglers"
                  ? "Half of the cases still in line behind DOL's queue are decided by the date above, and eight in ten between "
                  : "Between "}
            <b>{fmtDate(est.earliestDate)}</b> and <b>{fmtDate(est.latestDate)}</b>.{" "}
          </>
        ) : null}
        {est.totalDays.toLocaleString("en-US")} days from filing. An estimate, not a promise.
      </p>{" "}
      {est.stage ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-soft">{est.stage.note}</p>
      ) : null}{" "}
      <FinePrint summary="How this is worked out" className="mt-4">
        <p>
          {est.modelLabel}: {est.basis} Source: {est.source}
        </p>{" "}
        {est.stage ? (
          <p>Adjusted for the case&apos;s stage: the {est.stage.percentile}th percentile of its filing month.</p>
        ) : null}{" "}
        {est.caveats.map((c) => (
          <Fragment key={c}>
            {" "}
            <p>{c}</p>
          </Fragment>
        ))}{" "}
        <p>
          Every model and its spread, side by side, is on{" "}
          <Link href="/tools/perm-timeline-calculator">the processing time calculator</Link>, and how each
          is computed on <Link href="/methodology">the methodology page</Link>.
        </p>
      </FinePrint>
    </PageSection>
  );
}
