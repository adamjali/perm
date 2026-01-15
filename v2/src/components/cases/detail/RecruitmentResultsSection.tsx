"use client";

import * as React from "react";
import { ClipboardList } from "lucide-react";
import { CaseDetailSection } from "./CaseDetailSection";
import { RecruitmentStatus } from "./RecruitmentStatus";
import { RecruitmentResultsText } from "./RecruitmentResultsText";
import { RecruitmentChecklist } from "./RecruitmentChecklist";
import type { RecruitmentCaseData } from "@/lib/recruitment";

// ============================================================================
// TYPES
// ============================================================================

export interface RecruitmentResultsSectionProps {
  /**
   * Case data needed for all sub-components
   */
  data: RecruitmentCaseData & {
    employerName: string;
    sundayAdNewspaper?: string;
    jobOrderState?: string;
    recruitmentApplicantsCount?: number;
    recruitmentNotes?: string;
    recruitmentSummaryCustom?: string;
    additionalRecruitmentStartDate?: string;
    additionalRecruitmentEndDate?: string;
  };

  /**
   * Callback when custom results text is saved
   */
  onSaveCustomText?: (text: string | undefined) => void;

  /**
   * Whether the section is in read-only mode
   */
  readOnly?: boolean;

  /**
   * Whether section is initially expanded
   */
  defaultOpen?: boolean;

  /**
   * Optional className for container
   */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * RecruitmentResultsSection Component
 *
 * Comprehensive recruitment results section for the case detail view.
 * Combines three sub-components:
 * 1. RecruitmentStatus - Color-coded filing window status
 * 2. RecruitmentResultsText - Auto-generated DOL-compliant text with edit
 * 3. RecruitmentChecklist - Step-by-step completion checklist
 *
 * This is the MOST IMPORTANT feature ported from v1, providing attorneys
 * with the complete recruitment summary for PERM applications.
 *
 * @example
 * ```tsx
 * <RecruitmentResultsSection
 *   data={{
 *     employerName: "Acme Corp",
 *     noticeOfFilingStartDate: "2024-01-15",
 *     noticeOfFilingEndDate: "2024-01-29",
 *     jobOrderStartDate: "2024-01-10",
 *     jobOrderEndDate: "2024-02-10",
 *     jobOrderState: "CA",
 *     sundayAdFirstDate: "2024-01-14",
 *     sundayAdSecondDate: "2024-01-21",
 *     sundayAdNewspaper: "Los Angeles Times",
 *     isProfessionalOccupation: true,
 *     additionalRecruitmentMethods: [...],
 *     recruitmentApplicantsCount: 5,
 *   }}
 *   onSaveCustomText={(text) => updateCase({ recruitmentSummaryCustom: text })}
 * />
 * ```
 */
export function RecruitmentResultsSection({
  data,
  onSaveCustomText,
  readOnly = false,
  defaultOpen = true,
  className,
}: RecruitmentResultsSectionProps) {
  // Check if we have any recruitment data to display
  const hasData = !!(
    data.noticeOfFilingStartDate ||
    data.jobOrderStartDate ||
    data.sundayAdFirstDate ||
    (data.additionalRecruitmentMethods && data.additionalRecruitmentMethods.length > 0)
  );

  return (
    <CaseDetailSection
      title="Recruitment Results"
      icon={<ClipboardList className="h-5 w-5" />}
      defaultOpen={defaultOpen}
      className={className}
    >
      {hasData ? (
        <div className="space-y-6">
          {/* Status Box - Top Section */}
          <RecruitmentStatus data={data} />

          {/* Results Text - Middle Section */}
          <RecruitmentResultsText
            data={{
              employerName: data.employerName,
              noticeOfFilingStartDate: data.noticeOfFilingStartDate,
              noticeOfFilingEndDate: data.noticeOfFilingEndDate,
              jobOrderStartDate: data.jobOrderStartDate,
              jobOrderEndDate: data.jobOrderEndDate,
              jobOrderState: data.jobOrderState,
              sundayAdFirstDate: data.sundayAdFirstDate,
              sundayAdSecondDate: data.sundayAdSecondDate,
              sundayAdNewspaper: data.sundayAdNewspaper,
              additionalRecruitmentMethods: data.additionalRecruitmentMethods,
              additionalRecruitmentStartDate: data.additionalRecruitmentStartDate,
              additionalRecruitmentEndDate: data.additionalRecruitmentEndDate,
              isProfessionalOccupation: data.isProfessionalOccupation,
              recruitmentApplicantsCount: data.recruitmentApplicantsCount,
              recruitmentNotes: data.recruitmentNotes,
            }}
            customText={data.recruitmentSummaryCustom}
            onSaveCustomText={onSaveCustomText}
            readOnly={readOnly}
          />

          {/* Checklist - Bottom Section */}
          <RecruitmentChecklist
            data={{
              noticeOfFilingStartDate: data.noticeOfFilingStartDate,
              noticeOfFilingEndDate: data.noticeOfFilingEndDate,
              jobOrderStartDate: data.jobOrderStartDate,
              jobOrderEndDate: data.jobOrderEndDate,
              jobOrderState: data.jobOrderState,
              sundayAdFirstDate: data.sundayAdFirstDate,
              sundayAdSecondDate: data.sundayAdSecondDate,
              sundayAdNewspaper: data.sundayAdNewspaper,
              additionalRecruitmentMethods: data.additionalRecruitmentMethods,
              additionalRecruitmentEndDate: data.additionalRecruitmentEndDate,
              isProfessionalOccupation: data.isProfessionalOccupation,
              pwdExpirationDate: data.pwdExpirationDate,
              employerName: data.employerName,
            }}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">
          No recruitment information entered yet. Complete recruitment steps to see the results summary.
        </p>
      )}
    </CaseDetailSection>
  );
}
