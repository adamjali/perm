/**
 * Case Form Zod Schema
 *
 * Comprehensive validation schemas for case add/edit forms.
 * Integrates with lib/perm validators for PERM-specific rules.
 */
import { z } from 'zod';
import type { Id } from '@/../convex/_generated/dataModel';
import {
  validateCase,
  type ValidationIssue as PermValidationIssue,
  getFirstRecruitmentDate,
  getLastRecruitmentDate,
  isISODateString,
} from '../perm';

// Re-export isISODateString for backward compatibility
export { isISODateString };

/**
 * Check if a date string represents a Sunday.
 */
export function isSunday(dateStr: string): boolean {
  if (!isISODateString(dateStr)) {
    return false;
  }
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay() === 0;
}

// ============================================================================
// Zod Schema Factories
// ============================================================================

const ISO_DATE_MESSAGE = 'Invalid date. Please select a valid date.';

/** Create an optional date schema with custom validation */
function createOptionalDateSchema(
  validate: (val: string) => boolean = isISODateString,
  message: string = ISO_DATE_MESSAGE
) {
  return z
    .string()
    .optional()
    .refine((val) => val === undefined || validate(val), { message });
}

const isoDateSchema = z.string().refine(isISODateString, { message: ISO_DATE_MESSAGE });
const optionalIsoDateSchema = createOptionalDateSchema();
const sundayDateSchema = createOptionalDateSchema(isSunday, 'Date must be a Sunday');

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Note priority levels
 */
export const NOTE_PRIORITIES = ['high', 'medium', 'low'] as const;
export type NotePriority = (typeof NOTE_PRIORITIES)[number];

/**
 * Note categories
 */
export const NOTE_CATEGORIES = [
  'follow-up',
  'document',
  'client',
  'internal',
  'deadline',
  'other',
] as const;
export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

/**
 * Human-readable labels for note categories
 */
export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  'follow-up': 'Follow-up',
  'document': 'Document Needed',
  'client': 'Client Communication',
  'internal': 'Internal',
  'deadline': 'Deadline',
  'other': 'Other',
};

const noteSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  createdAt: z.number(),
  status: z.enum(['pending', 'done', 'deleted']),
  // Extended fields for full journal functionality (optional for backward compatibility)
  priority: z.enum(['high', 'medium', 'low']).optional(),
  category: z
    .enum(['follow-up', 'document', 'client', 'internal', 'deadline', 'other'])
    .optional(),
  dueDate: optionalIsoDateSchema, // Optional due date for task-like notes
});

const additionalRecruitmentMethodSchema = z.object({
  method: z.string().min(1, 'Method is required'),
  date: isoDateSchema,
  description: z.string().optional(),
});

/**
 * RFI entry schema - strict 30-day due date (auto-calculated, not editable).
 * One active entry at a time (no responseSubmittedDate).
 */
const rfiEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  receivedDate: isoDateSchema,
  responseDueDate: isoDateSchema, // Auto-calculated: +30 days
  responseSubmittedDate: optionalIsoDateSchema,
  createdAt: z.number(),
});

/**
 * RFE entry schema - editable due date.
 * One active entry at a time (no responseSubmittedDate).
 */
const rfeEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  receivedDate: isoDateSchema,
  responseDueDate: isoDateSchema, // USER EDITABLE
  responseSubmittedDate: optionalIsoDateSchema,
  createdAt: z.number(),
});

export type NoteEntry = z.infer<typeof noteSchema>;
export type RFIEntry = z.infer<typeof rfiEntrySchema>;
export type RFEEntry = z.infer<typeof rfeEntrySchema>;

/**
 * Main case form schema.
 * Matches the Convex cases table structure.
 */
