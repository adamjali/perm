import Link from "next/link";

import { FinePrint } from "@/components/data/FinePrint";
import { buildCaseEstimate, type CaseEstimateInput } from "@/lib/caseEstimate";
import { formatAsOf } from "@/lib/dolFormat";

/**
 * The estimate block on the case-status page: when could THIS case be
 * decided, given the stage it is actually at.
 *
 * SECOND BLOCK, NEVER FIRST. The federal record renders above this, because
 * a fact about the case outranks a statistic about its cohort; the estimate
 * is labeled as an estimate in the heading, carries its model and basis
 * inline, and the alert form renders directly beneath it - the natural next
 * step after reading a window is asking to hear when the answer changes.
 *
 * The stage adjustment is the point: a case at RFI reads its cohort's p90,
 * not the median (measured over 18 matured cohorts; see lib/queueForecast).
 * Appeals get the measured age and an honest "different proceeding" instead
 * of a date.
 */

const fmtDate = (iso: string) => formatAsOf(iso) ?? iso;

export function CaseEstimate(props: CaseEstimateInput) {
  const est = buildCaseEstimate(props);
  if (!est) return null;

  if (est.kind === "no-date") {
    return (
      <section className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <p className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Estimate
        </p>{" "}
        <h2 className="mt-1 font-heading text-2xl font-black">
          No date can honestly be put on this case
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          {est.note}
        </p>{" "}
        {/* ONE SENTENCE PER MEANING. This block said "Cases at this stage
            have been pending a measured average of N days" for BOTH shapes,
            and in the overdue case N is this case's own wait, not an average
            of anything. Both numbers sit in the same range, so it read as
            true. */}
        <p className="mt-3 text-sm text-muted-foreground">
          {est.age.of === "stage" ? (
            <>
              Cases at this stage have been pending a measured average of{" "}
              <b className="font-bold text-foreground">
                {est.age.days.toLocaleString("en-US")} days
              </b>{" "}
              since filing.
            </>
          ) : (
            <>
              This case has been pending{" "}
              <b className="font-bold text-foreground">
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
            line. Measured 2026-09-10: ANALYST REVIEW is there at 68%, RFI is
            at 0.7%. */}
        {est.stageDuration ? (
          <p className="mt-3 text-base leading-relaxed text-foreground/80">
            Cases that reach this stage leave it after{" "}
            <b className="font-bold text-foreground">
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
          <p className="mt-3 border-l-4 border-primary bg-tint-primary px-4 py-3 text-base leading-relaxed text-foreground/80">
            What usually happens next:{" "}
            <b className="font-bold text-foreground">
              {Math.round(est.nextStep.share * 100)}%
            </b>{" "}
            of the {est.nextStep.observed.toLocaleString("en-US")} cases we have
            watched leave this stage went to{" "}
            <b className="font-bold text-foreground">
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
      </section>
    );
  }

  // The date first, its window under it at a size that can't be missed, and
  // everything about how it's worked out folded below. The window isn't a
  // confidence interval, so each model words it for what it is.
  return (
    <section className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
      <h2 className="font-heading text-2xl font-black">When this case could be decided</h2>{" "}
      <p className="mt-4 font-heading text-3xl font-black sm:text-4xl">
        Around {fmtDate(est.estimatedDate)}
      </p>{" "}
      <p className="mt-1 text-base text-foreground/80">
        {est.earliestDate && est.latestDate ? (
          <>
            {est.modelId === "decision-pace"
              ? "If DOL keeps its recent pace, between "
              : est.modelId === "queue-advance"
                ? "At the fastest and slowest the queue has moved, between "
                : "Between "}
            <b>{fmtDate(est.earliestDate)}</b> and <b>{fmtDate(est.latestDate)}</b>.{" "}
          </>
        ) : null}
        {est.totalDays.toLocaleString("en-US")} days from filing. An estimate, not a promise.
      </p>{" "}
      {est.stage ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/80">{est.stage.note}</p>
      ) : null}{" "}
      <FinePrint summary="How this is worked out" className="mt-4">
        <p>
          {est.modelLabel}: {est.basis} Source: {est.source}
        </p>
        {est.stage ? (
          <p>Adjusted for the case&apos;s stage: the {est.stage.percentile}th percentile of its filing month.</p>
        ) : null}
        {est.caveats.map((c) => (
          <p key={c}>{c}</p>
        ))}
        <p>
          Every model and its spread, side by side, is on{" "}
          <Link href="/tools/perm-timeline-calculator">the processing time calculator</Link>, and how each
          is computed on <Link href="/methodology">the methodology page</Link>.
        </p>
      </FinePrint>
    </section>
  );
}
