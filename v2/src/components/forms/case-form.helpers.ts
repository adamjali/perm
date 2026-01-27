/**
 * CaseForm Helper Functions
 *
 * Default values and utility functions for form initialization and validation.
 */

import type { CaseFormData } from "@/lib/forms/case-form-schema";

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Default values for new case forms.
 * These provide sensible defaults for all optional fields.
 */
export const DEFAULT_FORM_DATA: Partial<CaseFormData> = {
  caseStatus: "pwd",
  progressStatus: "working",
  calendarSyncEnabled: true,
  showOnTimeline: true,
  isFavorite: false,
  isProfessionalOccupation: false,
  priorityLevel: "normal",
  notes: [],
  tags: [],
  additionalRecruitmentMethods: [],
  recruitmentApplicantsCount: 0,
  rfiEntries: [],
  rfeEntries: [],
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Merge initialData with defaults for form state
 * In add mode: Apply defaults first, then overlay any provided initialData
 * In edit mode: Use initialData directly (it should be complete)
 *
 * Note: initialData is typed loosely to accept plain strings from Convex
 * (which doesn't use branded ISODateString types).
 */
export function initializeFormData(
  mode: "add" | "edit",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialData?: Record<string, any>
): CaseFormData {
  // In add mode, merge defaults with any provided initialData (for pre-population)
  // In edit mode, use initialData directly (it should have all values from DB)
  const base = mode === "add"
    ? { ...DEFAULT_FORM_DATA, ...initialData }
    : initialData || {};

  return {
    // Required fields
    employerName: base.employerName || "",
    beneficiaryIdentifier: base.beneficiaryIdentifier || "",
    positionTitle: base.positionTitle || "",
    caseStatus: base.caseStatus || "pwd",
    progressStatus: base.progressStatus || "working",

    // Optional fields with defaults
    isProfessionalOccupation: base.isProfessionalOccupation ?? false,
    isFavorite: base.isFavorite ?? false,
    calendarSyncEnabled: base.calendarSyncEnabled ?? true,
    showOnTimeline: base.showOnTimeline ?? true,
    priorityLevel: base.priorityLevel || "normal",
    notes: base.notes || [],
    tags: base.tags || [],
    additionalRecruitmentMethods: base.additionalRecruitmentMethods || [],
    recruitmentApplicantsCount: base.recruitmentApplicantsCount ?? 0,
    rfiEntries: base.rfiEntries || [],
    rfeEntries: base.rfeEntries || [],

    // All other optional fields
    caseNumber: base.caseNumber,
    internalCaseNumber: base.internalCaseNumber,
    employerFein: base.employerFein,
    jobTitle: base.jobTitle,
    socCode: base.socCode,
    socTitle: base.socTitle,
    jobOrderState: base.jobOrderState,
    progressStatusOverride: base.progressStatusOverride,
    pwdFilingDate: base.pwdFilingDate,
    pwdDeterminationDate: base.pwdDeterminationDate,
    pwdExpirationDate: base.pwdExpirationDate,
    pwdCaseNumber: base.pwdCaseNumber,
    pwdWageAmount: base.pwdWageAmount,
    pwdWageLevel: base.pwdWageLevel,
    jobOrderStartDate: base.jobOrderStartDate,
    jobOrderEndDate: base.jobOrderEndDate,
    sundayAdFirstDate: base.sundayAdFirstDate,
    sundayAdSecondDate: base.sundayAdSecondDate,
    sundayAdNewspaper: base.sundayAdNewspaper,
    additionalRecruitmentStartDate: base.additionalRecruitmentStartDate,
    additionalRecruitmentEndDate: base.additionalRecruitmentEndDate,
    recruitmentNotes: base.recruitmentNotes,
    recruitmentSummaryCustom: base.recruitmentSummaryCustom,
    noticeOfFilingStartDate: base.noticeOfFilingStartDate,
    noticeOfFilingEndDate: base.noticeOfFilingEndDate,
    eta9089FilingDate: base.eta9089FilingDate,
    eta9089AuditDate: base.eta9089AuditDate,
    eta9089CertificationDate: base.eta9089CertificationDate,
    eta9089ExpirationDate: base.eta9089ExpirationDate,
    eta9089CaseNumber: base.eta9089CaseNumber,
    i140FilingDate: base.i140FilingDate,
    i140ReceiptDate: base.i140ReceiptDate,
    i140ReceiptNumber: base.i140ReceiptNumber,
    i140ApprovalDate: base.i140ApprovalDate,
    i140DenialDate: base.i140DenialDate,
    i140Category: base.i140Category,
    i140ServiceCenter: base.i140ServiceCenter,
    i140PremiumProcessing: base.i140PremiumProcessing,
  };
}

/**
 * Convert form errors array to field-keyed object
 */
export function errorsToFieldMap(
  errors: Array<{ field: string; message: string }>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const error of errors) {
    map[error.field] = error.message;
  }
  return map;
}

/**
 * Parse server validation error message into field-level errors.
 *
 * Server throws errors in format:
 * "Validation failed: [V-RFI-01] rfi_received_date: message; [V-RFI-03] rfi_submitted_date: message"
 *
 * This function:
 * 1. Extracts individual errors from the server message
 * 2. Converts snake_case field names to camelCase (for React form state)
 * 3. Returns an array that can be passed to errorsToFieldMap
 *
 * @param errorMessage - Server error message string
 * @returns Array of field/message pairs, or null if not a validation error
 */
export function parseServerValidationError(
  errorMessage: string
): Array<{ field: string; message: string }> | null {
  // Check if this is a validation error
  if (!errorMessage.includes("Validation failed:")) {
    return null;
  }

  // Extract the error part after "Validation failed: "
  const errorPart = errorMessage.replace("Validation failed: ", "");

  // Split into individual error items by "; "
  const errorItems = errorPart.split("; ");

  const errors: Array<{ field: string; message: string }> = [];

  for (const item of errorItems) {
    // Match pattern: [V-XXX-00] snake_field_name: message text
    const match = item.match(/\[([A-Z]-[A-Z]+-\d+)\]\s+([a-z0-9_]+):\s+(.+)/);

    if (match && match[1] && match[2] && match[3]) {
      const ruleId = match[1];
      const snakeField = match[2];
      const message = match[3];

      // Convert snake_case to camelCase
      const camelField = snakeField.replace(/_([a-z])/g, (_, char: string) =>
        char.toUpperCase()
      );

      errors.push({
        field: camelField,
        message: `[${ruleId}] ${message}`,
      });
    }
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Map server validation error field names to entry field names.
 *
 * Server validation returns errors with flat field names that need to be
 * mapped to the RFI/RFE entry component field names for proper display.
 *
 * Server validation keys → Entry component keys:
 * - rfiReceivedDate → receivedDate
 * - rfiDueDate → responseDueDate
 * - rfiSubmittedDate → responseSubmittedDate
 *
 * Note: These are validation error field names, not schema fields.
 * The schema uses rfiEntries[]/rfeEntries[] arrays.
 *
 * @deprecated TRANSITIONAL: These mappings exist for backward compatibility
 * with the server validation API that uses flat field names. Once the server
 * validation is updated to use array-based field names (e.g., rfiEntries[0].receivedDate),
 * these mappings can be removed. The frontend already uses the array format internally.
 */
const RFI_FIELD_MAP: Record<string, string> = {
  rfiReceivedDate: "receivedDate",
  rfiDueDate: "responseDueDate",
  rfiSubmittedDate: "responseSubmittedDate",
} as const;

const RFE_FIELD_MAP: Record<string, string> = {
  rfeReceivedDate: "receivedDate",
  rfeDueDate: "responseDueDate",
  rfeSubmittedDate: "responseSubmittedDate",
} as const;

/**
 * Extract RFI entry errors from flat error map.
 *
 * Server validation uses flat field names like `rfiReceivedDate`.
 * This extracts those errors and maps them to the format expected
 * by RFIEntry components: `{ receivedDate: "error message" }`
 *
 * @param errors - Flat error map from form state
 * @returns Error object for the active RFI entry (index 0)
 */
export function extractRfiEntryErrors(
  errors: Record<string, string>
): Record<string, Record<string, string>> {
  const entryErrors: Record<string, string> = {};

  for (const [key, message] of Object.entries(errors)) {
    const mappedField = RFI_FIELD_MAP[key];
    if (mappedField) {
      entryErrors[mappedField] = message;
    }
  }

  // Server validates the active (first without submitted date) RFI
  // We put all RFI errors under index "0" since that's where active entries appear
  return Object.keys(entryErrors).length > 0 ? { "0": entryErrors } : {};
}

/**
 * Extract RFE entry errors from flat error map.
 *
 * Server validation uses flat field names like `rfeReceivedDate`.
 * This extracts those errors and maps them to the format expected
 * by RFEEntry components: `{ receivedDate: "error message" }`
 *
 * @param errors - Flat error map from form state
 * @returns Error object for the active RFE entry (index 0)
 */
export function extractRfeEntryErrors(
  errors: Record<string, string>
): Record<string, Record<string, string>> {
  const entryErrors: Record<string, string> = {};

  for (const [key, message] of Object.entries(errors)) {
    const mappedField = RFE_FIELD_MAP[key];
    if (mappedField) {
      entryErrors[mappedField] = message;
    }
  }

  // Server validates the active (first without submitted date) RFE
  // We put all RFE errors under index "0" since that's where active entries appear
  return Object.keys(entryErrors).length > 0 ? { "0": entryErrors } : {};
}

/**
 * Map error field name to actual DOM element name for scrolling.
 *
 * Handles multiple field name formats:
 * 1. Array paths: rfiEntries.0.receivedDate → rfi-0-receivedDate
 * 2. Legacy flat names: rfiReceivedDate → rfi-0-receivedDate
 * 3. Standard fields: pwdFilingDate → pwdFilingDate
 *
 * @param fieldName - Field name from error object
 * @returns Name attribute used in the DOM element
 */
export function mapFieldToInputName(fieldName: string): string {
  // Handle RFI array field paths: rfiEntries.0.receivedDate → rfi-0-receivedDate
  const rfiArrayMatch = fieldName.match(/^rfiEntries\.(\d+)\.(\w+)$/);
  if (rfiArrayMatch) {
    return `rfi-${rfiArrayMatch[1]}-${rfiArrayMatch[2]}`;
  }

  // Handle RFE array field paths: rfeEntries.0.receivedDate → rfe-0-receivedDate
  const rfeArrayMatch = fieldName.match(/^rfeEntries\.(\d+)\.(\w+)$/);
  if (rfeArrayMatch) {
    return `rfe-${rfeArrayMatch[1]}-${rfeArrayMatch[2]}`;
  }

  // Legacy flat field mapping (backward compatibility with older server errors)
  if (RFI_FIELD_MAP[fieldName]) {
    return `rfi-0-${RFI_FIELD_MAP[fieldName]}`;
  }

  if (RFE_FIELD_MAP[fieldName]) {
    return `rfe-0-${RFE_FIELD_MAP[fieldName]}`;
  }

  // Standard fields use the same name
  return fieldName;
}
