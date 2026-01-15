/**
 * Demo Case Types
 *
 * Lightweight case type for demo/localStorage functionality.
 * Subset of the full Convex CaseData, using camelCase to match frontend conventions.
 */

import type { CaseStatus, ProgressStatus } from "@/lib/perm";
import type { AdditionalRecruitmentMethod } from "@/lib/shared/types";

// Re-export AdditionalRecruitmentMethod from shared types (canonical source)
export type { AdditionalRecruitmentMethod };

/**
 * Demo case type - lightweight version for localStorage storage.
 * Uses camelCase to match frontend conventions.
 */
export interface DemoCase {
  // Identity
  id: string;
  beneficiaryName: string;
  employerName: string;

  // Status tracking
  status: CaseStatus;
  progressStatus: ProgressStatus;

  // PWD dates
  pwdFilingDate?: string;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;

  // Recruitment dates
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  jobOrderStartDate?: string;
  jobOrderEndDate?: string;
  noticeOfFilingStartDate?: string;
  noticeOfFilingEndDate?: string;
  recruitmentStartDate?: string;
  recruitmentEndDate?: string;
  isProfessionalOccupation: boolean;
  additionalRecruitmentMethods?: AdditionalRecruitmentMethod[];

  // ETA 9089 dates
  eta9089FilingDate?: string;
  eta9089CertificationDate?: string;
  eta9089ExpirationDate?: string;

  // I-140 dates
  i140FilingDate?: string;
  i140ApprovalDate?: string;

  // RFI/RFE dates (single active)
  rfiReceivedDate?: string;
  rfiDueDate?: string;
  rfiSubmittedDate?: string;
  rfeReceivedDate?: string;
  rfeDueDate?: string;
  rfeSubmittedDate?: string;

  // Metadata
  isFavorite: boolean;
  notes?: string;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * Input type for creating a new demo case.
 * Omits auto-generated fields (id, createdAt, updatedAt).
 */
export type CreateDemoCaseInput = Omit<
  DemoCase,
  "id" | "createdAt" | "updatedAt"
>;

/**
 * Input type for updating a demo case.
 * All fields are optional except the ones we want to preserve.
 */
export type UpdateDemoCaseInput = Partial<
  Omit<DemoCase, "id" | "createdAt" | "updatedAt">
>;

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Generate a unique ID for demo cases.
 * Uses timestamp + random suffix for uniqueness.
 */
export function generateDemoCaseId(): string {
  const timestamp = Date.now().toString(36);
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `demo_${timestamp}_${randomSuffix}`;
}

/**
 * Factory function to create a DemoCase with validated required fields.
 *
 * Enforces invariants:
 * - beneficiaryName must be non-empty
 * - employerName must be non-empty
 * - status must be a valid CaseStatus
 * - progressStatus must be a valid ProgressStatus
 * - Timestamps are auto-generated
 *
 * @param input - Case data without id/timestamps
 * @returns DemoCase with generated id and timestamps
 * @throws Error if required fields are missing or invalid
 */
export function createDemoCase(input: CreateDemoCaseInput): DemoCase {
  // Validate required fields
  if (!input.beneficiaryName?.trim()) {
    throw new Error("beneficiaryName is required and cannot be empty");
  }
  if (!input.employerName?.trim()) {
    throw new Error("employerName is required and cannot be empty");
  }
  if (!input.status) {
    throw new Error("status is required");
  }
  if (!input.progressStatus) {
    throw new Error("progressStatus is required");
  }

  const now = new Date().toISOString();

  return {
    id: generateDemoCaseId(),
    beneficiaryName: input.beneficiaryName.trim(),
    employerName: input.employerName.trim(),
    status: input.status,
    progressStatus: input.progressStatus,
    isProfessionalOccupation: input.isProfessionalOccupation ?? false,
    isFavorite: input.isFavorite ?? false,
    createdAt: now,
    updatedAt: now,
    // Optional fields
    pwdFilingDate: input.pwdFilingDate,
    pwdDeterminationDate: input.pwdDeterminationDate,
    pwdExpirationDate: input.pwdExpirationDate,
    sundayAdFirstDate: input.sundayAdFirstDate,
    sundayAdSecondDate: input.sundayAdSecondDate,
    jobOrderStartDate: input.jobOrderStartDate,
    jobOrderEndDate: input.jobOrderEndDate,
    noticeOfFilingStartDate: input.noticeOfFilingStartDate,
    noticeOfFilingEndDate: input.noticeOfFilingEndDate,
    recruitmentStartDate: input.recruitmentStartDate,
    recruitmentEndDate: input.recruitmentEndDate,
    additionalRecruitmentMethods: input.additionalRecruitmentMethods,
    eta9089FilingDate: input.eta9089FilingDate,
    eta9089CertificationDate: input.eta9089CertificationDate,
    eta9089ExpirationDate: input.eta9089ExpirationDate,
    i140FilingDate: input.i140FilingDate,
    i140ApprovalDate: input.i140ApprovalDate,
    rfiReceivedDate: input.rfiReceivedDate,
    rfiDueDate: input.rfiDueDate,
    rfiSubmittedDate: input.rfiSubmittedDate,
    rfeReceivedDate: input.rfeReceivedDate,
    rfeDueDate: input.rfeDueDate,
    rfeSubmittedDate: input.rfeSubmittedDate,
    notes: input.notes,
  };
}
