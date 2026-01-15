"use client";

import * as React from "react";
import { Megaphone } from "lucide-react";
import { CaseDetailSection, DetailField } from "./CaseDetailSection";
import { formatISODate } from "@/lib/utils/date";
import { differenceInDays } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export interface RecruitmentSectionProps {
  /**
   * Recruitment data to display
   */
  data: {
    // Job Order
    jobOrderStartDate?: string;
    jobOrderEndDate?: string;
    jobOrderState?: string;

    // Sunday Ads
    sundayAdFirstDate?: string;
    sundayAdSecondDate?: string;
    sundayAdNewspaper?: string;

    // Notice of Filing
    noticeOfFilingStartDate?: string;
    noticeOfFilingEndDate?: string;

    // Additional Recruitment
    additionalRecruitmentMethods?: Array<{
      method: string;
      date: string;
      description?: string;
    }>;
    recruitmentApplicantsCount?: number;
    recruitmentNotes?: string;
  };

  /**
   * Whether section is initially expanded
   */
  defaultOpen?: boolean;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format date for display, returning "-" if empty
 */
function formatDate(isoDate: string | undefined): string {
  if (!isoDate) return "-";
  return formatISODate(isoDate);
}

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
}: RecruitmentSectionProps) {
  // Check if section has any data
  const hasData = !!(
    data.jobOrderStartDate ||
    data.sundayAdFirstDate ||
    data.noticeOfFilingStartDate ||
    (data.additionalRecruitmentMethods && data.additionalRecruitmentMethods.length > 0) ||
    data.recruitmentApplicantsCount ||
    data.recruitmentNotes
  );

  return (
    <CaseDetailSection
      title="Recruitment"
      icon={<Megaphone className="h-5 w-5" />}
      defaultOpen={defaultOpen}
    >
      {hasData ? (
        <div className="space-y-6">
          {/* Job Order */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground">Job Order</h4>
            <dl className="grid gap-4 md:grid-cols-3">
              <DetailField
                label="Start Date"
                value={formatDate(data.jobOrderStartDate)}
              />
              <DetailField
                label="End Date"
                value={formatDate(data.jobOrderEndDate)}
              />
              <DetailField
                label="Duration"
                value={calculateDuration(data.jobOrderStartDate, data.jobOrderEndDate)}
              />
              {data.jobOrderState && (
                <DetailField
                  label="State"
                  value={data.jobOrderState}
                />
              )}
            </dl>
          </div>

          {/* Sunday Ads */}
          {(data.sundayAdFirstDate || data.sundayAdSecondDate || data.sundayAdNewspaper) && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Sunday Ads</h4>
              <dl className="grid gap-4 md:grid-cols-3">
                <DetailField
                  label="First Sunday Ad"
                  value={formatDate(data.sundayAdFirstDate)}
                />
                <DetailField
                  label="Second Sunday Ad"
                  value={formatDate(data.sundayAdSecondDate)}
                />
                <DetailField
                  label="Newspaper"
                  value={data.sundayAdNewspaper}
                />
              </dl>
            </div>
          )}

          {/* Notice of Filing */}
          {(data.noticeOfFilingStartDate || data.noticeOfFilingEndDate) && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">Notice of Filing</h4>
              <dl className="grid gap-4 md:grid-cols-2">
                <DetailField
                  label="Posting Date"
                  value={formatDate(data.noticeOfFilingStartDate)}
                />
                <DetailField
                  label="Removal Date"
                  value={formatDate(data.noticeOfFilingEndDate)}
                />
              </dl>
            </div>
          )}

          {/* Additional Recruitment Methods */}
          {data.additionalRecruitmentMethods && data.additionalRecruitmentMethods.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">
                Additional Recruitment Methods
              </h4>
              <ul className="space-y-2">
                {data.additionalRecruitmentMethods.map((method, index) => (
                  <li
                    key={`${method.method}-${index}`}
                    className="rounded-lg border-2 border-border bg-muted/30 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium capitalize">
                          {method.method.replace(/_/g, " ")}
                        </p>
                        {method.description && (
                          <p className="text-sm text-muted-foreground">
                            {method.description}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(method.date)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Applicants & Notes */}
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField
              label="Number of Applicants"
              value={data.recruitmentApplicantsCount}
              mono
            />
          </dl>

          {data.recruitmentNotes && (
            <div className="space-y-1">
              <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
              <dd className="text-sm whitespace-pre-wrap rounded-lg border-2 border-border bg-muted/30 p-3">
                {data.recruitmentNotes}
              </dd>
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
