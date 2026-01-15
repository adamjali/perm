"use client";

import * as React from "react";
import { Clock, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import {
  calculateRecruitmentStatus,
  formatFilingWindowRange,
  type RecruitmentCaseData,
  type RecruitmentStatusType,
} from "@/lib/recruitment";

// ============================================================================
// TYPES
// ============================================================================

export interface RecruitmentStatusProps {
  /**
   * Case data needed for status calculation
   */
  data: RecruitmentCaseData;

  /**
   * Optional className for container
   */
  className?: string;
}

// ============================================================================
// STATUS CONFIGURATIONS
// ============================================================================

const STATUS_CONFIG: Record<
  RecruitmentStatusType,
  {
    icon: React.ComponentType<{ className?: string }>;
    bgClass: string;
    borderClass: string;
    textClass: string;
    iconClass: string;
    label: string;
  }
> = {
  waiting: {
    icon: Clock,
    bgClass: "bg-yellow-50 dark:bg-yellow-900/20",
    borderClass: "border-yellow-500",
    textClass: "text-yellow-900 dark:text-yellow-100",
    iconClass: "text-yellow-600 dark:text-yellow-400",
    label: "WAITING",
  },
  ready: {
    icon: CheckCircle2,
    bgClass: "bg-green-50 dark:bg-green-900/20",
    borderClass: "border-green-500",
    textClass: "text-green-900 dark:text-green-100",
    iconClass: "text-green-600 dark:text-green-400",
    label: "READY TO FILE",
  },
  incomplete: {
    icon: AlertTriangle,
    bgClass: "bg-muted",
    borderClass: "border-muted-foreground/30",
    textClass: "text-muted-foreground",
    iconClass: "text-muted-foreground",
    label: "INCOMPLETE",
  },
  expired: {
    icon: XCircle,
    bgClass: "bg-red-50 dark:bg-red-900/20",
    borderClass: "border-red-500",
    textClass: "text-red-900 dark:text-red-100",
    iconClass: "text-red-600 dark:text-red-400",
    label: "EXPIRED",
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RecruitmentStatus Component
 *
 * Displays a color-coded status box indicating the current state of the
 * recruitment filing window:
 * - WAITING (yellow): Must wait until 30 days passed
 * - READY (green): In the 30-180 day filing window
 * - INCOMPLETE (gray): Missing mandatory recruitment steps
 * - EXPIRED (red): Past 180 days - must restart
 *
 * @example
 * ```tsx
 * <RecruitmentStatus
 *   data={{
 *     noticeOfFilingStartDate: "2024-01-15",
 *     noticeOfFilingEndDate: "2024-01-29",
 *     jobOrderStartDate: "2024-01-10",
 *     jobOrderEndDate: "2024-02-10",
 *     sundayAdFirstDate: "2024-01-14",
 *     sundayAdSecondDate: "2024-01-21",
 *     isProfessionalOccupation: false,
 *   }}
 * />
 * ```
 */
export function RecruitmentStatus({ data, className }: RecruitmentStatusProps) {
  // Calculate status
  const status = React.useMemo(
    () => calculateRecruitmentStatus(data),
    [data]
  );

  const config = STATUS_CONFIG[status.status];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "rounded-lg border-2 p-4",
        config.bgClass,
        config.borderClass,
        className
      )}
    >
      {/* Header Row */}
      <div className="flex items-center gap-3 mb-2">
        <Icon className={cn("h-5 w-5 shrink-0", config.iconClass)} />
        <span
          className={cn(
            "font-heading font-bold text-sm tracking-wide",
            config.textClass
          )}
        >
          {config.label}
        </span>
      </div>

      {/* Status Message */}
      <p className={cn("text-sm font-medium ml-8", config.textClass)}>
        {status.message}
      </p>

      {/* Filing Window Details (only show when applicable) */}
      {status.filingWindowOpens && status.filingWindowCloses && (
        <div className={cn("mt-3 ml-8 space-y-1", config.textClass)}>
          <p className="text-sm opacity-80">
            Filing window:{" "}
            <span className="font-medium">
              {formatFilingWindowRange(
                status.filingWindowOpens,
                status.filingWindowCloses
              )}
            </span>
          </p>

          {/* Show days remaining for waiting/ready status */}
          {status.status === "waiting" && status.daysUntilWindowOpens !== undefined && (
            <p className="text-sm opacity-80">
              {status.daysUntilWindowOpens} day
              {status.daysUntilWindowOpens !== 1 ? "s" : ""} until window opens
            </p>
          )}

          {status.status === "ready" && status.daysRemainingInWindow !== undefined && (
            <p className="text-sm font-semibold">
              {status.daysRemainingInWindow} day
              {status.daysRemainingInWindow !== 1 ? "s" : ""} remaining in filing window
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}
