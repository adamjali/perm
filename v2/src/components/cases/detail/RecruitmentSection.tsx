"use client";

import * as React from "react";
import { Megaphone, Check } from "lucide-react";
import { CaseDetailSection } from "./CaseDetailSection";
import { formatISODate } from "@/lib/utils/date";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface RecruitmentSectionProps {
  data: {
    jobOrderStartDate?: string;
    jobOrderEndDate?: string;
    jobOrderState?: string;
    sundayAdFirstDate?: string;
    sundayAdSecondDate?: string;
    sundayAdNewspaper?: string;
    noticeOfFilingStartDate?: string;
    noticeOfFilingEndDate?: string;
    additionalRecruitmentMethods?: Array<{
      method: string;
      date: string;
      description?: string;
    }>;
    recruitmentApplicantsCount?: number;
    recruitmentNotes?: string;
  };
  defaultOpen?: boolean;
  accentColor?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate duration in days between two dates
 */
function calculateDuration(startDate: string | undefined, endDate: string | undefined): string {
  if (!startDate || !endDate) return "-";
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");
  const days = differenceInDays(end, start);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RecruitmentSection Component
 *
 * Read-only display section for recruitment information.
 *
 * Features:
 * - Job order dates with duration calculation
 * - Sunday ad dates (first and second)
 * - Notice of filing dates
 * - Additional recruitment methods list
 * - Applicants count
 * - Recruitment notes
 *
 * @example
 * ```tsx
 * <RecruitmentSection
 *   data={{
 *     jobOrderStartDate: "2024-02-01",
 *     jobOrderEndDate: "2024-03-02",
 *     sundayAdFirstDate: "2024-02-04",
 *     sundayAdSecondDate: "2024-02-11",
 *     additionalRecruitmentMethods: [
 *       { method: "job_fair", date: "2024-02-15", description: "Tech Career Fair" }
 *     ],
 *     recruitmentApplicantsCount: 5,
 *   }}
 * />
 * ```
 */
export function RecruitmentSection({
  data,
  defaultOpen = true,
  accentColor,
}: RecruitmentSectionProps) {
  const hasData = !!(
    data.jobOrderStartDate ||
    data.sundayAdFirstDate ||
    data.noticeOfFilingStartDate ||
    (data.additionalRecruitmentMethods && data.additionalRecruitmentMethods.length > 0) ||
    data.recruitmentApplicantsCount ||
    data.recruitmentNotes
  );

  // Preview summary for collapsed state
  const preview = React.useMemo(() => {
    const steps: string[] = [];
    if (data.jobOrderStartDate) steps.push("Job Order");
    if (data.sundayAdFirstDate) steps.push("Ads");
    if (data.noticeOfFilingStartDate) steps.push("NOF");
    if (data.additionalRecruitmentMethods?.length) steps.push(`+${data.additionalRecruitmentMethods.length}`);
    return steps.length > 0 ? steps.join(" · ") : undefined;
  }, [data.jobOrderStartDate, data.sundayAdFirstDate, data.noticeOfFilingStartDate, data.additionalRecruitmentMethods]);

  return (
    <CaseDetailSection
      title="Recruitment"
      icon={<Megaphone className="h-5 w-5" />}
      defaultOpen={defaultOpen}
      preview={preview}
      accentColor={accentColor}
    >
      {hasData ? (
        <div className="space-y-4">
          {/* Required Steps Checklist */}
          <div className="divide-y divide-border/50">
            {/* SWA Job Order */}
            <div className="flex items-start gap-3 py-2.5 first:pt-0">
              <div className={cn(
                "w-5 h-5 border-2 flex items-center justify-center shrink-0 mt-0.5",
                data.jobOrderStartDate
                  ? "bg-[var(--stage-recruitment)] border-[var(--stage-recruitment)]"
                  : "border-muted-foreground/30"
              )}>
                {data.jobOrderStartDate && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className={cn("text-sm font-medium", !data.jobOrderStartDate && "text-muted-foreground")}>
                  SWA Job Order
                </span>
                {data.jobOrderStartDate && (
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    {formatISODate(data.jobOrderStartDate)}
                    {data.jobOrderEndDate && <> <span className="opacity-40">→</span> {formatISODate(data.jobOrderEndDate)}</>}
                    {data.jobOrderStartDate && data.jobOrderEndDate && <> · {calculateDuration(data.jobOrderStartDate, data.jobOrderEndDate)}</>}
                    {data.jobOrderState && <> · {data.jobOrderState}</>}
                  </span>
                )}
              </div>
            </div>

            {/* Sunday Ad #1 */}
            <div className="flex items-start gap-3 py-2.5">
              <div className={cn(
                "w-5 h-5 border-2 flex items-center justify-center shrink-0 mt-0.5",
                data.sundayAdFirstDate
                  ? "bg-[var(--stage-recruitment)] border-[var(--stage-recruitment)]"
                  : "border-muted-foreground/30"
              )}>
                {data.sundayAdFirstDate && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className={cn("text-sm font-medium", !data.sundayAdFirstDate && "text-muted-foreground")}>
                  Sunday Ad #1
                </span>
                {data.sundayAdFirstDate && (
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    {formatISODate(data.sundayAdFirstDate)}
                    {data.sundayAdNewspaper && <> · {data.sundayAdNewspaper}</>}
                  </span>
                )}
              </div>
            </div>

            {/* Sunday Ad #2 */}
            <div className="flex items-start gap-3 py-2.5">
              <div className={cn(
                "w-5 h-5 border-2 flex items-center justify-center shrink-0 mt-0.5",
                data.sundayAdSecondDate
                  ? "bg-[var(--stage-recruitment)] border-[var(--stage-recruitment)]"
                  : "border-muted-foreground/30"
              )}>
                {data.sundayAdSecondDate && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className={cn("text-sm font-medium", !data.sundayAdSecondDate && "text-muted-foreground")}>
                  Sunday Ad #2
                </span>
                {data.sundayAdSecondDate && (
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    {formatISODate(data.sundayAdSecondDate)}
                    {data.sundayAdNewspaper && <> · {data.sundayAdNewspaper}</>}
                  </span>
                )}
              </div>
            </div>

            {/* Notice of Filing */}
            <div className="flex items-start gap-3 py-2.5">
              <div className={cn(
                "w-5 h-5 border-2 flex items-center justify-center shrink-0 mt-0.5",
                data.noticeOfFilingStartDate
                  ? "bg-[var(--stage-recruitment)] border-[var(--stage-recruitment)]"
                  : "border-muted-foreground/30"
              )}>
                {data.noticeOfFilingStartDate && <Check className="w-3 h-3 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className={cn("text-sm font-medium", !data.noticeOfFilingStartDate && "text-muted-foreground")}>
                  Notice of Filing
                </span>
                {data.noticeOfFilingStartDate && (
                  <span className="text-xs text-muted-foreground block mt-0.5">
                    {formatISODate(data.noticeOfFilingStartDate)}
                    {data.noticeOfFilingEndDate && <> <span className="opacity-40">→</span> {formatISODate(data.noticeOfFilingEndDate)}</>}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Additional Recruitment Methods */}
          {data.additionalRecruitmentMethods && data.additionalRecruitmentMethods.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Additional Methods ({data.additionalRecruitmentMethods.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {data.additionalRecruitmentMethods.map((method, index) => (
                  <div
                    key={`${method.method}-${index}`}
                    className="border-2 border-border bg-muted/30 px-3 py-2"
                  >
                    <div className="text-sm font-medium capitalize leading-tight">
                      {method.method.replace(/_/g, " ")}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatISODate(method.date)}
                      {method.description && <> · {method.description}</>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer: Applicants + Notes */}
          {(data.recruitmentApplicantsCount !== undefined || data.recruitmentNotes) && (
            <div className="pt-3 border-t border-border/50 space-y-3">
              {data.recruitmentApplicantsCount !== undefined && (
                <div className="text-sm">
                  <span className="font-mono font-medium">{data.recruitmentApplicantsCount}</span>
                  <span className="text-muted-foreground ml-1.5">applicants</span>
                </div>
              )}
              {data.recruitmentNotes && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium block">Notes</span>
                  <div className="text-sm whitespace-pre-wrap border-2 border-border bg-muted/30 p-3">
                    {data.recruitmentNotes}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No recruitment information entered yet.
        </p>
      )}
    </CaseDetailSection>
  );
}
