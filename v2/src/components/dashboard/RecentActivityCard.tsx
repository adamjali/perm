"use client";

/**
 * RecentActivityCard Component
 *
 * Compact horizontal card displaying a single activity item.
 * Design: Neobrutalist with black-bordered case status badge.
 *
 * Layout (2-column):
 * - Left: Employer (bold), beneficiary (small), action (muted)
 * - Right: Case status badge (bordered), timestamp
 *
 * Requirements:
 * - v2/docs/DESIGN_SYSTEM.md
 * - perm_flow.md
 */

import { cn } from "@/lib/utils";
import { NavigableCard } from "@/components/ui/navigable-card";
import { safeFormatDistanceToNow } from "@/lib/utils/date";
import { CaseStageBadge } from "@/components/status/case-stage-badge";
import type { RecentActivityItem } from "../../../convex/lib/dashboardTypes";

interface RecentActivityCardProps {
  activity: RecentActivityItem;
}

export default function RecentActivityCard({ activity }: RecentActivityCardProps) {
  // Format timestamp to compact relative time (with safe fallback)
  const relativeTime = safeFormatDistanceToNow(activity.timestamp);

  return (
    <NavigableCard
      href={`/cases/${activity.id}`}
      loadingIndicator="overlay"
      className={cn(
        "group flex items-center justify-between gap-4",
        "bg-card border-2 border-black dark:border-white/20",
        "hover:-translate-y-0.5 hover:shadow-hard-sm",
        "transition-all duration-150",
        "px-4 py-3"
      )}
    >
      {/* Left: Case info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-heading font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
            {activity.employerName}
          </span>
          <span className="text-sm text-muted-foreground mono shrink-0">
            {activity.caseNumber || "—"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">{activity.positionTitle}</span>
          <span className="shrink-0">•</span>
          <span className="truncate">{activity.action}</span>
        </div>
      </div>

      {/* Right: Badge + timestamp */}
      <div className="flex items-center gap-3 shrink-0">
        <CaseStageBadge stage={activity.caseStatus} bordered className="text-xs" />
        <time
          dateTime={new Date(activity.timestamp).toISOString()}
          className="text-xs text-muted-foreground whitespace-nowrap"
          data-testid="activity-timestamp"
        >
          {relativeTime}
        </time>
      </div>
    </NavigableCard>
  );
}
