import Link from "next/link";

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
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Estimate
        </p>{" "}
        <h2 className="mt-1 font-heading text-2xl font-black">
          No date can honestly be put on this case
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          {est.note}
        </p>{" "}
        <p className="mt-3 text-sm text-muted-foreground">
          Cases at this stage have been pending a measured average of{" "}
          <b className="font-bold text-foreground">
            {est.observedAgeDays.toLocaleString("en-US")} days
          </b>{" "}
          since filing.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
      <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Estimate · not a promise
      </p>{" "}
      <h2 className="mt-1 font-heading text-2xl font-black">
        When this case could be decided
      </h2>{" "}
      <p className="mt-4 font-heading text-3xl font-black sm:text-4xl">
        {est.earliestDate && est.latestDate ? (
          <>
            {fmtDate(est.earliestDate)}
            <span className="text-muted-foreground"> to </span>
            {fmtDate(est.latestDate)}
          </>
        ) : (
          <>around {fmtDate(est.estimatedDate)}</>
        )}
      </p>
      {est.earliestDate && est.latestDate ? (
        <p className="mt-1 text-sm text-muted-foreground">
          central read {fmtDate(est.estimatedDate)} ·{" "}
          {est.totalDays.toLocaleString("en-US")} days from filing
        </p>
      ) : null}

      {est.stage ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/80">
          <b className="font-bold">
            Adjusted for this case&apos;s stage (p{est.stage.percentile} of its
            filing month).
          </b>{" "}
          {est.stage.note}
        </p>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">
        {est.modelLabel}: {est.basis} Source: {est.source}
      </p>

      {est.caveats.length > 0 ? (
        <ul className="mt-3 max-w-2xl space-y-1 text-sm text-muted-foreground">
          {est.caveats.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-sm text-muted-foreground">
        Every model and its spread, side by side:{" "}
        <Link
          href="/tools/perm-timeline-calculator"
          className="font-bold underline underline-offset-2 hover:text-primary"
        >
          the timeline calculator
        </Link>{" "}
        ·{" "}
        <Link
          href="/methodology"
          className="font-bold underline underline-offset-2 hover:text-primary"
        >
          how these numbers are computed
        </Link>
      </p>
    </section>
  );
}
