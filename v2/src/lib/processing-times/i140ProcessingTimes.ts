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
 * What replaced it: USCIS's own published ranges per petition subtype. The
 * subtypes within a category differ enormously (EB-1 spans 15.5 months for an
 * outstanding professor and 34.5 for extraordinary ability), so collapsing a
 * category to one number is what produced the original error. Each category
 * reports its subtypes.
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

/** One USCIS-published petition subtype and its reported range. */
export interface I140Subtype {
  /** USCIS's own code, e.g. `E11`. */
  code: string;
  /** Plain-language name, as USCIS labels it. */
  label: string;
  /** Months within which 50% of cases complete, as published. */
  lowMonths: number;
  /** Months within which 93% of cases complete, as published. */
  highMonths: number;
  /**
   * Business days under premium processing.
   *
   * 15 for most categories. EB-1C multinational executives and EB-2 national
   * interest waivers get 45, and a single shared constant reported both as 15.
   */
  premiumBusinessDays: 15 | 45;
}

export interface ProcessingTimeRange {
  /** Lowest published figure across the category's subtypes. */
  lowMonths: number;
  /** Highest published figure across the category's subtypes. */
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
export const PROCESSING_TIMES_AS_OF = "2026-08-17";

/** Where these came from, rendered next to the figures. */
export const PROCESSING_TIMES_SOURCE_URL =
  "https://egov.uscis.gov/processing-times/";

const SUBTYPES: Record<Exclude<I140Category, "">, I140Subtype[]> = {
  "EB-1": [
    { code: "E11", label: "Extraordinary ability", lowMonths: 31, highMonths: 34.5, premiumBusinessDays: 15 },
    { code: "E12", label: "Outstanding professor or researcher", lowMonths: 15.5, highMonths: 19, premiumBusinessDays: 15 },
    { code: "E13", label: "Multinational executive or manager", lowMonths: 27, highMonths: 29, premiumBusinessDays: 45 },
  ],
  "EB-2": [
    { code: "E21", label: "Advanced degree or exceptional ability", lowMonths: 2.5, highMonths: 7.5, premiumBusinessDays: 15 },
  ],
  "EB-2-NIW": [
    { code: "NIW", label: "National interest waiver", lowMonths: 29, highMonths: 32, premiumBusinessDays: 45 },
  ],
  "EB-3": [
    { code: "E31", label: "Skilled worker", lowMonths: 4, highMonths: 8.5, premiumBusinessDays: 15 },
    { code: "EW3", label: "Unskilled worker", lowMonths: 7.5, highMonths: 12.5, premiumBusinessDays: 15 },
    { code: "NUR", label: "Professional nurse or physical therapist", lowMonths: 24.5, highMonths: 26, premiumBusinessDays: 15 },
  ],
};

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Published range for a category, plus the subtypes it spans.
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
    lowMonths: Math.min(...subtypes.map((s) => s.lowMonths)),
    highMonths: Math.max(...subtypes.map((s) => s.highMonths)),
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

/** `"2.5 to 7.5 months"`, or `"29 to 32 months"`. */
export function formatMonthRange(low: number, high: number): string {
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${fmt(low)} to ${fmt(high)} months`;
}
