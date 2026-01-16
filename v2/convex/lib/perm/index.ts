/**
 * PERM Business Logic - Central Module
 *
 * This is the SINGLE SOURCE OF TRUTH for all PERM deadline calculations,
 * validations, and business rules per 20 CFR § 656.
 *
 * Architecture:
 * - convex/lib/perm/ (this directory): Backend calculations and storage
 * - src/lib/perm/ (frontend): Re-exports from here for client usage
 *
 * @module
 */

// ============================================================================
// STATUS TYPES
// ============================================================================

export {
  type CaseStatus,
  type ProgressStatus,
  CASE_STATUSES,
  PROGRESS_STATUSES,
  isCaseStatus,
  isProgressStatus,
} from './statusTypes';

// ============================================================================
// CORE TYPES
// ============================================================================

export {
  // Branded date type
  type ISODateString,
  createISODate,
  isISODateString,
  // Validation types
  type ValidationSeverity,
  type ValidationIssue,
  type ValidationResult,
  createValidationResult,
  // Case data
  type CaseData,
  type FieldChange,
  type RecruitmentDeadlines,
} from './types';

// ============================================================================
// CASCADE LOGIC
// ============================================================================

export {
  type CascadeChange,
  applyCascade,
  applyCascadeMultiple,
} from './cascade';

// ============================================================================
// DATE UTILITIES
// ============================================================================

// ============================================================================
// CONSTANTS - Single source of truth
// ============================================================================

export {
  // Filing window constants
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  RECRUITMENT_WINDOW_DAYS,
  PWD_RECRUITMENT_BUFFER_DAYS,
  // Recruitment duration constants
  JOB_ORDER_MIN_DAYS,
  NOTICE_MIN_BUSINESS_DAYS,
  // I-140 constants
  I140_FILING_DAYS,
  ETA9089_EXPIRATION_DAYS,
  // RFI/RFE constants
  RFI_DUE_DAYS,
  RFI_WARNING_DAYS,
  RFE_WARNING_DAYS,
  // Recruitment deadline buffer constants
  JOB_ORDER_START_DEADLINE_DAYS,
  JOB_ORDER_START_PWD_BUFFER_DAYS,
  FIRST_SUNDAY_AD_DEADLINE_DAYS,
  FIRST_SUNDAY_AD_PWD_BUFFER_DAYS,
  SECOND_SUNDAY_AD_DEADLINE_DAYS,
  SECOND_SUNDAY_AD_PWD_BUFFER_DAYS,
} from './constants';

export {
  // Core date utilities
  isValidISODate,
  addDaysUTC,
  formatUTC,
  // Business days
  addBusinessDays,
  countBusinessDays,
  // Federal holidays
  getFederalHolidays,
  isFederalHoliday,
  isBusinessDay,
  type FederalHoliday,
  // Filing window types
  type FilingWindow,
  type FilingWindowStatus,
  type FilingWindowInput,
  type RecruitmentWindow,
  // Filing window functions
  calculateFilingWindow,
  getFilingWindowStatus,
  formatFilingWindow,
  calculateRecruitmentWindowCloses,
  calculateRecruitmentWindowFromCase,
  getFirstRecruitmentDate,
  getLastRecruitmentDate,
  calculateFilingWindowFromCase,
  getFilingWindowStatusFromCase,
} from './dates';

// ============================================================================
// CALCULATORS
// ============================================================================

export {
  // PWD
  calculatePWDExpiration,
  // ETA 9089
  calculateETA9089Window,
  calculateETA9089Expiration,
  calculateRecruitmentEnd,
  type ETA9089Window,
  // Recruitment
  calculateRecruitmentDeadlines,
  lastSundayOnOrBefore,
  calculateNoticeOfFilingEnd,
  calculateJobOrderEnd,
  type RecruitmentDeadlines as RecruitmentDeadlinesCalculated,
  // I-140
  calculateI140FilingDeadline,
  // RFI
  calculateRFIDueDate,
} from './calculators';

// ============================================================================
// VALIDATORS
// ============================================================================

export {
  // PWD
  validatePWD,
  type PWDValidationInput,
  // Recruitment
  validateRecruitment,
  type RecruitmentValidationInput,
  // ETA 9089
  validateETA9089,
  type ETA9089ValidationInput,
  // I-140
  validateI140,
  type I140ValidationInput,
  // RFI
  validateRFI,
  type RFIValidationInput,
  // RFE
  validateRFE,
  type RFEValidationInput,
  // Full case validation
  validateCase,
  type CaseData as ValidationCaseData,
} from './validators';

// ============================================================================
// FIELD MAPPING UTILITIES
// ============================================================================

export {
  mapToValidatorFormat,
  type CamelCaseFields,
} from './utils/fieldMapper';

// ============================================================================
// RECRUITMENT COMPLETENESS
// ============================================================================

export {
  isRecruitmentComplete,
  isBasicRecruitmentComplete,
  isProfessionalRecruitmentComplete,
  type RecruitmentCheckInput,
} from './recruitment/isRecruitmentComplete';

// ============================================================================
// STATUS CALCULATION
// ============================================================================

export {
  calculateAutoStatus,
  type StatusCalculationInput,
  type AutoStatusResult,
} from './statusCalculation';

// ============================================================================
// DEADLINE EXTRACTION & SUPERSESSION
// ============================================================================

export {
  // Types
  type DeadlineType,
  type RfiEntry,
  type RfeEntry,
  type CaseDataForDeadlines,
  type ExtractedDeadline,
  type DeadlineActiveStatus,
  type SupersessionReason,
  DEADLINE_LABELS,
  SUPERSESSION_REASONS,
  // Supersession logic
  isDeadlineActive,
  getActiveRfiEntry,
  getActiveRfeEntry,
  hasAnyActiveDeadline,
  // Extraction
  extractActiveDeadlines,
  getActiveDeadlineTypes,
  shouldRemindForDeadline,
  daysBetween,
  getTodayISO,
} from './deadlines';
