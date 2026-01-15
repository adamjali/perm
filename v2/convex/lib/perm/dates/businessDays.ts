import { parseISO, format, addDays } from 'date-fns';
import { isBusinessDay } from './holidays';

/**
 * Add N business days to a date, skipping weekends and federal holidays.
 *
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param days - Number of business days to add
 * @returns ISO date string after adding N business days
 *
 * @example
 * addBusinessDays('2025-01-15', 10) // '2025-01-29' (skips weekends and MLK Day)
 */
export function addBusinessDays(startDate: string, days: number): string {
  let date = parseISO(startDate);
  let added = 0;

  while (added < days) {
    date = addDays(date, 1);
    const dateStr = format(date, 'yyyy-MM-dd');
    if (isBusinessDay(dateStr)) {
      added++;
    }
  }

  return format(date, 'yyyy-MM-dd');
}

/**
 * Count business days between two dates (inclusive), skipping weekends and federal holidays.
 *
 * @param startDate - ISO date string (YYYY-MM-DD)
 * @param endDate - ISO date string (YYYY-MM-DD)
 * @returns Number of business days between dates (inclusive)
 *
 * @example
 * countBusinessDays('2025-01-01', '2025-01-10') // 7 (skips New Year and weekends)
 */
export function countBusinessDays(startDate: string, endDate: string): number {
  let count = 0;
  let current = parseISO(startDate);
  const end = parseISO(endDate);

  // Return 0 if end is before start
  if (end < current) {
    return 0;
  }

  while (current <= end) {
    const dateStr = format(current, 'yyyy-MM-dd');
    if (isBusinessDay(dateStr)) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}
