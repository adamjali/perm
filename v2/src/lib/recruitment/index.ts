/**
 * Recruitment Utilities
 *
 * Exports all recruitment-related utilities for status calculation
 * and results text generation.
 */

export {
  calculateRecruitmentStatus,
  formatFilingWindowRange,
  type RecruitmentStatus,
  type RecruitmentStatusType,
  type RecruitmentCaseData,
  type MandatoryStepsStatus,
  type ProfessionalMethodsStatus,
} from "./statusCalculator";

export {
  generateRecruitmentResultsText,
  getMethodLabel,
  type RecruitmentResultsCaseData,
} from "./resultsGenerator";
