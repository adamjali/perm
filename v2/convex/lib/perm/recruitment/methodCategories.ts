/**
 * Canonical method category constants for professional recruitment.
 *
 * This is the SINGLE SOURCE OF TRUTH for which recruitment methods use
 * date-range vs sub-entries vs single-date input patterns.
 *
 * @module
 */

/**
 * Methods that use date ranges (startDate + endDate) instead of single dates.
 * These are typically web-based postings that run for extended periods.
 */
export const DATE_RANGE_METHODS = ['job_website_ad', 'employer_website', 'private_employment_firm'] as const;

/**
 * Methods that use sub-entries (array of date + description).
 * Radio and TV ads typically air on multiple specific dates.
 */
export const SUB_ENTRY_METHODS = ['radio_ad', 'tv_ad'] as const;

export type DateRangeMethod = (typeof DATE_RANGE_METHODS)[number];
export type SubEntryMethod = (typeof SUB_ENTRY_METHODS)[number];

/**
 * Determine the date input category for a recruitment method.
 *
 * @param method - The recruitment method value
 * @returns 'date-range' | 'sub-entries' | 'single-date'
 */
export function getMethodCategory(method: string): 'date-range' | 'sub-entries' | 'single-date' {
  if ((DATE_RANGE_METHODS as readonly string[]).includes(method)) return 'date-range';
  if ((SUB_ENTRY_METHODS as readonly string[]).includes(method)) return 'sub-entries';
  return 'single-date';
}
