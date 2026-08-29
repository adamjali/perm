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

export function CaseEstimate(
  props: CaseEstimateInput & { letterInitial?: string | null },
) {
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
      {/* ANCHOR FIRST, WINDOW UNDER IT. This block used to lead with the
          range at display size and demote the central read to muted 14px,
          which answers a question nobody asks: a person checking one case
          wants a date, and a five-month span offered as THE answer reads as
          an evasion. Leading with the anchor is not a claim of precision -
          the window is still directly beneath it, at a size that cannot be
          missed, and both come from the same model. The rival's failure is
          the opposite one: a single bold date with the spread deleted. */}
      <p className="mt-4 font-heading text-3xl font-black sm:text-4xl">
        Around {fmtDate(est.estimatedDate)}
      </p>
      {est.earliestDate && est.latestDate ? (
        <p className="mt-1 text-base text-foreground/80">
          Most likely between <b>{fmtDate(est.earliestDate)}</b> and{" "}
          <b>{fmtDate(est.latestDate)}</b> ·{" "}
          {est.totalDays.toLocaleString("en-US")} days from filing
        </p>
      ) : (
        <p className="mt-1 text-base text-foreground/80">
          {est.totalDays.toLocaleString("en-US")} days from filing
        </p>
      )}

      {est.stage ? (
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/80">
          <b className="font-bold">
            Adjusted for this case&apos;s stage (p{est.stage.percentile} of its
            filing month).
          </b>{" "}
          {est.stage.note}
        </p>
      ) : null}

      {/* NAMED AND SIZED, NEVER FOLDED IN. DOL works each filing month
          alphabetically by employer, so this is a real term - and it is a
          small one, which is exactly why it is printed with its own number
          instead of disappearing into the date. A competitor applies the same
          term at -80 to +80 days and tells nobody. Stating "about a week"
          next to the letter is what stops this becoming that. */}
      {typeof props.letterDeltaDays === "number" && props.letterInitial ? (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
          <b className="font-bold">
            Employers starting with {props.letterInitial}:{" "}
            {/* A letter whose measured shift rounds to zero is the commonest
                case in the middle of the alphabet, and "+0 days" reads as a
                bug rather than as the finding it is. Say what it means. */}
            {Math.round(props.letterDeltaDays) === 0
              ? "no measurable difference."
              : `${props.letterDeltaDays > 0 ? "+" : ""}${Math.round(props.letterDeltaDays)} days.`}
          </b>{" "}
          DOL works each filing month alphabetically by employer name, and this
          case is adjusted for that. It is a small term: across our corpus the
          whole alphabet spans about four weeks, and in a sixth of filing months
          the order ran backwards. The filing month matters far more.
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
