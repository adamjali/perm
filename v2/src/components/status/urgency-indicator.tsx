"use client"

import { cn } from "@/lib/utils"
import {
  getUrgencyLevel,
  getUrgencyDotClass,
  getUrgencyLabel,
  type UrgencyLevel,
} from "@/lib/status"

interface UrgencyIndicatorProps {
  level: UrgencyLevel
  daysUntil?: number
  showDays?: boolean
  className?: string
}

export function UrgencyIndicator({
  level,
  daysUntil,
  showDays = true,
  className,
}: UrgencyIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn("w-3 h-3 rounded-full", getUrgencyDotClass(level))}
        aria-hidden="true"
      />
      <span className="sr-only">{getUrgencyLabel(level)}</span>
      {showDays && daysUntil !== undefined && (
        <span className="text-sm font-medium text-foreground">
          {daysUntil} {daysUntil === 1 ? "day" : "days"}
        </span>
      )}
    </div>
  )
}

// Re-export getUrgencyLevel for convenience (imported from @/lib/status)
export { getUrgencyLevel }
