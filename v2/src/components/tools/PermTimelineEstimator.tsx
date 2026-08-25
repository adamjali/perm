"use client";

/**
 * PERM decision-date estimator.
 *
 * Takes its data as props and computes locally. The public layout mounts no
 * ConvexProvider on purpose, so marketing pages never open a websocket or ship
 * the Convex client; the page fetches once in an RSC and this recomputes on
 * every change with no round trip.
 *
 * It renders EVERY model the data supports, each with its own basis and
 * source, and never blends them into one figure. The four public PERM
 * estimators disagree by roughly nine months on an identical filing date. A
 * single confident number would hide that disagreement rather than resolve it,
 * and would be wrong in exactly the way that loses someone's trust the month
 * their case runs past it.
 */

import { useId, useMemo, useState } from "react";
import { CalendarDot as CalendarClock, Info, Warning } from "@phosphor-icons/react";

import { estimateQueueDecision, type CohortStat, type DolFrontier } from "@/lib/perm";
import { formatMonth } from "@/lib/dolFormat";
import {
  FrontierProgressChart,
  type FrontierPoint,
} from "@/components/tools/FrontierProgressChart";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface PermTimelineEstimatorProps {
  frontier: DolFrontier | null;
  cohorts: readonly CohortStat[];
  frontierAdvance: {
    rate: number;
    fromMonth: string;
    toMonth: string;
    pointsUsed: number;
    slowest: number | null;
    fastest: number | null;
  } | null;
  disclosure: { sourceFiles: string[]; uniqueCases: number } | null;
  /**
   * Reconstructed frontier series, plotted against the chosen filing month.
   *
   * Optional because it arrives from a Convex query: a frontend deployed ahead
   * of its backend functions receives nothing for this field, and treating it
   * as guaranteed took the entire page down rather than hiding one chart.
   */
  frontierHistory?: readonly FrontierPoint[];
  /**
   * Today as `YYYY-MM-DD`, resolved on the server.
   *
   * Passed in rather than read from `new Date()` here for the same reason
   * QueueAlertForm takes `newestMonth`: the page is cached for an hour, so a
   * component that computed its own "today" would hydrate against a different
   * value than the server rendered.
   */
  today: string;
  /** Renders the compact variant used inside other pages. */
  compact?: boolean;
  className?: string;
}

/** Filing months a live PERM case could plausibly carry, newest first. */
function filingMonthOptions(today: string): { value: string; label: string }[] {
  const m = /^(\d{4})-(\d{2})/.exec(today);
  const newestYear = m ? Number(m[1]) : 2026;
  const newestMonth = m ? Number(m[2]) - 1 : 11;

  const options: { value: string; label: string }[] = [];
  for (let year = newestYear; year >= 2020; year--) {
    const start = year === newestYear ? newestMonth : 11;
    for (let mo = start; mo >= 0; mo--) {
      const value = `${year}-${String(mo + 1).padStart(2, "0")}`;
      options.push({ value, label: formatMonth(value) || value });
    }
  }
  return options;
}

const POSITION_COPY: Record<string, { tone: string; heading: string }> = {
  "awaiting-queue": {
    tone: "bg-tint-primary",
    heading: "DOL hasn’t reached your filing month yet",
  },
  "queue-reached": {
    tone: "bg-primary/20",
    heading: "DOL is working on your filing month now",
  },
  overdue: {
    tone: "bg-muted",
    heading: "DOL's queue has already passed your filing month",
  },
};