export const caseFormSchema = z
  .object({
    // Required fields
    employerName: z.string().min(1, 'Employer name is required'),
    beneficiaryIdentifier: z.string().optional().default(''),
    positionTitle: z.string().min(1, 'Position title is required'),
    caseStatus: z.enum(['pwd', 'recruitment', 'eta9089', 'i140', 'closed']),
    progressStatus: z.enum([
      'working',
      'waiting_intake',
      'filed',
      'approved',
      'under_review',
      'rfi_rfe',
    ]),

    // Optional string fields
    caseNumber: z.string().optional(),
    internalCaseNumber: z.string().optional(),
    employerFein: z.string().optional(),
    jobTitle: z.string().optional(),
    socCode: z.string().optional(),
    socTitle: z.string().optional(),
    jobOrderState: z.string().optional(),
    progressStatusOverride: z.boolean().optional(),

    // PWD dates
    pwdFilingDate: optionalIsoDateSchema,
    pwdDeterminationDate: optionalIsoDateSchema,
    pwdExpirationDate: optionalIsoDateSchema,
    pwdCaseNumber: z.string().optional(),
    pwdWageAmount: z.number().optional(),
    pwdWageLevel: z.string().optional(),

    // Recruitment - Job Order
    jobOrderStartDate: optionalIsoDateSchema,
    jobOrderEndDate: optionalIsoDateSchema,

    // Recruitment - Sunday Ads (with Sunday validation)
    sundayAdFirstDate: sundayDateSchema,
    sundayAdSecondDate: sundayDateSchema,
    sundayAdNewspaper: z.string().optional(),

    // Recruitment - Additional Methods
    additionalRecruitmentStartDate: optionalIsoDateSchema,
    additionalRecruitmentEndDate: optionalIsoDateSchema,
    additionalRecruitmentMethods: z.array(additionalRecruitmentMethodSchema),
    recruitmentNotes: z.string().optional(),
    recruitmentApplicantsCount: z.number().int().min(0).default(0),
    recruitmentSummaryCustom: z.string().optional(),

    // Professional occupation
    isProfessionalOccupation: z.boolean(),

    // Notice of Filing
    noticeOfFilingStartDate: optionalIsoDateSchema,
    noticeOfFilingEndDate: optionalIsoDateSchema,

    // ETA 9089
    eta9089FilingDate: optionalIsoDateSchema,
    eta9089AuditDate: optionalIsoDateSchema,
    eta9089CertificationDate: optionalIsoDateSchema,
    eta9089ExpirationDate: optionalIsoDateSchema,
    eta9089CaseNumber: z.string().optional(),

    // RFI entries (strict 30-day due, one active at a time)
    rfiEntries: z.array(rfiEntrySchema),

    // RFE entries (editable due date, one active at a time)
    rfeEntries: z.array(rfeEntrySchema),

    // I-140
    i140FilingDate: optionalIsoDateSchema,
    i140ReceiptDate: optionalIsoDateSchema,
    i140ReceiptNumber: z.string().optional(),
    i140ApprovalDate: optionalIsoDateSchema,
    i140DenialDate: optionalIsoDateSchema,
    i140Category: z.enum(['EB-1', 'EB-2', 'EB-3']).optional(),
    i140ServiceCenter: z.string().optional(),
    i140PremiumProcessing: z.boolean().optional(),

    // Organization & Metadata
    priorityLevel: z.enum(['low', 'normal', 'high', 'urgent']),
    isFavorite: z.boolean(),
    notes: z.array(noteSchema),
    tags: z.array(z.string()),
    calendarSyncEnabled: z.boolean(),
    showOnTimeline: z.boolean(),

    // Job Description (for PERM postings)
    jobDescriptionPositionTitle: z.string().optional(),
    jobDescription: z.string().max(10000, 'Job description must be 10,000 characters or less').optional(),
    jobDescriptionTemplateId: z.custom<Id<"jobDescriptionTemplates">>().optional(), // Template ID reference
  })
  .superRefine((data, ctx) => {
    validateSundayAdSequence(data, ctx);
    if (data.isProfessionalOccupation) {
      validateProfessionalRecruitment(data, ctx);
    }
  });

// ============================================================================
// Cross-field Validation Helpers
// ============================================================================

// Use a partial type that captures the fields needed for cross-validation
interface CrossValidationData {
  sundayAdFirstDate?: string;
  sundayAdSecondDate?: string;
  additionalRecruitmentStartDate?: string;
  additionalRecruitmentEndDate?: string;
  additionalRecruitmentMethods?: Array<{ date?: string }>;
  pwdDeterminationDate?: string;
  pwdExpirationDate?: string;
  jobOrderStartDate?: string;
  noticeOfFilingStartDate?: string;
  isProfessionalOccupation?: boolean;
}
type ValidationContext = z.RefinementCtx;

