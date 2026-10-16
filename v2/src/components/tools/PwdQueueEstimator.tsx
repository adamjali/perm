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

import { useCallback, useId, useMemo, useState } from "react";
import { ScalesIcon as Scale } from "@phosphor-icons/react";

import { estimatePwdQueue, type PwdBacklogMonth } from "@/lib/perm";
import { formatMonth } from "@/lib/dolFormat";
import { PwdBacklogChart } from "@/components/tools/PwdBacklogChart";
import { Label } from "@/components/ui/label";
import { CaveatBox } from "@/components/ui/note";
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

  // A month picked before the page's script has loaded stays in the box, but
  // React doesn't read a select's value back when it takes the page over, so
  // the answer kept describing the first month while the box showed another,
  // and picking that month again changed nothing (the owner, Oct 15 2026:
  // "won't let me change month", then it worked). When the box first mounts,
  // take the month it already shows.
  const adoptShownMonth = useCallback((node: HTMLSelectElement | null) => {
    const shown = node ? node.value : "";
    if (shown) setMonth((m) => (m === shown ? m : shown));
  }, []);

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
      <div className={cn("object p-6", className)}>
        <p className="text-base leading-relaxed">
          DOL&apos;s prevailing wage figures are being fetched. Until they land,{" "}
          <a
            href="https://flag.dol.gov/processingtimes"
            className="link"
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
    <div className={cn("object", className)}>
      <div className="border-b-2 border-border p-6 sm:p-8">
        {/* The icon sits beside the heading only. Wrapping the copy in
            the icon flex indented it 36px against the form below, which
            reads as the inputs sticking out to the left. */}
        <div className="flex items-center gap-3">
          <Scale className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="font-heading text-2xl font-bold leading-tight">
            How long is the prevailing wage queue?
          </h2>
        </div>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Pick the month DOL received your ETA-9141. The number of requests
          ahead of yours is DOL&apos;s own published count.
        </p>

        <div className="mt-6">
          <Label htmlFor={selectId} className="text-sm font-bold">
            Month DOL received your wage request
          </Label>
          <select
            ref={adoptShownMonth}
            id={selectId}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-2 block min-h-[44px] w-full min-w-0 border-2 border-input bg-background px-3 py-2 text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-xs"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Soft green, the colour the backlog chart gives the months ahead of
          yours (round 3, Oct 15 2026). */}
      <div className="border-b-2 border-border bg-soft-good p-6 sm:p-8">
        <p className="text-sm font-bold text-muted-foreground">
          Requests ahead of yours
        </p>{" "}
        <p className="mt-2 font-heading text-4xl font-bold leading-none sm:text-5xl">
          {estimate.requestsAhead.toLocaleString("en-US")}
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
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
          <p className="mt-3 text-sm text-muted-foreground">
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
        <h3 className="font-heading text-lg font-bold">Where the backlog sits</h3>{" "}
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
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
          <p className="text-sm font-bold text-muted-foreground">
            Estimated determination
          </p>{" "}
          <p className="mt-2 font-heading text-3xl font-bold leading-none sm:text-4xl">
            {formatMonth(estimate.estimatedMonth)}
          </p>{" "}
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            At the {Math.round(clearancePerMonth || 0).toLocaleString("en-US")}{" "}
            requests a month DOL has been clearing.
          </p>
        </div>
      ) : null}

      {/* The soft yellow box the queue page uses for its caveat (round 3,
          Oct 15 2026), the heading kept as an h3 for the outline. */}
      <div className="p-6 sm:p-8">
        <CaveatBox>
          <h3 className="font-heading text-base font-bold">What this can’t tell you</h3>{" "}
          <ul className="mt-3 space-y-2">
            {estimate.caveats.map((c) => (
              <li key={c} className="text-base leading-relaxed">
                {c}{" "}
              </li>
            ))}
          </ul>
        </CaveatBox>
      </div>
    </div>
  );
}
