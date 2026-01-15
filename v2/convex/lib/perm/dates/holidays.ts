/**
 * Federal holiday detection for PERM compliance.
 *
 * Legal basis:
 * - 5 U.S.C. § 6103 - Federal holidays (11 standard holidays)
 * - D.C. Code § 28-2701 - Inauguration Day (Jan 20 every 4 years)
 *   Observed as federal holiday for employees in D.C. area
 *
 * Includes:
 * - 11 standard federal holidays per 5 U.S.C. § 6103
 * - Inauguration Day (Jan 20 every 4 years, starting 2021)
 * - Weekend shift rules (Saturday → Friday, Sunday → Monday) per OPM guidelines
 */

export interface FederalHoliday {
  name: string;
  date: string; // ISO format YYYY-MM-DD
}

/**
 * Get the nth occurrence of a weekday in a month.
 *
 * @param year - Year
 * @param month - Month (0-indexed, 0=January)
 * @param weekday - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param n - Which occurrence (1=first, 2=second, 3=third, 4=fourth)
 * @returns Date object
 */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();

  // Calculate offset to first occurrence of target weekday
  let offset = weekday - firstWeekday;
  if (offset < 0) offset += 7;

  // Calculate day of month for nth occurrence
  const day = 1 + offset + (n - 1) * 7;

  return new Date(year, month, day);
}

/**
 * Get the last occurrence of a weekday in a month.
 *
 * @param year - Year
 * @param month - Month (0-indexed)
 * @param weekday - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns Date object
 */
function lastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number
): Date {
  // Start from last day of month
  const lastDay = new Date(year, month + 1, 0);
  const lastDayWeekday = lastDay.getDay();

  // Calculate offset back to last occurrence of target weekday
  let offset = lastDayWeekday - weekday;
  if (offset < 0) offset += 7;

  const day = lastDay.getDate() - offset;
  return new Date(year, month, day);
}

/**
 * Shift a holiday that falls on a weekend to the nearest weekday.
 *
 * @param date - Original holiday date
 * @returns Adjusted date (Friday if Saturday, Monday if Sunday)
 */
function shiftWeekendHoliday(date: Date): Date {
  const day = date.getDay();

  if (day === 0) {
    // Sunday → shift to Monday
    const shifted = new Date(date);
    shifted.setDate(date.getDate() + 1);
    return shifted;
  } else if (day === 6) {
    // Saturday → shift to Friday
    const shifted = new Date(date);
    shifted.setDate(date.getDate() - 1);
    return shifted;
  }

  return date;
}

/**
 * Format a Date object as ISO date string (YYYY-MM-DD).
 */
function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get all federal holidays for a given year.
 *
 * @param year - Year
 * @returns Array of federal holidays with weekend shifts applied
 */
export function getFederalHolidays(year: number): FederalHoliday[] {
  const holidays: FederalHoliday[] = [];

  // Fixed holidays
  holidays.push({
    name: 'New Year',
    date: formatISODate(shiftWeekendHoliday(new Date(year, 0, 1))),
  });

  holidays.push({
    name: 'Juneteenth',
    date: formatISODate(shiftWeekendHoliday(new Date(year, 5, 19))),
  });

  holidays.push({
    name: 'Independence Day',
    date: formatISODate(shiftWeekendHoliday(new Date(year, 6, 4))),
  });

  holidays.push({
    name: 'Veterans Day',
    date: formatISODate(shiftWeekendHoliday(new Date(year, 10, 11))),
  });

  holidays.push({
    name: 'Christmas',
    date: formatISODate(shiftWeekendHoliday(new Date(year, 11, 25))),
  });

  // Floating holidays (no weekend shift needed - always fall on weekdays)
  holidays.push({
    name: 'MLK Day',
    date: formatISODate(nthWeekdayOfMonth(year, 0, 1, 3)), // 3rd Monday in January
  });

  holidays.push({
    name: 'Presidents Day',
    date: formatISODate(nthWeekdayOfMonth(year, 1, 1, 3)), // 3rd Monday in February
  });

  holidays.push({
    name: 'Memorial Day',
    date: formatISODate(lastWeekdayOfMonth(year, 4, 1)), // Last Monday in May
  });

  holidays.push({
    name: 'Labor Day',
    date: formatISODate(nthWeekdayOfMonth(year, 8, 1, 1)), // 1st Monday in September
  });

  holidays.push({
    name: 'Columbus Day',
    date: formatISODate(nthWeekdayOfMonth(year, 9, 1, 2)), // 2nd Monday in October
  });

  holidays.push({
    name: 'Thanksgiving',
    date: formatISODate(nthWeekdayOfMonth(year, 10, 4, 4)), // 4th Thursday in November
  });

  // Special: Inauguration Day (Jan 20 every 4 years starting 2021)
  if ((year - 2021) % 4 === 0 && year >= 2021) {
    holidays.push({
      name: 'Inauguration Day',
      date: formatISODate(shiftWeekendHoliday(new Date(year, 0, 20))),
    });
  }

  return holidays;
}

/**
 * Check if a date is a federal holiday.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns True if the date is a federal holiday
 */
export function isFederalHoliday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00'); // Ensure local timezone
  const year = date.getFullYear();
  const holidays = getFederalHolidays(year);

  return holidays.some((holiday) => holiday.date === dateStr);
}

/**
 * Check if a date is a business day (not a weekend, not a holiday).
 *
 * @param dateStr - ISO date string (YYYY-MM-DD)
 * @returns True if the date is a business day
 */
export function isBusinessDay(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00'); // Ensure local timezone
  const dayOfWeek = date.getDay();

  // Check if weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check if federal holiday
  return !isFederalHoliday(dateStr);
}
