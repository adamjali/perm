/**
 * Input Validation Utilities
 *
 * Provides string length validation for mutation handlers.
 * Convex v.string() has no native max-length, so these are
 * enforced at the handler level.
 *
 * SOC 2 PI1 — Processing Integrity
 */

export const INPUT_LIMITS = {
  /** Names, titles, codes, short identifiers */
  SHORT: 500,
  /** Notes, descriptions, medium text */
  MEDIUM: 10_000,
  /** Job descriptions, recruitment summaries, long-form text */
  LONG: 50_000,
} as const;

/**
 * Validate string length. Throws if value exceeds maxLength.
 * Silently passes for undefined/null values (optional fields).
 */
export function validateStringLength(
  value: string | undefined | null,
  fieldName: string,
  maxLength: number
): void {
  if (value != null && value.length > maxLength) {
    throw new Error(
      `${fieldName} exceeds maximum length of ${maxLength.toLocaleString()} characters`
    );
  }
}

/**
 * Validate multiple fields at once. Throws on the first violation.
 */
export function validateInputLengths(
  fields: Array<{
    value: string | undefined | null;
    name: string;
    limit: number;
  }>
): void {
  for (const { value, name, limit } of fields) {
    validateStringLength(value, name, limit);
  }
}
