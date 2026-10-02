/**
 * TimelineHeader Component
 * Row of month labels for the timeline grid.
 *
 * Features:
 * - Month labels (Jan, Feb, etc.)
 * - Current month highlighted with subtle background
 * - Responsive sizing
 */

"use client";

import { format, isSameMonth } from "date-fns";
import { cn } from "@/lib/utils";

interface TimelineHeaderProps {
  /** Array of Date objects representing start of each month in the range */
  months: Date[];
  /** Today's date for highlighting current month */
  today: Date;
}


export function TimelineHeader({ months, today }: TimelineHeaderProps) {
  return (
    <div
      className={cn(
        "flex border-b-2 border-foreground",
        // Match sidebar header height with minimum 44px touch target
        "h-11 min-h-[44px]"
      )}
      role="row"
      aria-label="Timeline month headers"
    >
      {months.map((month, index) => {
        const isCurrentMonth = isSameMonth(month, today);
        const monthLabelFull = format(month, "MMM");
        const yearLabel = format(month, "yyyy");
        const isJanuary = month.getMonth() === 0;

        return (
          <div
            key={month.toISOString()}
            className={cn(
              "flex-1 flex flex-col items-center justify-center",
              "text-sm font-medium",
              "border-r border-foreground/20 last:border-r-0",
              // Current month highlight
              isCurrentMonth && "bg-primary/10",
              // First cell or January gets left border
              index === 0 && "border-l border-foreground/20"
            )}
            role="columnheader"
            aria-label={format(month, "MMMM yyyy")}
          >
            <span
              className={cn(
                "font-semibold",
                isCurrentMonth ? "text-primary" : "text-foreground"
              )}
            >
              {/* Three letters at every size: a month is never narrower than
                  MIN_MONTH_PX now, and one letter ("J", "J", "J") could not
                  say which month it was. */}
              {monthLabelFull}
            </span>{" "}
            {/* Show year on January or first month of range */}
            {(isJanuary || index === 0) && (
              <span className="text-sm text-muted-foreground leading-none">
                {yearLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
