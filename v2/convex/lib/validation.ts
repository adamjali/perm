/**
 * Input Validation Utilities
 *
 * Provides string length validation for mutation handlers.
 * Convex v.string() has no native max-length, so these are
 * enforced at the handler level.
 *
 * SOC 2 PI1 — Processing Integrity
 *
 * Each refusal is a ConvexError, so its sentence reaches the person who typed the text: production replaces a
 * plain Error's message with "Server Error".
 */

import { ConvexError } from "convex/values";

import { isSocCode } from "./socCode";

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
    throw new ConvexError(
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

/** A case's text fields, as create, update and import each receive them. */
export interface CaseText {
  employerName?: string | null;
  positionTitle?: string | null;
  beneficiaryIdentifier?: string | null;
  socCode?: string | null;
  socTitle?: string | null;
  jobDescriptionPositionTitle?: string | null;
  jobDescription?: string | null;
  recruitmentNotes?: string | null;
  recruitmentSummaryCustom?: string | null;
}

/**
 * The checks every case write passes, whoever writes it (the form, the case page, the chat, an import): each
 * text field's cap, and a SOC code's shape. An empty SOC code means none; anything else must be a code
 * (15-1252 or 15-1252.00), or every reader keyed on the code would match nothing.
 */
export function validateCaseText(c: CaseText): void {
  validateInputLengths([
    { value: c.employerName, name: "Employer name", limit: INPUT_LIMITS.SHORT },
    { value: c.positionTitle, name: "Position title", limit: INPUT_LIMITS.SHORT },
    { value: c.beneficiaryIdentifier, name: "Foreign worker ID", limit: INPUT_LIMITS.SHORT },
    { value: c.socCode, name: "SOC code", limit: INPUT_LIMITS.SHORT },
    { value: c.socTitle, name: "SOC title", limit: INPUT_LIMITS.SHORT },
    { value: c.jobDescriptionPositionTitle, name: "Job description position title", limit: INPUT_LIMITS.SHORT },
    { value: c.jobDescription, name: "Job description", limit: INPUT_LIMITS.LONG },
    { value: c.recruitmentNotes, name: "Recruitment notes", limit: INPUT_LIMITS.MEDIUM },
    { value: c.recruitmentSummaryCustom, name: "Recruitment summary", limit: INPUT_LIMITS.MEDIUM },
  ]);
  if (c.socCode && c.socCode.trim() && !isSocCode(c.socCode)) {
    throw new ConvexError("SOC code must be a code such as 15-1252 or 15-1252.00.");
  }
}
