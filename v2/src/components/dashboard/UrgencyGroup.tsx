"use client";

import { CheckCircleIcon } from "@phosphor-icons/react";
import { useState } from "react";
import type { DeadlineItem as DeadlineItemType, UrgencyGroup as UrgencyType } from "../../../convex/lib/dashboardTypes";
import DeadlineItemCard from "./DeadlineItem";

interface UrgencyGroupProps {
  /** Group title (e.g., "Overdue", "This Week") */
  title: string;
  /** Array of deadline items to display */
  items: DeadlineItemType[];
  /** Urgency level for styling */
  urgency: UrgencyType;
  /** Maximum items to show before "+N more" (default: 5) */
  maxItems?: number;
  /** Whether this is the last column (no right border) */
  isLast?: boolean;
}

// Flat tints by urgency: one fill, no decorative gradient wash.
const URGENCY_STYLES: Record<UrgencyType, { tint: string; color: string }> = {
  overdue: { tint: "bg-destructive/10", color: "text-destructive" },
  thisWeek: { tint: "bg-data-warn/15", color: "text-data-warn-ink" },
  thisMonth: { tint: "bg-data-warn/10", color: "text-data-warn-ink" },
  later: { tint: "bg-primary/10", color: "text-primary" },
};

export default function UrgencyGroup({
  title,
  items,
  urgency,
  maxItems = 5,
  isLast = false,
}: UrgencyGroupProps) {
  const [showAllItems, setShowAllItems] = useState(false);

  const style = URGENCY_STYLES[urgency];
  const hasOverflow = items.length > maxItems;
  const displayedItems = showAllItems ? items : items.slice(0, maxItems);
  const remainingCount = items.length - maxItems;

  return (
    <div
      className={`
        p-4 md:min-h-[120px]
        ${style.tint}
        ${!isLast ? "border-r-2 border-border" : ""}
        md:border-b-0
        border-b-2 md:border-b-0 last:border-b-0
      `}
    >
      {/* Header with label + count - v1 style dashed border */}
      <div
        className={`
          flex items-center justify-between
          mb-4 pb-2
          border-b-2 border-dashed
          ${style.color}
        `}
        style={{ borderColor: "currentColor" }}
      >
        <span className="font-heading font-extrabold text-sm uppercase tracking-widest flex items-center gap-2">
          {title}
        </span>{" "}
        <span className="font-mono font-extrabold text-xl">{items.length}</span>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        // A compact row on a phone (an empty group needn't take a screen),
        // a centred mark from md up where the four groups sit side by side.
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground md:flex-col md:justify-center md:py-6">
          <CheckCircleIcon className="size-5 md:size-8" aria-hidden="true" />
          No deadlines
        </div>
      ) : (
        <div className="space-y-2">
          {displayedItems.map((item, index) => (
            <DeadlineItemCard
              key={`${item.caseId}-${item.type}`}
              deadline={item}
              index={index}
            />
          ))}

          {/* +N more / Show less buttons */}
          {hasOverflow && (
            <button
              type="button"
              onClick={() => setShowAllItems(!showAllItems)}
              className="w-full py-2 text-sm font-semibold text-foreground/70 hover:text-foreground transition-colors duration-200"
            >
              {showAllItems ? "Show less" : `+${remainingCount} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