/** Validate second Sunday ad is after first */
function validateSundayAdSequence(data: CrossValidationData, ctx: ValidationContext): void {
  if (!data.sundayAdFirstDate || !data.sundayAdSecondDate) return;
  if (new Date(data.sundayAdSecondDate) <= new Date(data.sundayAdFirstDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Second Sunday ad must be after first Sunday ad',
      path: ['sundayAdSecondDate'],
    });
  }
}

/** Validate professional occupation recruitment fields */
function validateProfessionalRecruitment(data: CrossValidationData, ctx: ValidationContext): void {
  // Validate additional recruitment date range
  if (data.additionalRecruitmentStartDate && data.additionalRecruitmentEndDate) {
    if (new Date(data.additionalRecruitmentEndDate) < new Date(data.additionalRecruitmentStartDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date must be on or after start date',
        path: ['additionalRecruitmentEndDate'],
      });
    }
  }

  // Validate individual method dates
  if (!data.additionalRecruitmentMethods || data.additionalRecruitmentMethods.length === 0) return;

  const pwdDate = data.pwdDeterminationDate ? new Date(data.pwdDeterminationDate) : null;
  const maxDateInfo = calculateMethodMaxDate(data);

  data.additionalRecruitmentMethods.forEach((method, index) => {
    if (!method.date) return;
    const methodDate = new Date(method.date);

    // Check min: after PWD determination
    if (pwdDate && methodDate < pwdDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Method date must be on or after PWD determination (${data.pwdDeterminationDate})`,
        path: ['additionalRecruitmentMethods', index, 'date'],
      });
    }

    // Check max: before deadline
    if (maxDateInfo && methodDate > maxDateInfo.date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Method date must be on or before ${maxDateInfo.dateStr} (${maxDateInfo.reason})`,
        path: ['additionalRecruitmentMethods', index, 'date'],
      });
    }
  });
}

/** Calculate maximum allowed date for recruitment methods */
function calculateMethodMaxDate(data: CrossValidationData): { date: Date; dateStr: string; reason: string } | null {
  const recruitmentDates = [
    data.jobOrderStartDate,
    data.sundayAdFirstDate,
    data.noticeOfFilingStartDate,
  ].filter((d): d is string => !!d);

  const firstRecruitmentDate = recruitmentDates.length > 0 ? recruitmentDates.sort()[0] : null;

  let maxDate: Date | null = null;
  let reason = '';

  if (firstRecruitmentDate) {
    const max150 = new Date(firstRecruitmentDate);
    max150.setDate(max150.getDate() + 150);

    if (data.pwdExpirationDate) {
      const pwdMax = new Date(data.pwdExpirationDate);
      pwdMax.setDate(pwdMax.getDate() - 30);
      if (max150 <= pwdMax) {
        maxDate = max150;
        reason = '150 days from first recruitment';
      } else {
        maxDate = pwdMax;
        reason = '30 days before PWD expiration';
      }
    } else {
      maxDate = max150;
      reason = '150 days from first recruitment';
    }
  } else if (data.pwdExpirationDate) {
    maxDate = new Date(data.pwdExpirationDate);
    maxDate.setDate(maxDate.getDate() - 30);
    reason = '30 days before PWD expiration';
  }

  if (!maxDate) return null;
  const dateStr = maxDate.toISOString().split('T')[0] ?? '';
  return { date: maxDate, dateStr, reason };
}

// ============================================================================
// Types
// ============================================================================

/**
 * Inferred type from Zod schema - form input data.
 */
export type CaseFormData = z.infer<typeof caseFormSchema>;

/**
 * Individual field error.
 */
export interface FieldError {
  field: string;
  message: string;
  ruleId?: string;
}

/**
 * Combined validation result from Zod + lib/perm.
 */
export interface CaseFormErrors {
  valid: boolean;
  errors: FieldError[];
  warnings: FieldError[];
}

// ============================================================================
// Validation Integration
// ============================================================================

/**
 * Convert Zod errors to field errors.
 */
