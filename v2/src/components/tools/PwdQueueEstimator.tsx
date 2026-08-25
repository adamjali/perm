"use client";

/**
 * Prevailing wage determination queue estimator.
 *
 * The headline here is a COUNT, not a forecast, and that is the point. DOL
 * publishes how many PWD requests are still pending per month of receipt, so
 * "15,193 requests are ahead of yours" is a checkable fact rather than a
 * model. The wait that count implies needs a drain rate DOL does not publish,
 * and that stays blank until it can be measured from DOL's own figures over
 * time rather than filled in with something plausible.
 */

import { useId, useMemo, useState } from "react";
import { Scale, TriangleAlert } from "lucide-react";

import { estimatePwdQueue, type PwdBacklogMonth } from "@/lib/perm";
import { formatMonth } from "@/lib/dolFormat";
import { PwdBacklogChart } from "@/components/tools/PwdBacklogChart";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface PwdQueueEstimatorProps {
  frontier: { oewsMonth: string | null; nonOewsMonth: string | null } | null;
  backlog: readonly PwdBacklogMonth[];
  asOf: string | null;
  clearancePerMonth: number | null;
  className?: string;
}

export function PwdQueueEstimator({
  frontier,
  backlog,
  asOf,
  clearancePerMonth,
  className,
}: PwdQueueEstimatorProps) {
  const selectId = useId();

  // Options come from DOL's own backlog months plus a little headroom, rather
  // than a fixed range: the backlog is the only place a request can be.
  const options = useMemo(() => {
    const months = [...backlog.map((b) => b.receiptMonth)].sort().reverse();
    return months.map((m) => ({ value: m, label: formatMonth(m) || m }));
  }, [backlog]);

  const [month, setMonth] = useState<string>(
    () => options[0]?.value || "2026-01",
  );

  const estimate = useMemo(
    () =>
      estimatePwdQueue({
        requestMonth: month,
        frontierMonth: frontier ? frontier.oewsMonth : null,
        backlog,
        asOf: asOf || "",
        clearancePerMonth,
      }),
    [month, frontier, backlog, asOf, clearancePerMonth],
  );

  if (backlog.length === 0) {
    return (
      <div className={cn("border-2 border-border bg-card p-6 shadow-hard", className)}>
        <p className="text-base leading-relaxed">
          DOL&apos;s prevailing wage figures are being fetched. Until they land,{" "}
          <a
            href="https://flag.dol.gov/processingtimes"
            className="font-bold underline underline-offset-2 hover:text-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            DOL publishes them directly
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className={cn("border-2 border-border bg-card shadow-hard", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        {/* The icon sits beside the heading only. Wrapping the copy in
            the icon flex indented it 36px against the form below, which
            reads as the inputs sticking out to the left. */}
        <div className="flex items-center gap-3">
          <Scale className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-black leading-tight">
            How long is the prevailing wage queue?
          </h2>
        </div>
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Pick the month DOL received your ETA-9141. The number of requests
          ahead of yours is DOL&apos;s own published count, not an estimate.
        </p>

        <div className="mt-6">
          <Label htmlFor={selectId} className="text-sm font-bold">
            Month DOL received your wage request
          </Label>
          <select
            id={selectId}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-2 block min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-xs"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-b-2 border-border bg-tint-primary p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
          Requests ahead of yours
        </p>{" "}
        <p className="mt-2 font-heading text-4xl font-black leading-none sm:text-5xl">
          {estimate.requestsAhead.toLocaleString("en-US")}
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Still pending from months before {formatMonth(month)}, out of{" "}
          {estimate.totalPending.toLocaleString("en-US")} pending in total.
          {estimate.requestsSameMonth > 0 ? (
            <>
              {" "}
              Another {estimate.requestsSameMonth.toLocaleString("en-US")} were
              received the same month; DOL doesn’t publish where a case sits
              within a month.
            </>
          ) : null}
        </p>
        {frontier && frontier.oewsMonth ? (
          <p className="mt-3 text-sm text-foreground/60">
            DOL is issuing determinations for requests received{" "}
            {formatMonth(frontier.oewsMonth)} where the wage comes from the OEWS
            survey
            {frontier.nonOewsMonth
              ? `, and ${formatMonth(frontier.nonOewsMonth)} where it does not`
              : ""}
            {asOf ? `, as of ${asOf}` : ""}.
          </p>
        ) : null}
      </div>

      {/* The count above says how many. This says where they sit, which is the
          part that changes what someone expects: DOL has nearly cleared
          everything before March and then it jumps by an order of magnitude. */}
      <div className="border-b-2 border-border p-6 sm:p-8">
        <h3 className="font-heading text-lg font-black">Where the backlog sits</h3>{" "}
        <p className="mt-2 text-base leading-relaxed text-foreground/70">
          Every month DOL still has prevailing wage requests pending for, and how
          many.
        </p>
        <PwdBacklogChart
          backlog={backlog}
          selectedMonth={month}
          className="mt-6"
        />
      </div>

      {estimate.estimatedMonth ? (
        <div className="border-b-2 border-border p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/60">
            Estimated determination
          </p>{" "}
          <p className="mt-2 font-heading text-3xl font-black leading-none sm:text-4xl">
            {formatMonth(estimate.estimatedMonth)}
          </p>{" "}
          <p className="mt-3 text-base leading-relaxed text-foreground/70">
            At the {Math.round(clearancePerMonth || 0).toLocaleString("en-US")}{" "}
            requests a month DOL has been clearing.
          </p>
        </div>
      ) : null}

      <div className="bg-muted p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <TriangleAlert
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
    </div>
  );
}
