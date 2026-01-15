/**
 * UpcomingDeadlineItem Component
 *
 * Individual deadline item for UpcomingDeadlinesWidget.
 * Shows employer name, deadline label, case stage badge, due date, and countdown.
 *
 * Design: Neobrutalist with stage-tag badge and lift-shadow hover effect.
 * Urgency styling: red (≤7 days), orange (8-14 days), muted (>14 days).
 *
 * @see v2/docs/DESIGN_SYSTEM.md
 */

"use client";

import type { DeadlineItem } from "../../../convex/lib/dashboardTypes";
import { cn } from "@/lib/utils";
import { NavigableCard } from "@/components/ui/navigable-card";
import { formatCountdown, safeFormatShortDate } from "@/lib/utils/date";
import { CaseStageBadge } from "@/components/status/case-stage-badge";

interface UpcomingDeadlineItemProps {
  deadline: DeadlineItem;
}

export default function UpcomingDeadlineItem({ deadline }: UpcomingDeadlineItemProps) {
  const { caseId, employerName, label, dueDate, daysUntil, caseStatus } = deadline;

  // Urgency styling (≤7 days = urgent red, ≤14 = warning orange)
  const isUrgent = daysUntil <= 7;
  const isWarning = daysUntil > 7 && daysUntil <= 14;

  // Determine testid based on urgency level
  const urgencyTestId = isUrgent ? "urgent-deadline" : isWarning ? "warning-deadline" : "deadline";

  return (
    <NavigableCard
      href={`/cases/${caseId}`}
      loadingIndicator="overlay"
      className={cn(
        "group flex items-center justify-between gap-3 px-4 py-3",
        "border-2 border-black dark:border-white/20",
        "bg-card hover:-translate-y-0.5 hover:shadow-hard-sm",
        "transition-all duration-150",
        "active:translate-y-0 active:shadow-none"
      )}
      data-testid="deadline-item"
    >
      {/* Left: Employer + deadline type */}
      <div className="flex-1 min-w-0">
        <p className="font-heading font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
          {employerName}
        </p>
        <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">
          {label}
        </p>
      </div>

      {/* Right: Badge + date + countdown */}
      <div className="flex items-center gap-3 shrink-0">
        <CaseStageBadge stage={caseStatus} bordered className="text-xs px-2 py-0.5" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {safeFormatShortDate(dueDate)}
        </span>
        <span
          className={cn(
            "text-sm font-bold mono min-w-[4rem] text-right",
            isUrgent && "text-red-600 dark:text-red-500",
            isWarning && "text-orange-600 dark:text-orange-500",
            !isUrgent && !isWarning && "text-muted-foreground"
          )}
          data-testid={urgencyTestId}
        >
          {formatCountdown(daysUntil)}
        </span>
      </div>
    </NavigableCard>
  );
}
