"use client";

/**
 * DOL's prevailing-wage backlog, by month of receipt.
 *
 * Answers this page's own question and no other page's: "how much is actually
 * in front of me, and where does the pile start?" The shape of the real data
 * is the point. DOL has all but cleared everything before March 2026 (11, 63,
 * 106 and 627 requests remain) and then it jumps to 14,386. A visitor reading
 * the count alone cannot see that cliff; the chart makes it the first thing
 * they notice.
 *
 * Built from HTML and CSS grid rather than SVG on purpose. A horizontal bar
 * chart needs no viewBox arithmetic, cannot overflow its own container, scales
 * to any width, and stays readable to a screen reader. SVG earns its place for
 * drawings, not for bars.
 */

import { Fragment } from "react";
import { formatMonth } from "@/lib/dolFormat";
import type { PwdBacklogMonth } from "@/lib/perm";
import { cn } from "@/lib/utils";

export interface PwdBacklogChartProps {
  backlog: readonly PwdBacklogMonth[];
  /** The visitor's own receipt month, highlighted. */
  selectedMonth: string;
  className?: string;
}

export function PwdBacklogChart({
  backlog,
  selectedMonth,
  className,
}: PwdBacklogChartProps) {
  if (backlog.length === 0) return null;

  const rows = [...backlog].sort((a, b) => a.receiptMonth.localeCompare(b.receiptMonth));
  const max = Math.max(...rows.map((r) => r.remainingRequests));
  if (max <= 0) return null;

  return (
    <figure className={cn("m-0", className)}>
      <ol className="space-y-2">
        {rows.map((row) => {
          const isSelected = row.receiptMonth === selectedMonth;
          const isAhead = row.receiptMonth < selectedMonth;
          // Percentage of the widest bar, so the cliff between March and April
          // stays visible rather than being normalised away.
          const width = (row.remainingRequests / max) * 100;

          return (
            // The separator is why this is a Fragment. Mapped <li> siblings
            // arrive with nothing between them, so the rows read as
            // "December 2025 11January 2026 63" to any extractor.
            <Fragment key={row.receiptMonth}>
              {" "}
              <li
                className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 sm:grid-cols-[9rem_1fr_5.5rem]"
              >
                <span
                  className={cn(
                    "text-sm",
                    isSelected ? "font-black" : "text-foreground/70",
                  )}
                >
                  {formatMonth(row.receiptMonth)}
                </span>{" "}

                {/* The track is always full width, so a small bar reads as small
                    rather than as a missing row. */}
                <span className="h-6 w-full border-2 border-border bg-muted">
                  <span
                    className={cn(
                      "block h-full",
                      isSelected
                        ? "bg-primary"
                        : isAhead
                          ? "bg-foreground/70"
                          : "bg-foreground/20",
                    )}
                    // A bar under ~1% is invisible at any width, and four of
                    // these months are genuinely near zero. A floor keeps the row
                    // legible without misrepresenting the value, which the number
                    // beside it states exactly.
                    style={{ width: `${Math.max(width, 1.5)}%` }}
                  />
                </span>{" "}

                <span
                  className={cn(
                    "text-right text-sm tabular-nums",
                    isSelected ? "font-black" : "text-foreground/70",
                  )}
                >
                  {row.remainingRequests.toLocaleString("en-US")}
                </span>
                </li>
            </Fragment>
          );
        })}
      </ol>

      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-foreground/70">
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
          Received after yours
        </span>
      </figcaption>
    </figure>
  );
}
