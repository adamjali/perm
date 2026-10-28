"use client";

import { Fragment, useState } from "react";

import { ColumnChart } from "@/components/numbers/ColumnChart";
import type { ActivityDay } from "@/lib/activityStats";
import { formatInt } from "@/lib/format";
import { DECISION_SPANS, decisionBuckets, type DecisionBucket, type DecisionSpan } from "@/lib/pulseStats";
import { choiceVariants } from "@/components/ui/choice";
import { cn } from "@/lib/utils";
import { longDate, monthDay } from "@convex/lib/months";

/** Each outcome's fill, in the site's status colours. */
const OUTCOMES = [
  { key: "certified", label: "Certified", fill: "bg-data-good-ink" },
  { key: "denied", label: "Denied", fill: "bg-data-bad-ink" },
  { key: "withdrawn", label: "Withdrawn by the employer", fill: "bg-chart-purple" },
] as const satisfies readonly { key: keyof DecisionBucket; label: string; fill: string }[];

const SPAN_LABEL: Record<DecisionSpan, string> = { 30: "30 days", 90: "90 days", 180: "180 days" };

const name = (b: DecisionBucket) => (b.by === "day" ? (longDate(b.start) ?? b.start) : `Week of ${monthDay(b.start)}`);

/**
 * DOL's PERM decisions over 30, 90 or 180 days: a column a day for the month, a column a
 * week beyond it, each split by outcome. The reader picks the span; every span is
 * computed from the same days, so nothing is fetched.
 */
export function DecisionsOverTime({
  days,
  spans = DECISION_SPANS,
  grow = false,
  linkDays = false,
}: {
  days: readonly ActivityDay[];
  /** The spans to offer; with one, there's nothing to switch. */
  spans?: readonly DecisionSpan[];
  /** Fill the rest of a tile. */
  grow?: boolean;
  /** Link each day's column to that day's decisions. */
  linkDays?: boolean;
}) {
  const [span, setSpan] = useState<DecisionSpan>(spans[0] ?? DECISION_SPANS[0]);
  const buckets = decisionBuckets(days, span);
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (!first || !last) return null;

  return (
    <div className={cn(grow && "flex flex-1 flex-col")}>
      {spans.length > 1 ? (
        <div role="group" aria-label="How far back" className="mb-4 flex flex-wrap gap-2 self-start">
          {spans.map((s) => (
            <Fragment key={s}>
              <button type="button" aria-pressed={s === span} onClick={() => setSpan(s)} className={choiceVariants({ on: s === span })}>
                {SPAN_LABEL[s]}
              </button>{" "}
            </Fragment>
          ))}
        </div>
      ) : null}{" "}
      <ColumnChart
        label={`PERM decisions ${first.by === "day" ? "per day" : "per week"}, the last ${SPAN_LABEL[span]}`}
        unit="Decided"
        first={monthDay(first.start) ?? first.start}
        last={monthDay(last.start) ?? last.start}
        height={grow ? "min-h-44" : "h-44 sm:h-52"}
        grow={grow}
        columns={buckets.map((b) => ({
          key: b.start,
          value: b.total,
          label: name(b),
          now: b === last,
          href: linkDays && b.by === "day" ? `/perm-decision-activity?day=${b.start}#day` : undefined,
          partial: b.partial,
          tip: [`${name(b)}${b.partial ? ", so far" : ""}`, `${formatInt(b.total)} decided`, ...OUTCOMES.map((o) => `${formatInt(b[o.key])} ${o.label.split(" ")[0]!.toLowerCase()}`)].join("\n"),
          parts: OUTCOMES.map((o) => ({ value: b[o.key], fill: o.fill })),
        }))}
      />{" "}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-soft">
        {OUTCOMES.map((o) => (
          <li key={o.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-3", o.fill)} /> {o.label}{" "}
          </li>
        ))}
      </ul>
    </div>
  );
}
