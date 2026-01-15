"use client";

import * as React from "react";
import { Check, Circle } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import {
  calculateRecruitmentStatus,
  getMethodLabel,
  type RecruitmentCaseData,
} from "@/lib/recruitment";

// ============================================================================
// TYPES
// ============================================================================

export interface RecruitmentChecklistProps {
  /**
   * Case data needed for checklist
   */
  data: RecruitmentCaseData & {
    sundayAdNewspaper?: string;
    jobOrderState?: string;
    employerName?: string;
  };

  /**
   * Optional className for container
   */
  className?: string;
}

interface ChecklistItem {
  id: string;
  title: string;
  subtitle: string;
  date?: string;
  complete: boolean;
  required?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "-";
  try {
    return format(parseISO(isoDate), "MMM d, yyyy");
  } catch {
    return isoDate;
  }
}

// ============================================================================
// CHECKLIST ITEM COMPONENT
// ============================================================================

interface ChecklistItemRowProps {
  item: ChecklistItem;
  index: number;
}

function ChecklistItemRow({ item, index }: ChecklistItemRowProps) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.2,
        delay: index * 0.1,
        ease: "easeOut",
      }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border-2 transition-all duration-150",
        item.complete
          ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10"
          : "border-border bg-muted/20",
        "hover:translate-x-1 hover:shadow-md cursor-default"
      )}
    >
      {/* Check/Circle Icon */}
      <div className="shrink-0 mt-0.5">
        {item.complete ? (
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
            <Check className="h-3 w-3" strokeWidth={3} />
          </div>
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/40" strokeWidth={2} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <h5
            className={cn(
              "font-medium text-sm",
              item.complete ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {item.title}
          </h5>
          {item.date && (
            <span
              className={cn(
                "text-xs shrink-0",
                item.complete
                  ? "text-blue-700 dark:text-blue-400"
                  : "text-muted-foreground"
              )}
            >
              {formatDate(item.date)}
            </span>
          )}
        </div>
        <p
          className={cn(
            "text-xs mt-0.5",
            item.complete
              ? "text-muted-foreground"
              : "text-muted-foreground/60"
          )}
        >
          {item.subtitle}
        </p>
      </div>
    </motion.li>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RecruitmentChecklist Component
 *
 * Displays a checklist of recruitment steps with completion status:
 * - 4 Mandatory steps (Notice of Filing, Job Order, First/Second Sunday Ad)
 * - 3 Additional methods for professional occupations (conditional)
 *
 * Features:
 * - Staggered slide-in animation (100ms delay per item)
 * - Check icon when completed, empty circle when incomplete
 * - Title + subtitle + date for each step
 * - Blue border/background when complete, gray when incomplete
 * - Hover: translate-x-1 + shadow effect
 *
 * @example
 * ```tsx
 * <RecruitmentChecklist
 *   data={{
 *     noticeOfFilingStartDate: "2024-01-15",
 *     noticeOfFilingEndDate: "2024-01-29",
 *     jobOrderStartDate: "2024-01-10",
 *     jobOrderEndDate: "2024-02-10",
 *     sundayAdFirstDate: "2024-01-14",
 *     sundayAdSecondDate: "2024-01-21",
 *     isProfessionalOccupation: true,
 *     additionalRecruitmentMethods: [...],
 *   }}
 * />
 * ```
 */
export function RecruitmentChecklist({
  data,
  className,
}: RecruitmentChecklistProps) {
  // Calculate status to get step completion info
  const status = React.useMemo(
    () => calculateRecruitmentStatus(data),
    [data]
  );

  // Build mandatory steps list
  const mandatoryItems: ChecklistItem[] = [
    {
      id: "notice-of-filing",
      title: "Notice of Filing",
      subtitle: status.mandatorySteps.noticeOfFiling.businessDays
        ? `${status.mandatorySteps.noticeOfFiling.businessDays} business days posting`
        : "10 business days required",
      date: status.mandatorySteps.noticeOfFiling.endDate,
      complete: status.mandatorySteps.noticeOfFiling.complete,
      required: true,
    },
    {
      id: "first-sunday-ad",
      title: "First Sunday Newspaper Ad",
      subtitle: data.sundayAdNewspaper
        ? `Published in ${data.sundayAdNewspaper}`
        : "Sunday publication required",
      date: status.mandatorySteps.sundayAdFirst.date,
      complete: status.mandatorySteps.sundayAdFirst.complete,
      required: true,
    },
    {
      id: "second-sunday-ad",
      title: "Second Sunday Newspaper Ad",
      subtitle: data.sundayAdNewspaper
        ? `Published in ${data.sundayAdNewspaper}`
        : "Sunday publication required",
      date: status.mandatorySteps.sundayAdSecond.date,
      complete: status.mandatorySteps.sundayAdSecond.complete,
      required: true,
    },
    {
      id: "job-order",
      title: "Job Order (SWA)",
      subtitle:
        status.mandatorySteps.jobOrder.durationDays !== undefined
          ? `${status.mandatorySteps.jobOrder.durationDays} days in ${data.jobOrderState || "state"}`
          : "Minimum 30 days required",
      date: status.mandatorySteps.jobOrder.endDate,
      complete: status.mandatorySteps.jobOrder.complete,
      required: true,
    },
  ];

  // Build professional occupation additional methods list
  const professionalItems: ChecklistItem[] = [];

  if (data.isProfessionalOccupation) {
    // Add existing methods
    if (status.professionalMethods.methods.length > 0) {
      status.professionalMethods.methods.forEach((method, index) => {
        professionalItems.push({
          id: `additional-${index}`,
          title: `Additional Method ${index + 1}`,
          subtitle: method.description || getMethodLabel(method.method),
          date: method.date,
          complete: true,
        });
      });
    }

    // Add placeholders for remaining required methods
    const remaining = 3 - status.professionalMethods.completedCount;
    for (let i = 0; i < remaining; i++) {
      const methodNumber = status.professionalMethods.completedCount + i + 1;
      professionalItems.push({
        id: `additional-placeholder-${i}`,
        title: `Additional Method ${methodNumber}`,
        subtitle: "Professional occupation requirement",
        complete: false,
      });
    }
  }

  const mandatoryCompleteCount = mandatoryItems.filter((i) => i.complete).length;
  const professionalCompleteCount = status.professionalMethods.completedCount;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Mandatory Steps Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-muted-foreground">
            Mandatory Steps
          </h4>
          <span className="text-xs text-muted-foreground">
            {mandatoryCompleteCount}/4 Complete
          </span>
        </div>
        <ul className="space-y-2">
          {mandatoryItems.map((item, index) => (
            <ChecklistItemRow key={item.id} item={item} index={index} />
          ))}
        </ul>
      </div>

      {/* Professional Occupation Section (conditional) */}
      {data.isProfessionalOccupation && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-muted-foreground">
              Professional Occupation Requirements
            </h4>
            <span
              className={cn(
                "text-xs",
                professionalCompleteCount >= 3
                  ? "text-green-600 font-medium"
                  : "text-orange-600"
              )}
            >
              {professionalCompleteCount}/3 Required
            </span>
          </div>
          <ul className="space-y-2">
            {professionalItems.map((item, index) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                index={mandatoryItems.length + index}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
