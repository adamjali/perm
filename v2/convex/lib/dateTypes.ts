/**
 * Branded Date Types
 *
 * Provides compile-time safety for date string formats.
 * Use these types to catch invalid date formats at compile time.
 */

// ============================================================================
// BRANDED ISO DATE TYPE
// ============================================================================

declare const ISODateBrand: unique symbol;

/**
 * Branded type for ISO date strings (YYYY-MM-DD format).
 *
 * This provides compile-time safety - plain strings cannot be assigned
 * to ISODate without going through parseISODate() validation.
 *
 * @example
 * const date: ISODate = parseISODate("2024-01-15"); // OK
 * const date: ISODate = "2024-01-15"; // Type error!
 */
export type ISODate = string & { readonly [ISODateBrand]: true };

// ============================================================================
// VALIDATION
// ============================================================================

/** ISO date format regex: YYYY-MM-DD */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Type guard to check if a string is a valid ISO date format.
 *
 * @param value - String to validate
 * @returns true if valid YYYY-MM-DD format
 *
 * @example
 * if (isValidISODate(dateStr)) {
 *   // dateStr is narrowed to ISODate type
 *   processDate(dateStr);
 * }
 */
export function isValidISODate(value: string): value is ISODate {
  if (!ISO_DATE_REGEX.test(value)) {
    return false;
  }

  // Validate actual date values (not just format)
  const parts = value.split("-").map(Number);
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

// ============================================================================
// FACTORIES
// ============================================================================

/**
 * Parse and validate an ISO date string.
 *
 * @param value - String to parse (must be YYYY-MM-DD format)
 * @returns Branded ISODate
 * @throws Error if format is invalid
 *
 * @example
 * const expiration = parseISODate("2024-12-31");
 * // expiration is typed as ISODate
 */
export function parseISODate(value: string): ISODate {
  if (!isValidISODate(value)) {
    throw new Error(`Invalid ISO date format: "${value}". Expected YYYY-MM-DD.`);
  }
  return value;
}

/**
 * Safely parse an ISO date string, returning undefined for invalid values.
 *
 * @param value - String to parse (may be undefined or invalid)
 * @returns ISODate or undefined
 *
 * @example
 * const date = tryParseISODate(maybeDate);
 * if (date) {
 *   // date is ISODate
 * }
 */
export function tryParseISODate(value: string | undefined | null): ISODate | undefined {
  if (!value) return undefined;
  return isValidISODate(value) ? value : undefined;
}

/**
 * Convert a Date object to ISODate string.
 *
 * @param date - Date object to convert
 * @returns Branded ISODate string
 *
 * @example
 * const today = dateToISODate(new Date());
 */
export function dateToISODate(date: Date): ISODate {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as ISODate;
}

/**
 * Get today's date as ISODate.
 *
 * @returns Today's date in YYYY-MM-DD format
 */
export function todayISODate(): ISODate {
  return dateToISODate(new Date());
}
