"use client";

import { Fragment } from "react";

import { formatMonth } from "@/lib/dolFormat";
import type { MonthQueue, VolumeAnomaly } from "@/lib/queueAhead";
import { cn } from "@/lib/utils";

/**
 * How far DOL has got through every filing month, oldest first.
 *
 * WHY A PERCENTAGE AND NOT A COUNT. Read top to bottom this is the queue
 * draining: old months at 100%, a band in the middle part-done, recent months
 * untouched. That band is the work front, and it is the one thing a person
 * waiting actually wants to locate themselves against. A chart of raw counts
 * would be a chart of how busy each month was, which is a different question
 * nobody asked here.
 *
 * The number on the right is PENDING rather than decided, because that is the
 * quantity `ahead` is summed from. A reader can add up the rows above their
 * own and get the figure in the stat card, which is the point.
 *
 * Colour encodes position relative to the reader, not magnitude - the bar
 * length already carries magnitude, and doubling up on the same variable is
 * how a chart ends up saying one thing twice and nothing else.
 */

export interface QueueMonthChartProps {
  months: readonly MonthQueue[];
  /** The reader's filing month, highlighted. Undefined renders neutral. */
  selectedMonth?: string;
  /** Months whose filing volume collapsed, marked so a cliff is not a bug. */
  anomalies?: readonly VolumeAnomaly[];
  className?: string;
}

const fmtInt = (n: number) => n.toLocaleString("en-US");

export function QueueMonthChart({
  months,
  selectedMonth,
  anomalies = [],
  className,
}: QueueMonthChartProps) {
  if (months.length === 0) {
    return (
      <p className={cn("text-base text-foreground/70", className)}>
        Per-month queue figures are not loaded right now. DOL&apos;s own queue
        position is on the{" "}
        <a
          href="/perm-processing-times"
          className="font-bold underline underline-offset-2 hover:text-primary"
        >
          processing times page
        </a>
        .
      </p>
    );
  }

  const flagged = new Set(anomalies.map((a) => a.filingMonth));

  return (
    <div className={className}>
      <ol className="space-y-1">
        {months.map((m) => {
          const isSelected = m.filingMonth === selectedMonth;
          const isAhead = selectedMonth !== undefined && m.filingMonth < selectedMonth;
          const pct = m.decidedPct ?? 0;
          const label = formatMonth(m.filingMonth) ?? m.filingMonth;
          const isFlagged = flagged.has(m.filingMonth);

          return (
            // A Fragment with an explicit space, because mapped siblings
            // arrive with nothing between them and the rows would read as
            // "June 202514,000July 2025" to anything walking the DOM.
            <Fragment key={m.filingMonth}>
              {" "}
              <li
                className="grid grid-cols-[7rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[9.5rem_1fr_5.5rem]"
                aria-label={`${label}: ${pct.toFixed(0)}% decided, ${fmtInt(m.pending)} still pending`}
              >
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    isSelected ? "font-black" : "text-foreground/70",
                  )}
                >
                  {label}
                  {isFlagged ? (
                    <span
                      // Real semantic state, not decoration: this month's
                      // filing volume collapsed and the note below says so.
                      className="border border-border bg-muted px-1 font-mono text-xs font-bold text-foreground/80"
                      title="Far fewer cases were filed in this month"
                    >
                      !
                    </span>
                  ) : null}
                </span>{" "}
                {/* The track is always full width, so a month DOL has not
                    started reads as untouched rather than as a missing row. */}
                <span className="block h-6 w-full border-2 border-border bg-muted">
                  <span
                    className={cn(
                      "block h-full",
                      isSelected
                        ? "bg-primary"
                        : isAhead
                          ? "bg-foreground/70"
                          : selectedMonth === undefined
                            ? "bg-foreground/70"
                            : "bg-foreground/20",
                    )}
                    style={{ width: `${Math.min(100, Math.max(pct, 0))}%` }}
                  />
                </span>{" "}
                <span
                  className={cn(
                    "text-right text-sm tabular-nums",
                    isSelected ? "font-black" : "text-foreground/70",
                  )}
                >
                  {fmtInt(m.pending)}
                </span>
              </li>
            </Fragment>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-foreground/70">
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 border-2 border-border bg-foreground/70" aria-hidden="true" />
          Ahead of yours
        </span>{" "}
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 border-2 border-border bg-primary" aria-hidden="true" />
          Your month
        </span>{" "}
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 border-2 border-border bg-foreground/20" aria-hidden="true" />
          Filed after yours
        </span>{" "}
        <span>Bar: share of the month DOL has decided. Number: still pending.</span>
      </div>

      {anomalies.length > 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground/70">
          {anomalies.length === 1 ? "One month is marked" : `${anomalies.length} months are marked`}{" "}
          because far fewer cases were filed in{" "}
          {anomalies.length === 1 ? "it" : "them"} than in the months either
          side:{" "}
          {anomalies.map((a, i) => (
            <Fragment key={a.filingMonth}>
              {i > 0 ? ", " : ""}
              <b className="font-bold text-foreground">
                {formatMonth(a.filingMonth) ?? a.filingMonth}
              </b>{" "}
              holds {fmtInt(a.total)} against a neighbouring average of{" "}
              {fmtInt(Math.round(a.neighbourMean))}
            </Fragment>
          ))}
          . That is what the records contain, not a gap in them.
        </p>
      ) : null}
    </div>
  );
}
