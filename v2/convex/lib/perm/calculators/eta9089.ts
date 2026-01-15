import { max } from 'date-fns';
import { addDaysUTC } from '../dates';
import {
  FILING_WINDOW_WAIT_DAYS,
  FILING_WINDOW_CLOSE_DAYS,
  ETA9089_EXPIRATION_DAYS,
} from '../constants';

/**
 * Filing window for ETA 9089 application.
 */
export interface ETA9089Window {
  /** Earliest date ETA 9089 can be filed (last recruitment end + 30 days) */
  opens: Date;
  /**
   * Latest date ETA 9089 can be filed.
   * This is the MINIMUM of:
   * - First recruitment start + 180 days (regulatory limit)
   * - PWD expiration date (if set, filing must occur before PWD expires)
   *
   * Note: calculateETA9089Window() only calculates the 180-day limit.
   * PWD expiration constraint must be applied separately by calling code.
   * @see getFilingWindowStatus() for full window calculation including PWD.
   */
  closes: Date;
}

/**
 * Calculate the ETA 9089 filing window.
 *
 * Per 20 CFR 656.17:
 * - Window OPENS: 30 days after LAST recruitment step ends
 * - Window CLOSES: 180 days after FIRST recruitment step starts
 *
 * @param firstRecruitmentDate - The date the first recruitment activity started
 * @param lastRecruitmentDate - The date the last recruitment activity ended
 * @returns Filing window with opens and closes dates
 *
 * @example
 * const window = calculateETA9089Window(
 *   new Date('2024-01-15'), // first recruitment
 *   new Date('2024-02-20')  // last recruitment
 * );
 * // { opens: 2024-03-21, closes: 2024-07-13 }
 */
export function calculateETA9089Window(
  firstRecruitmentDate: Date,
  lastRecruitmentDate: Date
): ETA9089Window {
  return {
    opens: addDaysUTC(lastRecruitmentDate, FILING_WINDOW_WAIT_DAYS),
    closes: addDaysUTC(firstRecruitmentDate, FILING_WINDOW_CLOSE_DAYS),
  };
}

/**
 * Calculate the I-140 filing deadline (ETA 9089 expiration).
 *
 * Rule: Must file I-140 within 180 days of ETA 9089 certification
 *
 * @param certificationDate - The ETA 9089 certification date
 * @returns I-140 filing deadline
 *
 * @example
 * calculateETA9089Expiration(new Date('2024-03-15')) // 2024-09-11
 */
export function calculateETA9089Expiration(certificationDate: Date): Date {
  return addDaysUTC(certificationDate, ETA9089_EXPIRATION_DAYS);
}

/**
 * Calculate recruitment end date from all recruitment activity end dates.
 *
 * Rule: Recruitment ends on the latest of all recruitment activities:
 * - Second Sunday newspaper ad date
 * - Job order end date (30 days after posting)
 * - Notice of filing end date (if applicable)
 * - Additional recruitment dates (for professional occupations)
 *
 * @param secondSundayAdDate - Date of second Sunday newspaper ad
 * @param jobOrderEndDate - Job order end date (30 days after start)
 * @param additionalDates - Array of any additional dates to consider
 * @returns The latest of all provided dates
 *
 * @example
 * calculateRecruitmentEnd(
 *   new Date('2024-06-16'),
 *   new Date('2024-06-10'),
 *   [new Date('2024-06-25')]
 * ) // 2024-06-25
 */
export function calculateRecruitmentEnd(
  secondSundayAdDate: Date,
  jobOrderEndDate: Date,
  additionalDates?: Date[]
): Date {
  const allDates = [secondSundayAdDate, jobOrderEndDate];

  if (additionalDates && additionalDates.length > 0) {
    allDates.push(...additionalDates);
  }

  return max(allDates);
}