function zodErrorsToFieldErrors(zodError: z.ZodError): FieldError[] {
  // Zod 4.x uses 'issues' property
  return zodError.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Map lib/perm snake_case field names to form camelCase field names.
 * This ensures error clearing works correctly when user edits a field.
 */
const PERM_TO_FORM_FIELD_MAP: Record<string, string> = {
  pwd_filing_date: 'pwdFilingDate',
  pwd_determination_date: 'pwdDeterminationDate',
  pwd_expiration_date: 'pwdExpirationDate',
  sunday_ad_first_date: 'sundayAdFirstDate',
  sunday_ad_second_date: 'sundayAdSecondDate',
  job_order_start_date: 'jobOrderStartDate',
  job_order_end_date: 'jobOrderEndDate',
  notice_of_filing_start_date: 'noticeOfFilingStartDate',
  notice_of_filing_end_date: 'noticeOfFilingEndDate',
  eta9089_filing_date: 'eta9089FilingDate',
  eta9089_certification_date: 'eta9089CertificationDate',
  eta9089_expiration_date: 'eta9089ExpirationDate',
  i140_filing_date: 'i140FilingDate',
  i140_approval_date: 'i140ApprovalDate',
  // RFI/RFE use arrays - map to specific entry fields (index 0 = active entry)
  rfi_received_date: 'rfiEntries.0.receivedDate',
  rfi_due_date: 'rfiEntries.0.responseDueDate',
  rfi_submitted_date: 'rfiEntries.0.responseSubmittedDate',
  rfe_received_date: 'rfeEntries.0.receivedDate',
  rfe_due_date: 'rfeEntries.0.responseDueDate',
  rfe_submitted_date: 'rfeEntries.0.responseSubmittedDate',
  is_professional_occupation: 'isProfessionalOccupation',
  recruitment_end_date: 'additionalRecruitmentEndDate', // General recruitment field
};

/**
 * Convert lib/perm validation issues to field errors.
 * Maps snake_case field names to camelCase form field names.
 */
function permValidationToFieldErrors(issues: readonly PermValidationIssue[]): FieldError[] {
  return issues.map((issue) => ({
    field: PERM_TO_FORM_FIELD_MAP[issue.field] || issue.field,
    message: issue.message,
    ruleId: issue.ruleId,
  }));
}

/** Get the active entry (one without responseSubmittedDate) from RFI or RFE entries */
function getActiveEntry<T extends { responseSubmittedDate?: string }>(entries: T[]): T | null {
  return entries.find((e) => !e.responseSubmittedDate) ?? null;
}

/**
 * Map form field names to lib/perm validation field names.
 * Note: ValidationCaseData excludes case_status and progress_status.
 * For RFI/RFE arrays, extracts the active entry (if any) for validation.
 */
function formDataToValidationData(data: CaseFormData) {
  const activeRfi = getActiveEntry(data.rfiEntries);
  const activeRfe = getActiveEntry(data.rfeEntries);

  return {
    pwd_filing_date: data.pwdFilingDate ?? null,
    pwd_determination_date: data.pwdDeterminationDate ?? null,
    pwd_expiration_date: data.pwdExpirationDate ?? null,
    sunday_ad_first_date: data.sundayAdFirstDate ?? null,
    sunday_ad_second_date: data.sundayAdSecondDate ?? null,
    job_order_start_date: data.jobOrderStartDate ?? null,
    job_order_end_date: data.jobOrderEndDate ?? null,
    notice_of_filing_start_date: data.noticeOfFilingStartDate ?? null,
    notice_of_filing_end_date: data.noticeOfFilingEndDate ?? null,
    eta9089_filing_date: data.eta9089FilingDate ?? null,
    eta9089_certification_date: data.eta9089CertificationDate ?? null,
    eta9089_expiration_date: data.eta9089ExpirationDate ?? null,
    i140_filing_date: data.i140FilingDate ?? null,
    i140_approval_date: data.i140ApprovalDate ?? null,
    rfi_received_date: activeRfi?.receivedDate ?? null,
    rfi_due_date: activeRfi?.responseDueDate ?? null,
    rfi_submitted_date: activeRfi?.responseSubmittedDate ?? null,
    rfe_received_date: activeRfe?.receivedDate ?? null,
    rfe_due_date: activeRfe?.responseDueDate ?? null,
    rfe_submitted_date: activeRfe?.responseSubmittedDate ?? null,
    is_professional_occupation: data.isProfessionalOccupation,
  };
}

// NOTE: Recruitment date calculations now use lib/perm as canonical source
// See: src/lib/lib/perm/filing-window.ts

/**
 * Calculate recruitment start date (MIN of all start dates - first recruitment step).
 * Delegates to lib/perm's getFirstRecruitmentDate().
 */
function calculateRecruitmentStartDate(data: CaseFormData): string | null {
  return getFirstRecruitmentDate(data) ?? null;
}

/**
 * Calculate recruitment end date (MAX of all end dates - last recruitment step).
 * Delegates to lib/perm's getLastRecruitmentDate().
 */
function calculateRecruitmentEndDate(data: CaseFormData): string | null {
  return getLastRecruitmentDate(data, data.isProfessionalOccupation ?? false) ?? null;
}

/**
 * Validate case form data using both Zod schema and lib/perm validators.
 *
 * @param data - Form data to validate
 * @returns Combined validation result with errors and warnings
 */
export function validateCaseForm(data: CaseFormData): CaseFormErrors {
  const allErrors: FieldError[] = [];
  const allWarnings: FieldError[] = [];

  // Step 1: Run Zod schema validation
  const zodResult = caseFormSchema.safeParse(data);
  if (!zodResult.success) {
    allErrors.push(...zodErrorsToFieldErrors(zodResult.error));
  }

  // Step 2: Run lib/perm validators
  // Always run lib/perm to catch date relationship errors even if Zod has other errors.
  // lib/perm handles null values gracefully.
  try {
    const validationData = formDataToValidationData(data);
    const recruitmentStartDate = calculateRecruitmentStartDate(data);
    const recruitmentEndDate = calculateRecruitmentEndDate(data);

    // Fill in derived recruitment dates for lib/perm validation
    const fullValidationData = {
      ...validationData,
      recruitment_start_date: recruitmentStartDate,
      recruitment_end_date: recruitmentEndDate,
    };

    const permResult = validateCase(fullValidationData);
    allErrors.push(...permValidationToFieldErrors(permResult.errors));
    allWarnings.push(...permValidationToFieldErrors(permResult.warnings));
  } catch {
    // If lib/perm fails (e.g., due to invalid date formats), ignore
    // The Zod errors will already capture format issues
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Status validation result
 */
export interface StatusValidationResult {
  valid: boolean;
  warning?: string;
}

/**
 * Validate that the selected case status matches the form data.
 * Returns a warning if the status is inconsistent with the entered data.
 *
 * @param caseStatus - The selected case status
 * @param progressStatus - The selected progress status
 * @param values - Current form values
 * @returns Validation result with optional warning message
 */
export function validateStatusSelection(
  caseStatus: CaseFormData['caseStatus'],
  progressStatus: CaseFormData['progressStatus'],
  values: Partial<CaseFormData>
): StatusValidationResult {
  // PWD stage requires PWD filing date if status is filed/approved
  if (caseStatus === 'pwd') {
    if (progressStatus === 'filed' && !values.pwdFilingDate) {
      return {
        valid: false,
        warning: 'PWD "Filed" selected but no PWD filing date entered',
      };
    }
    if (progressStatus === 'approved' && !values.pwdDeterminationDate) {
      return {
        valid: false,
        warning: 'PWD "Approved" selected but no PWD determination date entered',
      };
    }
  }

  // Recruitment stage requires PWD determination date
  if (caseStatus === 'recruitment' && !values.pwdDeterminationDate) {
    return {
      valid: false,
      warning: 'Recruitment stage selected but no PWD determination date entered',
    };
  }

  // ETA 9089 stage validation
  if (caseStatus === 'eta9089') {
    if (progressStatus === 'filed' && !values.eta9089FilingDate) {
      return {
        valid: false,
        warning: 'ETA 9089 "Filed" selected but no filing date entered',
      };
    }
    if (progressStatus === 'approved' && !values.eta9089CertificationDate) {
      return {
        valid: false,
        warning: 'ETA 9089 "Approved" selected but no certification date entered',
      };
    }
  }

  // I-140 stage validation
  if (caseStatus === 'i140') {
    if (!values.eta9089CertificationDate) {
      return {
        valid: false,
        warning: 'I-140 stage selected but no ETA 9089 certification date entered',
      };
    }
    if (progressStatus === 'filed' && !values.i140FilingDate) {
      return {
        valid: false,
        warning: 'I-140 "Filed" selected but no I-140 filing date entered',
      };
    }
    if (progressStatus === 'approved' && !values.i140ApprovalDate) {
      return {
        valid: false,
        warning: 'I-140 "Approved" selected but no I-140 approval date entered',
      };
    }
  }

  return { valid: true };
}