export function PermTimelineEstimator({
  frontier,
  cohorts,
  frontierAdvance,
  disclosure,
  frontierHistory = [],
  today,
  compact = false,
  className,
}: PermTimelineEstimatorProps) {
  const selectId = useId();
  const options = useMemo(() => filingMonthOptions(today), [today]);
  // Default to a month DOL is plausibly working, so the empty state shows a
  // real answer rather than an empty frame.
  const [month, setMonth] = useState<string>(() => {
    if (frontier) return frontier.analystQueueMonth;
    return options[0] ? options[0].value : "2025-01";
  });

  const estimate = useMemo(
    () =>
      estimateQueueDecision({
        filingDate: `${month}-15`,
        today,
        frontier,
        cohorts,
        frontierAdvanceRate: frontierAdvance ? frontierAdvance.rate : null,
        frontierAdvanceRange:
          frontierAdvance && frontierAdvance.slowest && frontierAdvance.fastest
            ? { slowest: frontierAdvance.slowest, fastest: frontierAdvance.fastest }
            : null,
      }),
    [month, today, frontier, cohorts, frontierAdvance],
  );

  const position = POSITION_COPY[estimate.position];

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        {/* The icon sits beside the heading only. Wrapping the copy in
            the icon flex indented it 36px against the form below, which
            reads as the inputs sticking out to the left. */}
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">
            When will DOL decide my PERM?
          </h2>
        </div>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Pick the month DOL received your ETA-9089. Every figure below comes
          from DOL&apos;s own published data, and each one says where it came
          from.
        </p>

        <div className="mt-6">
          <Label htmlFor={selectId} className="text-sm font-bold">
            Month DOL received your case
          </Label>
          <select
            id={selectId}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-2 block w-full min-w-0 min-h-[44px] border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-xs"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Where this case sits relative to DOL's published frontier. */}
      {frontier && position ? (
        <div className={cn("border-b-2 border-border p-6 sm:p-8", position.tone)}>
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
            Queue position
          </p>{" "}
          <p className="mt-2 font-heading text-xl font-black leading-tight sm:text-2xl">
            {position.heading}
          </p>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            DOL&apos;s analyst review queue is working{" "}
            <strong>{formatMonth(frontier.analystQueueMonth)}</strong>, as of{" "}
            {frontier.asOf}.
            {estimate.monthsBehindFrontier !== null && estimate.monthsBehindFrontier > 0
              ? ` Your month is ${estimate.monthsBehindFrontier} further on.`
              : ""}
          </p>
        </div>
      ) : null}

      {/* Every supported model, side by side. */}
      {estimate.models.length > 0 ? (
        <div className="divide-y-2 divide-border">
          {estimate.models.map((model) => (
            <div key={model.id} className="p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
                {model.label}
              </p>{" "}
              <p className="mt-2 font-heading text-3xl font-black leading-none sm:text-4xl">
                {formatMonth(model.estimatedDate.slice(0, 7))}
              </p>{" "}
              {/* The separator has to sit here, before the conditional. When
                  the range is absent this <p> is followed directly by the
                  basis paragraph, and the two run together. */}
              {model.earliestDate && model.latestDate ? (
                <p className="mt-2 text-base font-bold text-foreground/70">
                  Range {formatMonth(model.earliestDate.slice(0, 7))} to{" "}
                  {formatMonth(model.latestDate.slice(0, 7))}
                </p>
              ) : null}{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                {model.basis}
              </p>{" "}
              <p className="mt-2 text-sm text-foreground/60">Source: {model.source}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 sm:p-8">
          <p className="text-base leading-relaxed">
            There isn’t enough published DOL data to put a date on this filing
            month yet.
          </p>
        </div>
      )}

      {/* The models above give dates. This gives the reasoning behind them, and
          it is the one series on the page that DOL does not publish. */}
      {frontierHistory.length >= 2 ? (
        <div className="border-t-2 border-border p-6 sm:p-8">
          <h3 className="font-heading text-lg font-black">How fast the queue is moving</h3>
          <FrontierProgressChart
            history={frontierHistory}
            filingMonth={month}
            className="mt-6"
          />
        </div>
      ) : null}

      {/* Caveats. Not boilerplate: each one is generated for this case. */}
      {estimate.caveats.length > 0 ? (
        <div className="border-t-2 border-border bg-muted p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <Warning
              className="mt-0.5 h-5 w-5 shrink-0 text-foreground/70"
              aria-hidden="true"
            />
            <div>
              <h3 className="font-heading text-base font-black">What this can’t tell you</h3>
              <ul className="mt-3 space-y-2">
                {estimate.caveats.map((c) => (
                  <li key={c} className="text-base leading-relaxed text-foreground/70">
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      {!compact && disclosure ? (
        <div className="border-t-2 border-border p-6 text-sm leading-relaxed text-foreground/60 sm:px-8">
          <Info className="mr-2 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
          Cohort figures are computed from{" "}
          {disclosure.uniqueCases.toLocaleString("en-US")} decided cases in DOL&apos;s
          disclosure files ({disclosure.sourceFiles.join(", ")}).
          {frontierAdvance
            ? ` Queue movement is measured across ${frontierAdvance.pointsUsed} months of determinations, ${formatMonth(frontierAdvance.fromMonth)} to ${formatMonth(frontierAdvance.toMonth)}.`
            : ""}
        </div>
      ) : null}
    </div>
  );
}
