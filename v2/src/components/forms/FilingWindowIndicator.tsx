"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { AlertTriangle, Clock, CheckCircle, XCircle, CalendarClock } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export type WindowStatus = "not_open" | "open" | "closing_soon" | "closed" | "recruitment_incomplete";

export interface FilingWindowData {
  /** When the window opens (ISO date string) */
  opensOn?: string;
  /** When the window closes (ISO date string) */
  closesOn?: string;
  /** Days until the window opens (if not yet open) */
  daysUntilOpen?: number;
  /** Days remaining until the window closes */
  daysRemaining?: number;
  /** Whether PWD expiration is the limiting factor for close date */
  isPwdLimited?: boolean;
  /** Whether the window is currently open */
  isOpen: boolean;
  /** Whether recruitment is complete (required for ETA 9089 window) */
  isRecruitmentComplete?: boolean;
}

export interface FilingWindowIndicatorProps {
  /** Window data */
  window: FilingWindowData;
  /** Label for what this window is (e.g., "ETA 9089 Filing Window") */
  label: string;
  /** Additional className */
  className?: string;
  /** Whether to show a compact version */
  compact?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function getWindowStatus(window: FilingWindowData): WindowStatus {
  // Check for incomplete recruitment first
  if (window.isRecruitmentComplete === false) {
    return "recruitment_incomplete";
  }

  if (!window.opensOn || !window.closesOn) {
    return "not_open";
  }

  if (window.daysUntilOpen && window.daysUntilOpen > 0) {
    return "not_open";
  }

  if (window.daysRemaining !== undefined && window.daysRemaining <= 0) {
    return "closed";
  }

  if (window.daysRemaining !== undefined && window.daysRemaining <= 14) {
    return "closing_soon";
  }

  if (window.isOpen) {
    return "open";
  }

  return "not_open";
}

function getProgressPercentage(window: FilingWindowData): number {
  if (!window.opensOn || !window.closesOn) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const openDate = parseISO(window.opensOn);
  const closeDate = parseISO(window.closesOn);

  const totalDays = differenceInDays(closeDate, openDate);
  const elapsedDays = differenceInDays(today, openDate);

  if (elapsedDays < 0) return 0;
  if (elapsedDays >= totalDays) return 100;

  return Math.round((elapsedDays / totalDays) * 100);
}

function getStatusConfig(status: WindowStatus) {
  switch (status) {
    case "recruitment_incomplete":
      return {
        label: "Recruitment Incomplete",
        bgColor: "bg-slate-100 dark:bg-slate-800",
        textColor: "text-slate-500 dark:text-slate-400",
        borderColor: "border-slate-300 dark:border-slate-600",
        icon: Clock,
        progressColor: "bg-slate-400",
      };
    case "not_open":
      return {
        label: "Not Yet Open",
        bgColor: "bg-slate-100 dark:bg-slate-800",
        textColor: "text-slate-600 dark:text-slate-400",
        borderColor: "border-slate-300 dark:border-slate-600",
        icon: Clock,
        progressColor: "bg-slate-400",
      };
    case "open":
      return {
        label: "OPEN",
        bgColor: "bg-green-50 dark:bg-green-900/20",
        textColor: "text-green-700 dark:text-green-400",
        borderColor: "border-green-300 dark:border-green-700",
        icon: CheckCircle,
        progressColor: "bg-green-500",
      };
    case "closing_soon":
      return {
        label: "Closing Soon",
        bgColor: "bg-amber-50 dark:bg-amber-900/20",
        textColor: "text-amber-700 dark:text-amber-400",
        borderColor: "border-amber-300 dark:border-amber-700",
        icon: AlertTriangle,
        progressColor: "bg-amber-500",
      };
    case "closed":
      return {
        label: "CLOSED",
        bgColor: "bg-red-50 dark:bg-red-900/20",
        textColor: "text-red-700 dark:text-red-400",
        borderColor: "border-red-300 dark:border-red-700",
        icon: XCircle,
        progressColor: "bg-red-500",
      };
  }
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * FilingWindowIndicator Component
 *
 * Displays filing window status with:
 * - Visual progress bar showing position within window
 * - Window dates and days remaining
 * - Status badge with urgency coloring
 * - PWD expiration warning when applicable
 * - Pulse animation when deadline is near
 */
export function FilingWindowIndicator({
  window,
  label,
  className,
  compact = false,
}: FilingWindowIndicatorProps) {
  const status = getWindowStatus(window);
  const config = getStatusConfig(status);
  const progress = getProgressPercentage(window);
  const Icon = config.icon;

  // Check if we should pulse (closing soon, <= 7 days)
  const shouldPulse = status === "closing_soon" && (window.daysRemaining ?? 0) <= 7;

  // If recruitment is incomplete, show special message
  if (status === "recruitment_incomplete") {
    return (
      <div
        className={cn(
          "rounded-lg border-2 p-3",
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {label}: Complete all recruitment activities to see filing window
          </span>
        </div>
      </div>
    );
  }

  // If no window data, show minimal state
  if (!window.opensOn && !window.closesOn) {
    return (
      <div
        className={cn(
          "rounded-lg border-2 p-3",
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {label}: Complete prerequisites to see window
          </span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-md border-2 px-3 py-2",
          config.bgColor,
          config.borderColor,
          className
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", config.textColor)} />
            <span className={cn("text-sm font-medium", config.textColor)}>
              {config.label}
            </span>
          </div>
          {window.daysRemaining !== undefined && window.daysRemaining > 0 && (
            <span className={cn("text-sm font-bold", config.textColor)}>
              {window.daysRemaining}d left
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        "rounded-lg border-2 p-4",
        config.bgColor,
        config.borderColor,
        className
      )}
      animate={shouldPulse ? { scale: [1, 1.01, 1] } : undefined}
      transition={shouldPulse ? { repeat: Infinity, duration: 2 } : undefined}
    >
      {/* Header with status badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-5 w-5", config.textColor)} />
          <span className="font-semibold text-sm">{label}</span>
        </div>
        <span
          className={cn(
            "px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide",
            config.bgColor,
            config.textColor,
            "border",
            config.borderColor
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Progress bar */}
      {(status === "open" || status === "closing_soon") && (
        <div className="mb-3">
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", config.progressColor)}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>{progress}% elapsed</span>
            <span>{100 - progress}% remaining</span>
          </div>
        </div>
      )}

      {/* Window dates */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            Opens
          </span>
          <p className="font-medium">
            {window.opensOn ? formatDate(window.opensOn) : "—"}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            Closes
          </span>
          <p className="font-medium">
            {window.closesOn ? formatDate(window.closesOn) : "—"}
          </p>
        </div>
      </div>

      {/* Days display */}
      {status === "not_open" && window.daysUntilOpen && window.daysUntilOpen > 0 && (
        <div className="mt-3 text-center">
          <span className="text-3xl font-bold text-slate-600 dark:text-slate-300">
            {window.daysUntilOpen}
          </span>
          <span className="text-sm text-muted-foreground ml-1">days until open</span>
        </div>
      )}

      {(status === "open" || status === "closing_soon") &&
        window.daysRemaining !== undefined &&
        window.daysRemaining > 0 && (
          <div className="mt-3 text-center">
            <motion.span
              className={cn(
                "text-3xl font-bold",
                status === "closing_soon" ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
              )}
              animate={shouldPulse ? { scale: [1, 1.1, 1] } : undefined}
              transition={shouldPulse ? { repeat: Infinity, duration: 1.5 } : undefined}
            >
              {window.daysRemaining}
            </motion.span>
            <span className="text-sm text-muted-foreground ml-1">days remaining</span>
          </div>
        )}

      {status === "closed" && (
        <div className="mt-3 text-center">
          <span className="text-lg font-bold text-red-600 dark:text-red-400">
            Window has closed
          </span>
        </div>
      )}

      {/* PWD expiration warning */}
      {window.isPwdLimited && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-100 dark:bg-amber-900/30 p-2 border border-amber-300 dark:border-amber-700">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            <strong>Note:</strong> This window closes early due to PWD expiration date.
            The standard 180-day rule is limited by your PWD validity.
          </p>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default FilingWindowIndicator;
