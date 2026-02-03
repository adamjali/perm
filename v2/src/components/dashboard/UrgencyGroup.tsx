"use client";

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

// V1-style urgency gradient backgrounds and colors
const URGENCY_STYLES: Record<UrgencyType, { gradient: string; color: string; darkGradient: string }> = {
  overdue: {
    gradient: "bg-gradient-to-br from-red-600/15 to-red-600/5",
    darkGradient: "dark:from-red-600/25 dark:to-red-600/10",
    color: "text-red-600 dark:text-red-500",
  },
  thisWeek: {
    gradient: "bg-gradient-to-br from-orange-500/12 to-orange-500/4",
    darkGradient: "dark:from-orange-500/20 dark:to-orange-500/8",
    color: "text-orange-600 dark:text-orange-500",
  },
  thisMonth: {
    gradient: "bg-gradient-to-br from-amber-500/10 to-amber-500/3",
    darkGradient: "dark:from-amber-500/18 dark:to-amber-500/6",
    color: "text-amber-600 dark:text-amber-500",
  },
  later: {
    gradient: "bg-gradient-to-br from-emerald-600/8 to-emerald-600/2",
    darkGradient: "dark:from-emerald-600/15 dark:to-emerald-600/5",
    color: "text-emerald-600 dark:text-emerald-500",
  },
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
        p-5 min-h-[140px]
        ${style.gradient} ${style.darkGradient}
        ${!isLast ? "border-r-2 border-black dark:border-white/20" : ""}
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
        </span>
        <span className="font-mono font-extrabold text-2xl">{items.length}</span>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="py-6 text-center text-muted-foreground text-sm opacity-60">
          <svg
            className="w-8 h-8 mx-auto mb-2 opacity-30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
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
