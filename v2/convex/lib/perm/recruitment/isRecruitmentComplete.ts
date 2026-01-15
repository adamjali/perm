/**
 * Canonical Recruitment Completion Check
 *
 * This is the SINGLE SOURCE OF TRUTH for determining if recruitment is complete.
 *
 * Per PERM regulations (20 CFR 656.17), recruitment is complete when ALL of:
 * - Job order has BOTH start AND end dates (30-day minimum)
 * - Both Sunday newspaper ads have dates
 * - Notice of filing has BOTH start AND end dates (10 business days)
 * - For professional occupations: 3+ additional recruitment methods with dates
 *
 * @module
 */

/**
 * Additional recruitment method structure
 */
interface AdditionalMethod {
  method: string;
  date: string;
  description?: string;
}

/**
 * Input for recruitment completion checks.
 * Supports both camelCase (frontend forms) and snake_case (validators) through optional fields.
 */
export interface RecruitmentCheckInput {
  // Basic recruitment - Sunday ads
  sundayAdFirstDate?: string | null;
  sundayAdSecondDate?: string | null;
  sunday_ad_first_date?: string | null;
  sunday_ad_second_date?: string | null;

  // Basic recruitment - Job order
  jobOrderStartDate?: string | null;
  jobOrderEndDate?: string | null;
  job_order_start_date?: string | null;
  job_order_end_date?: string | null;

  // Basic recruitment - Notice of filing
  noticeOfFilingStartDate?: string | null;
  noticeOfFilingEndDate?: string | null;
  notice_of_filing_start_date?: string | null;
  notice_of_filing_end_date?: string | null;

  // Professional occupation flag
  isProfessionalOccupation?: boolean;
  is_professional_occupation?: boolean;

  // Professional occupation - Additional methods (array of 3+ required)
  additionalRecruitmentMethods?: AdditionalMethod[];

  // Legacy support - Single date field for additional recruitment
  additionalRecruitmentEndDate?: string | null;
  additionalRecruitmentStartDate?: string | null;
}

/**
 * Helper to get a field value supporting both camelCase and snake_case.
 */
function getField(
  input: RecruitmentCheckInput,
  camelCase: keyof RecruitmentCheckInput,
  snakeCase: keyof RecruitmentCheckInput
): string | null | undefined {
  return (input[camelCase] as string | null | undefined) ??
         (input[snakeCase] as string | null | undefined);
}

/**
 * Helper to get boolean field supporting both camelCase and snake_case.
 */
function getBoolField(
  input: RecruitmentCheckInput,
  camelCase: keyof RecruitmentCheckInput,
  snakeCase: keyof RecruitmentCheckInput
): boolean {
  return (input[camelCase] as boolean | undefined) ??
         (input[snakeCase] as boolean | undefined) ??
         false;
}

/**
 * Check if basic (non-professional) recruitment is complete.
 *
 * Basic recruitment requires:
 * - Job order with BOTH start AND end dates
 * - Both Sunday newspaper ads with dates
 * - Notice of filing with BOTH start AND end dates
 *
 * @param input - Recruitment field values
 * @returns true if all basic recruitment requirements are met
 *
 * @example
 * const complete = isBasicRecruitmentComplete({
 *   jobOrderStartDate: '2024-01-15',
 *   jobOrderEndDate: '2024-02-14',
 *   sundayAdFirstDate: '2024-01-21',
 *   sundayAdSecondDate: '2024-01-28',
 *   noticeOfFilingStartDate: '2024-01-15',
 *   noticeOfFilingEndDate: '2024-01-29',
 * }); // true
 */
export function isBasicRecruitmentComplete(input: RecruitmentCheckInput): boolean {
  // Job order: need BOTH start AND end dates
  const jobOrderStart = getField(input, 'jobOrderStartDate', 'job_order_start_date');
  const jobOrderEnd = getField(input, 'jobOrderEndDate', 'job_order_end_date');
  const hasJobOrder = !!(jobOrderStart && jobOrderEnd);

  // Sunday ads: need BOTH first AND second dates
  const sundayFirst = getField(input, 'sundayAdFirstDate', 'sunday_ad_first_date');
  const sundaySecond = getField(input, 'sundayAdSecondDate', 'sunday_ad_second_date');
  const hasSundayAds = !!(sundayFirst && sundaySecond);

  // Notice of filing: need BOTH start AND end dates
  const noticeStart = getField(input, 'noticeOfFilingStartDate', 'notice_of_filing_start_date');
  const noticeEnd = getField(input, 'noticeOfFilingEndDate', 'notice_of_filing_end_date');
  const hasNotice = !!(noticeStart && noticeEnd);

  return hasJobOrder && hasSundayAds && hasNotice;
}

/**
 * Check if professional recruitment methods are complete.
 *
 * For professional occupations (20 CFR 656.17(e)), requires 3 additional
 * recruitment methods beyond the basic requirements.
 *
 * @param input - Recruitment field values
 * @returns true if professional requirements are met OR not required
 *
 * @example
 * const complete = isProfessionalRecruitmentComplete({
 *   isProfessionalOccupation: true,
 *   additionalRecruitmentMethods: [
 *     { method: 'Campus Placement', date: '2024-01-10' },
 *     { method: 'Job Fair', date: '2024-01-12' },
 *     { method: 'Trade Publication', date: '2024-01-15' },
 *   ],
 * }); // true
 */
export function isProfessionalRecruitmentComplete(input: RecruitmentCheckInput): boolean {
  const isProfessional = getBoolField(input, 'isProfessionalOccupation', 'is_professional_occupation');

  // Not required for non-professional occupations
  if (!isProfessional) {
    return true;
  }

  // Check array-based additional methods (3+ required)
  const methods = input.additionalRecruitmentMethods ?? [];
  const methodsWithDates = methods.filter((m) => m.method && m.date);
  const hasProfessionalMethods = methodsWithDates.length >= 3;

  // Legacy support: also accept additionalRecruitmentEndDate
  const hasLegacyAdditional = !!input.additionalRecruitmentEndDate;

  return hasProfessionalMethods || hasLegacyAdditional;
}

/**
 * Check if ALL recruitment is complete (basic + professional if applicable).
 *
 * This is the canonical recruitment completion check that should be used
 * throughout the application.
 *
 * @param input - Recruitment field values
 * @returns true if all applicable recruitment requirements are met
 *
 * @example
 * // Non-professional case
 * isRecruitmentComplete({
 *   jobOrderStartDate: '2024-01-15',
 *   jobOrderEndDate: '2024-02-14',
 *   sundayAdFirstDate: '2024-01-21',
 *   sundayAdSecondDate: '2024-01-28',
 *   noticeOfFilingStartDate: '2024-01-15',
 *   noticeOfFilingEndDate: '2024-01-29',
 *   isProfessionalOccupation: false,
 * }); // true
 *
 * @example
 * // Professional case - needs additional methods
 * isRecruitmentComplete({
 *   ...basicFields,
 *   isProfessionalOccupation: true,
 *   additionalRecruitmentMethods: [
 *     { method: 'Campus Placement', date: '2024-01-10' },
 *     { method: 'Job Fair', date: '2024-01-12' },
 *     { method: 'Trade Publication', date: '2024-01-15' },
 *   ],
 * }); // true
 */
export function isRecruitmentComplete(input: RecruitmentCheckInput): boolean {
  return isBasicRecruitmentComplete(input) && isProfessionalRecruitmentComplete(input);
}
