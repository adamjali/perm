"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { CaseDetailSection, DetailField } from "./CaseDetailSection";
import { CaseStageBadge } from "@/components/status/case-stage-badge";
import { Badge } from "@/components/ui/badge";
import type { CaseStatus } from "@/lib/perm";

// ============================================================================
// TYPES
// ============================================================================

export interface BasicInfoSectionProps {
  /**
   * Case data to display
   * NOTE: Only includes fields that are editable in CaseForm.
   * Fields like employerFein, internalCaseNumber, jobTitle, socCode, socTitle
   * were removed because they have no corresponding form inputs.
   */
  data: {
    caseNumber?: string;
    employerName: string;
    beneficiaryIdentifier: string;
    positionTitle: string;
    caseStatus: CaseStatus;
    progressStatus: string;
    isProfessionalOccupation: boolean;
  };

  /**
   * Whether section is initially expanded
   */
  defaultOpen?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Progress status display labels
 */
const PROGRESS_STATUS_LABELS: Record<string, string> = {
  working: "Working",
  waiting_intake: "Waiting for Intake",
  filed: "Filed",
  approved: "Approved",
  under_review: "Under Review",
  rfi_rfe: "RFI/RFE",
};

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * BasicInfoSection Component
 *
 * Read-only display section for basic case information.
 * Shows case identification, employer info, beneficiary, position, and status.
 *
 * Features:
 * - Case number and internal reference
 * - Employer name and FEIN
 * - Beneficiary identifier (privacy-safe)
 * - Position and job title
 * - SOC code and title
 * - Case status badge (color-coded by stage)
 * - Progress status badge
 * - Professional occupation indicator
 *
 * @example
 * ```tsx
 * <BasicInfoSection
 *   data={{
 *     employerName: "Acme Corp",
 *     beneficiaryIdentifier: "JD-2024",
 *     positionTitle: "Software Engineer",
 *     caseStatus: "pwd",
 *     progressStatus: "working",
 *     isProfessionalOccupation: true,
 *   }}
 * />
 * ```
 */
export function BasicInfoSection({
  data,
  defaultOpen = true,
}: BasicInfoSectionProps) {
  return (
    <CaseDetailSection
      title="Basic Information"
      icon={<Building2 className="h-5 w-5" />}
      defaultOpen={defaultOpen}
    >
      <div className="space-y-4">
        {/* Status Badges Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Case Stage Badge */}
          <CaseStageBadge stage={data.caseStatus} bordered />

          {/* Progress Status Badge */}
          <Badge variant="secondary" className="font-medium">
            {PROGRESS_STATUS_LABELS[data.progressStatus] || data.progressStatus}
          </Badge>

          {/* Professional Occupation Badge */}
          {data.isProfessionalOccupation && (
            <Badge
              variant="outline"
              className="bg-background font-medium"
            >
              Professional
            </Badge>
          )}
        </div>

        {/* Main Info Grid - Only shows fields editable in CaseForm */}
        <dl className="grid gap-4 md:grid-cols-2">
          {/* Case Identification */}
          <DetailField
            label="Case Number"
            value={data.caseNumber}
            mono
            className="md:col-span-2"
          />

          {/* Employer Info */}
          <DetailField
            label="Employer Name"
            value={data.employerName}
            className="md:col-span-2"
          />

          {/* Foreign Worker */}
          <DetailField
            label="Foreign Worker ID"
            value={data.beneficiaryIdentifier}
          />

          {/* Position */}
          <DetailField
            label="Position Title"
            value={data.positionTitle}
          />
        </dl>
      </div>
    </CaseDetailSection>
  );
}
