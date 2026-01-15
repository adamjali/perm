"use client"

import { format, differenceInDays, parseISO, startOfDay } from "date-fns"
import { UrgencyIndicator, getUrgencyLevel } from "./urgency-indicator"
import { cn } from "@/lib/utils"

interface DeadlineIndicatorProps {
  /** ISO date string (YYYY-MM-DD) */
  deadline: string
  /** Optional label like "PWD Expires" */
  label?: string
  /** Show the formatted date */
  showDate?: boolean
  className?: string
}

export function DeadlineIndicator({
  deadline,
  label,
  showDate = true,
  className,
}: DeadlineIndicatorProps) {
  const deadlineDate = parseISO(deadline)
  const today = startOfDay(new Date())
  const daysUntil = differenceInDays(deadlineDate, today)
  const urgencyLevel = getUrgencyLevel(daysUntil)
  const isPast = daysUntil < 0

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
