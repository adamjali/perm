/**
 * Field Name Mapping Utility
 *
 * Maps camelCase DB field names to snake_case validator field names.
 * Required because:
 * - Convex schema uses camelCase (JavaScript convention)
 * - Validators use snake_case (PERM regulation convention for clarity)
 *
 * @module
 */

import type { CaseData, CaseStatus, ProgressStatus } from '../types';

/**
 * RFI/RFE entry structure from the database
 */
interface RfiRfeEntry {
  id: string;
  title?: string;
  description?: string;
  notes?: string;
  receivedDate: string;
  responseDueDate: string;
  responseSubmittedDate?: string;
  createdAt: number;
}

/**
 * Additional recruitment method structure
 */
interface AdditionalRecruitmentMethod {
  method: string;
  date: string;
  description?: string;
}

/**
 * Input structure matching Convex mutation args (camelCase)
 */
export interface CamelCaseFields {
  // PWD dates
  pwdFilingDate?: string | null;
  pwdDeterminationDate?: string | null;
  pwdExpirationDate?: string | null;

  // Recruitment dates
  sundayAdFirstDate?: string | null;
  sundayAdSecondDate?: string | null;
  jobOrderStartDate?: string | null;
  jobOrderEndDate?: string | null;
  noticeOfFilingStartDate?: string | null;
  noticeOfFilingEndDate?: string | null;

  // Derived recruitment dates (from derivedCalculations)
  recruitmentStartDate?: string | null;
  recruitmentEndDate?: string | null;

  // Professional occupation
  isProfessionalOccupation?: boolean;
  additionalRecruitmentMethods?: AdditionalRecruitmentMethod[];
  additionalRecruitmentEndDate?: string | null;

  // ETA 9089 dates
  eta9089FilingDate?: string | null;
  eta9089CertificationDate?: string | null;
  eta9089ExpirationDate?: string | null;

  // I-140 dates
  i140FilingDate?: string | null;
  i140ApprovalDate?: string | null;
  i140DenialDate?: string | null;

  // RFI/RFE entries (arrays)
  rfiEntries?: RfiRfeEntry[];
  rfeEntries?: RfiRfeEntry[];

  // Status
  caseStatus?: CaseStatus | string;
  progressStatus?: ProgressStatus | string;
}

/**
 * Extract the first active (non-submitted) RFI/RFE entry from an array.
 * Validators expect single-entry format for RFI/RFE fields.
 *
 * @param entries - Array of RFI or RFE entries
 * @returns The first active entry or undefined if none found
 */
function getActiveEntry(
  entries?: RfiRfeEntry[]
): RfiRfeEntry | undefined {
  if (!entries || entries.length === 0) return undefined;

  // Find first entry without a submitted date (active)
  const active = entries.find((e) => !e.responseSubmittedDate);

  // If no active entry, return the most recent one (for validation context)
  return active ?? entries[entries.length - 1];
}

/**
 * Map camelCase mutation args to snake_case validator format.
 *
 * This is the bridge between:
 * - Convex mutations (which use camelCase per JS convention)
 * - Validators (which use snake_case for PERM regulation clarity)
 *
 * @param fields - CamelCase fields from mutation args
 * @returns CaseData in snake_case format for validators
 *
 * @example
 * const validationInput = mapToValidatorFormat({
 *   pwdFilingDate: '2024-01-15',
 *   pwdDeterminationDate: '2024-03-01',
 *   ...args,
 * });
 * const result = validateCase(validationInput);
 */
export function mapToValidatorFormat(fields: CamelCaseFields): CaseData {
  // Extract active RFI/RFE entries
  const activeRfi = getActiveEntry(fields.rfiEntries);
  const activeRfe = getActiveEntry(fields.rfeEntries);

  return {
    // PWD dates
    pwd_filing_date: fields.pwdFilingDate ?? null,
    pwd_determination_date: fields.pwdDeterminationDate ?? null,
    pwd_expiration_date: fields.pwdExpirationDate ?? null,

    // Recruitment dates
    sunday_ad_first_date: fields.sundayAdFirstDate ?? null,
    sunday_ad_second_date: fields.sundayAdSecondDate ?? null,
    job_order_start_date: fields.jobOrderStartDate ?? null,
    job_order_end_date: fields.jobOrderEndDate ?? null,
    notice_of_filing_start_date: fields.noticeOfFilingStartDate ?? null,
    notice_of_filing_end_date: fields.noticeOfFilingEndDate ?? null,

    // Derived recruitment dates
    recruitment_start_date: fields.recruitmentStartDate ?? null,
    recruitment_end_date: fields.recruitmentEndDate ?? null,

    // Professional occupation flag
    is_professional_occupation: fields.isProfessionalOccupation ?? false,

    // ETA 9089 dates
    eta9089_filing_date: fields.eta9089FilingDate ?? null,
    eta9089_certification_date: fields.eta9089CertificationDate ?? null,
    eta9089_expiration_date: fields.eta9089ExpirationDate ?? null,

    // I-140 dates
    i140_filing_date: fields.i140FilingDate ?? null,
    i140_approval_date: fields.i140ApprovalDate ?? null,

    // RFI dates (from first active entry)
    rfi_received_date: activeRfi?.receivedDate ?? null,
    rfi_due_date: activeRfi?.responseDueDate ?? null,
    rfi_submitted_date: activeRfi?.responseSubmittedDate ?? null,

    // RFE dates (from first active entry)
    rfe_received_date: activeRfe?.receivedDate ?? null,
    rfe_due_date: activeRfe?.responseDueDate ?? null,
    rfe_submitted_date: activeRfe?.responseSubmittedDate ?? null,

    // Status fields (with defaults)
    case_status: (fields.caseStatus ?? 'pwd') as CaseStatus,
    progress_status: (fields.progressStatus ?? 'working') as ProgressStatus,
  };
}
