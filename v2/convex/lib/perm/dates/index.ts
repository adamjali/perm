/**
 * PERM date utilities.
 *
 * Business day calculations, federal holidays, and filing window logic.
 */

// Core date utilities
export {
  addDaysUTC,
  validateISODate,
  formatUTC,
  lastSundayOnOrBefore,
  isValidISODate,
} from './dateUtils';

// Business day utilities
export { addBusinessDays, countBusinessDays } from './businessDays';

// Federal holiday utilities
export {
  getFederalHolidays,
  isFederalHoliday,
  isBusinessDay,
  type FederalHoliday,
} from './holidays';

// Filing window calculations
export {
  // Constants
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  RECRUITMENT_WINDOW_DAYS,
  PWD_RECRUITMENT_BUFFER_DAYS,
  // Types
  type FilingWindow,
  type FilingWindowStatus,
  type FilingWindowInput,
  type RecruitmentWindow,
  // Functions
  calculateFilingWindow,
  getFilingWindowStatus,
  formatFilingWindow,
  calculateRecruitmentWindowCloses,
  calculateRecruitmentWindowFromCase,
  getFirstRecruitmentDate,
  getLastRecruitmentDate,
  calculateFilingWindowFromCase,
  getFilingWindowStatusFromCase,
} from './filingWindow';
