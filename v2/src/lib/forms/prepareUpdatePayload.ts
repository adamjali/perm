/**
 * Convert undefined optional fields to null for clearable fields only.
 *
 * When a user clears a clearable text/date field, the form produces `undefined`.
 * For these fields (declared as `v.optional(v.union(v.string(), v.null()))` in the
 * Convex schema), we convert `undefined` → `null` so the backend receives an
 * explicit "clear this field" signal.
 *
 * For non-clearable fields (booleans, numbers, arrays, enums, IDs), `undefined`
 * means "not modified" and is stripped from the payload entirely. Sending `null`
 * for these fields would cause a Convex validation error since they only accept
 * `v.optional(v.boolean())` etc. (no `v.null()` in their union).
 */

/**
 * Fields in the cases.update mutation that accept null via `v.optional(v.union(v.string(), v.null()))`.
 * These are all clearable text/date fields.
 *
 * Keep in sync with convex/cases.ts update mutation args.
 */
export const NULLABLE_FIELDS = new Set([
  // PWD stage
  'pwdFilingDate', 'pwdDeterminationDate', 'pwdExpirationDate',
  'pwdCaseNumber', 'pwdWageLevel',
  // Recruitment stage
  'jobOrderStartDate', 'jobOrderEndDate',
  'sundayAdFirstDate', 'sundayAdSecondDate', 'sundayAdNewspaper',
  'additionalRecruitmentStartDate', 'additionalRecruitmentEndDate',
  'recruitmentNotes', 'recruitmentSummaryCustom',
  'noticeOfFilingStartDate', 'noticeOfFilingEndDate',
  // ETA-9089 stage
  'eta9089FilingDate', 'eta9089AuditDate', 'eta9089CertificationDate',
  'eta9089ExpirationDate', 'eta9089CaseNumber',
  // I-140 stage
  'i140FilingDate', 'i140ReceiptDate', 'i140ReceiptNumber',
  'i140ApprovalDate', 'i140DenialDate', 'i140Category', 'i140ServiceCenter',
  // General case fields
  'caseNumber', 'internalCaseNumber', 'employerFein',
  'jobTitle', 'socCode', 'socTitle', 'jobOrderState',
  // Job description
  'jobDescription', 'jobDescriptionPositionTitle',
]);

export function prepareUpdatePayload(
  formData: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(formData)) {
    if (value === undefined) {
      // Only convert to null for clearable text/date fields
      if (NULLABLE_FIELDS.has(key)) {
        payload[key] = null;
      }
      // Non-nullable fields: omit entirely (Convex treats absent as "no change")
    } else {
      payload[key] = value;
    }
  }
  return payload;
}
