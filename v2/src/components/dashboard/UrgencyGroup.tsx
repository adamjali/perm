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

/** One dot colour per group; nothing else in the group is coloured. */
const URGENCY_DOT: Record<UrgencyType, string> = {
  overdue: "bg-destructive",
  thisWeek: "bg-data-warn",
  thisMonth: "bg-data-warn/50",
  later: "bg-muted-foreground",
};

/** A group of deadlines (overdue, this week, this month, later) as one list. */
export default function UrgencyGroup({ title, items, urgency, maxItems = 5 }: UrgencyGroupProps) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? items : items.slice(0, maxItems);
  const hidden = items.length - maxItems;

  return (
    <section aria-label={title} className={cn("min-w-0", items.length === 0 && "max-md:hidden")}>
      <h3 className="flex items-center gap-2 border-b border-border pb-2 font-heading text-base font-bold">
        <span aria-hidden="true" className={cn("size-2.5 shrink-0", URGENCY_DOT[urgency])} />
        {title}
        <span className="font-sans font-normal text-muted-foreground">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">Nothing due</p>
      ) : (
        <div className="divide-y divide-border">
          {shown.map((item) => (
            <DeadlineItemCard key={`${item.caseId}-${item.type}`} deadline={item} />
          ))}
          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="flex min-h-11 w-full items-center text-sm font-semibold text-primary-text hover:underline"
            >
              {showAll ? "Show fewer" : `Show ${hidden} more`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
