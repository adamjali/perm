/**
 * TimelineHeader Component
 * Row of month labels for the timeline grid.
 *
 * Features:
 * - Month labels (Jan, Feb, etc.)
 * - Current month highlighted with subtle background
 * - Responsive sizing
 *
 * Phase: 24 (Timeline Visualization)
 * Created: 2025-12-26
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

/**
 * Get single-letter month abbreviation for condensed display
 * Uses first letter for most months, with special handling for June/July (Jn/Jl)
 */
function getCondensedMonthLabel(month: Date): string {
  const monthIndex = month.getMonth();
  // Special handling for June (5) and July (6) to differentiate
  if (monthIndex === 5) return "Jn"; // June
  if (monthIndex === 6) return "Jl"; // July
  return format(month, "MMM").charAt(0); // First letter for others
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
        const monthLabelCondensed = getCondensedMonthLabel(month);
        const yearLabel = format(month, "yyyy");
        const yearLabelShort = format(month, "yy");
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
              {/* Condensed format on small screens, full on sm+ */}
              <span className="hidden sm:inline">{monthLabelFull}</span>
              <span className="sm:hidden">{monthLabelCondensed}</span>
            </span>
            {/* Show year on January or first month of range */}
            {(isJanuary || index === 0) && (
              <span className="text-xs text-muted-foreground leading-none">
                {/* Short year on mobile, full on sm+ */}
                <span className="hidden sm:inline">{yearLabel}</span>
                <span className="sm:hidden">{yearLabelShort}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
