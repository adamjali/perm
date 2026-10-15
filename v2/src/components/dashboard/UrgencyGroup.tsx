"use client";

import { useState } from "react";
import type { DeadlineItem as DeadlineItemType, UrgencyGroup as UrgencyType } from "@convex/lib/dashboardTypes";
import { cn } from "@/lib/utils";
import DeadlineItemCard from "./DeadlineItem";

interface UrgencyGroupProps {
  /** Group title (e.g., "Overdue", "This week") */
  title: string;
  /** Array of deadline items to display */
  items: DeadlineItemType[];
  /** Urgency level: colours the group's dot */
  urgency: UrgencyType;
  /** Maximum items to show before "Show N more" (default: 5) */
  maxItems?: number;
}

/**
 * Each group in its own colour, as the columns always were: a solid band on
 * top and a light wash of the same colour behind its deadlines, so overdue
 * reads red and later reads calm at a glance. The rows sit on white.
 */
const URGENCY_STYLE: Record<UrgencyType, { band: string; wash: string; count: string }> = {
  overdue: { band: "bg-destructive", wash: "bg-destructive/10", count: "text-destructive" },
  thisWeek: { band: "bg-data-warn", wash: "bg-data-warn/15", count: "text-data-warn-ink" },
  thisMonth: { band: "bg-data-warn/50", wash: "bg-data-warn/[0.07]", count: "text-data-warn-ink" },
  later: { band: "bg-primary", wash: "bg-tint", count: "text-primary-text" },
};

/** A group of deadlines (overdue, this week, this month, later) as one list. */
export default function UrgencyGroup({ title, items, urgency, maxItems = 5 }: UrgencyGroupProps) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, maxItems);
  const hidden = items.length - maxItems;

  return (
    <section aria-label={title} className={cn("min-w-0", URGENCY_STYLE[urgency].wash, items.length === 0 && "max-md:hidden")}>
      <div aria-hidden="true" className={cn("h-1.5", URGENCY_STYLE[urgency].band)} />
      <h3 className="flex items-baseline justify-between gap-2 px-3 pb-2 pt-3 font-heading text-base font-bold">
        {title}{" "}
        <span className={cn("font-heading text-2xl font-bold leading-none tabular-nums", URGENCY_STYLE[urgency].count)}>
          {items.length}
        </span>
      </h3>
      {items.length === 0 ? (
        <p className="px-3 pb-4 pt-1 text-sm text-muted-foreground">Nothing due</p>
      ) : (
        <div className="space-y-1.5 px-2 pb-2 [&>a]:bg-card [&>a]:px-3">
          {shown.map((item) => (
            <DeadlineItemCard key={`${item.caseId}-${item.type}`} deadline={item} />
          ))}
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="flex min-h-11 w-full items-center px-1 text-sm font-semibold text-foreground hover:underline"
            >
              {showAll ? "Show fewer" : `Show ${hidden} more`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
