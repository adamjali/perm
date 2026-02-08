"use client"

import { format, differenceInDays, parseISO, startOfDay } from "date-fns"
import { UrgencyIndicator, getUrgencyLevel } from "./urgency-indicator"
import { cn } from "@/lib/utils"
import { getTimezoneDisplayLabel, type TimezoneRule } from "@/lib/perm"

interface DeadlineIndicatorProps {
  /** ISO date string (YYYY-MM-DD) */
  deadline: string
  /** Optional label like "PWD Expires" */
  label?: string
  /** Show the formatted date */
  showDate?: boolean
  /**
   * Timezone rule for this deadline.
   * - "dol": Deadline at 11:59 PM ET (DOL FLAG system)
   * - "local": Deadline at 11:59 PM user's local time
   * - undefined: No timezone label shown (backwards compatible)
   */
  timezoneRule?: TimezoneRule
  className?: string
}

export function DeadlineIndicator({
  deadline,
  label,
  showDate = true,
  timezoneRule,
  className,
}: DeadlineIndicatorProps) {
  const deadlineDate = parseISO(deadline)
  const today = startOfDay(new Date())
  const daysUntil = differenceInDays(deadlineDate, today)
  const urgencyLevel = getUrgencyLevel(daysUntil)
  const isPast = daysUntil < 0

  const timezoneLabel = timezoneRule ? getTimezoneDisplayLabel(timezoneRule) : null

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <span className="text-xs font-medium text-foreground/70 dark:text-foreground/80 uppercase tracking-wide">
          {label}
        </span>
      )}
      <div className="flex items-center gap-3">
        <UrgencyIndicator
          level={isPast ? "urgent" : urgencyLevel}
          daysUntil={Math.abs(daysUntil)}
          showDays
        />
        {showDate && (
          <span className="text-sm text-foreground/70 dark:text-foreground/80">
            {format(deadlineDate, "MMM d, yyyy")}
            {timezoneLabel && (
              <span className="ml-1.5 text-xs text-foreground/50 dark:text-foreground/60">
                ({timezoneLabel})
              </span>
            )}
          </span>
        )}
      </div>
      {isPast && (
        <span className="text-xs font-semibold text-[var(--urgency-urgent)]">
          OVERDUE
        </span>
      )}
    </div>
  )
}
