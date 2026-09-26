/**
 * I-140 processing times, as USCIS actually reports them.
 *
 * This file previously carried a service-center matrix ("as of April 2025")
 * that was wrong in two independent ways, both material:
 *
 *  1. **The numbers were off by up to 4x.** It listed EB-2 NIW at a 7-month
 *     median. USCIS published 29.0 to 32.0 months. Someone planning a case
 *     around 7 months was being misled on a page they make decisions from.
 *
 *  2. **The service-center dimension no longer exists.** USCIS reports I-140
 *     under a single office (Service Center Operations), not per center, so
 *     asking someone to pick Texas or Nebraska offered a choice that changes
 *     nothing and implied a precision the source does not have.
 *
 * What replaced it: USCIS's own published figure per petition subtype. The
 * subtypes within a category differ enormously (EB-1 runs from 15 months for an
 * outstanding professor to 32.5 for extraordinary ability), so collapsing a
 * category to one number is what produced the original error. Each category
 * reports its subtypes.
 *
 * **What the figure is (re-read 2026-09-26).** USCIS's processing-times page
 * prints ONE number per subtype: "80% of cases are completed within N months",
 * which it defines as "how long it took us to complete 80% of adjudicated cases
 * over the past six months". This module used to store two numbers per subtype
 * (a low and a high, documented as the 50% and 93% points); the page no longer
 * prints a range, so each subtype now carries the single 80% figure, read in a
 * real browser from Service Center Operations, the only office USCIS lists for
 * any I-140 subtype.
 */

// ============================================================================
// TYPES
// ============================================================================

/** Petition categories, matching the values stored on a case. */
export type I140Category = "EB-1" | "EB-2" | "EB-2-NIW" | "EB-3" | "";

/**
 * USCIS service centers.
 *
 * Retained because cases already record one and it is worth keeping on the
 * file. It no longer feeds any estimate: USCIS stopped publishing I-140 times
 * per center, so a per-center number would be invented.
 *
 * @deprecated for estimation. Record-keeping only.
 */
export type ServiceCenter = "Texas" | "Nebraska" | "California" | "Vermont" | "";

/** One USCIS-published petition subtype and its reported figure. */
export interface I140Subtype {
  /** USCIS's own code, e.g. `E11`. */
  code: string;
  /** Plain-language name, as USCIS labels it. */
  label: string;
  /**
   * Months within which USCIS completed 80% of the petitions of this subtype it
   * decided over the past six months, as its processing-times page prints it.
   */
  months80: number;
  /**
   * Business days under premium processing.
   *
   * 15 for most categories. EB-1C multinational executives and EB-2 national
   * interest waivers get 45, and a single shared constant reported both as 15.
   */
  premiumBusinessDays: 15 | 45;
}

/**
 * A category's figures. `lowMonths` and `highMonths` are NOT a percentile
 * range: they are the fastest and slowest subtype's 80% figure, so a category
 * with one subtype (EB-2, the national interest waiver) has low == high.
 */
export interface ProcessingTimeRange {
  /** The smallest 80% figure among the category's subtypes. */
  lowMonths: number;
  /** The largest 80% figure among the category's subtypes. */
  highMonths: number;
  subtypes: I140Subtype[];
}

// ============================================================================
// DATA
// ============================================================================

/**
 * USCIS's own as-of stamp for the figures below.
 *
 * A test asserts this stays current. The previous table sat untouched for
 * sixteen months while quietly reporting numbers a quarter of the real value,
 * because nothing in the codebase could tell that it had gone stale.
 */
export const PROCESSING_TIMES_AS_OF = "2026-09-26";

/** Where these came from, rendered next to the figures. */
export const PROCESSING_TIMES_SOURCE_URL =
  "https://egov.uscis.gov/processing-times/";

const SUBTYPES: Record<Exclude<I140Category, "">, I140Subtype[]> = {
  "EB-1": [
    { code: "E11", label: "Extraordinary ability", months80: 32.5, premiumBusinessDays: 15 },
    { code: "E12", label: "Outstanding professor or researcher", months80: 15, premiumBusinessDays: 15 },
    { code: "E13", label: "Multinational executive or manager", months80: 27.5, premiumBusinessDays: 45 },
  ],
  "EB-2": [
    { code: "E21", label: "Advanced degree or exceptional ability", months80: 3, premiumBusinessDays: 15 },
  ],
  "EB-2-NIW": [
    { code: "NIW", label: "National interest waiver", months80: 30, premiumBusinessDays: 45 },
  ],
  "EB-3": [
    { code: "E31", label: "Skilled worker", months80: 4, premiumBusinessDays: 15 },
    { code: "EW3", label: "Unskilled worker", months80: 9, premiumBusinessDays: 15 },
    { code: "NUR", label: "Professional nurse or physical therapist", months80: 25.5, premiumBusinessDays: 15 },
  ],
};

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * A category's published figures: the span of its subtypes' 80% figures, plus
 * the subtypes themselves.
 *
 * Returns null for an unset category rather than a default: no category means
 * no answer, and a placeholder number here is what the old table effectively
 * was.
 */
export function getI140ProcessingTime(category: I140Category): ProcessingTimeRange | null {
  if (!category) return null;
  const subtypes = SUBTYPES[category];
  if (!subtypes || subtypes.length === 0) return null;

  return {
    lowMonths: Math.min(...subtypes.map((s) => s.months80)),
    highMonths: Math.max(...subtypes.map((s) => s.months80)),
    subtypes,
  };
}

/**
 * Premium-processing window for a category, in business days.
 *
 * Returns a single number only when every subtype in the category agrees.
 * EB-1 spans both windows (15 days for E11 and E12, 45 for E13), so a caller
 * gets null and must show the subtypes rather than pick one.
 */
export function getPremiumBusinessDays(category: I140Category): number | null {
  const range = getI140ProcessingTime(category);
  if (!range) return null;
  const windows = new Set(range.subtypes.map((s) => s.premiumBusinessDays));
  const only = [...windows];
  return only.length === 1 && only[0] !== undefined ? only[0] : null;
}

const fmtMonths = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** `"3 months"`, or `"32.5 months"`. */
export function formatMonths(n: number): string {
  return `${fmtMonths(n)} months`;
}

/**
 * `"15 to 32.5 months"` across a category's subtypes, or `"3 months"` when the
 * two ends are equal: a single-subtype category must never read "3 to 3".
 */
export function formatMonthRange(low: number, high: number): string {
  if (low === high) return formatMonths(low);
  return `${fmtMonths(low)} to ${fmtMonths(high)} months`;
}
