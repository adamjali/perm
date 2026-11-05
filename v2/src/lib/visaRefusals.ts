/**
 * State's yearly table of visa refusals by ground (scripts/ingest_visa_refusals.py), shaped for
 * /visa-refusals. A plain module: the page, its year table (a client component) and the tests
 * share it. Every figure is State's; nothing here estimates.
 *
 * A null cell is State's "-": the ground can't apply to that kind of visa (214(b) to an immigrant
 * visa). It's never 0, and it sorts last.
 */

export type RefusalField = "ivFound" | "ivOvercome" | "nivFound" | "nivOvercome";

export interface RefusalRow {
  fy: number;
  /** The row's place in State's table. */
  line: number;
  /** The section of law as State printed it: "212(a)(4)", "8 U.S.C. § 1182e". */
  code: string;
  /** The ground as State printed it. */
  ground: string;
  ivFound: number | null;
  ivOvercome: number | null;
  nivFound: number | null;
  nivOvercome: number | null;
}

export interface RefusalTotals {
  iv_found: number;
  iv_overcome: number;
  niv_found: number;
  niv_overcome: number;
}

export interface KnownGap {
  column: string;
  rowsAddTo: number;
  stateTotal: number;
  ground: string;
  why: string;
}

export interface RefusalSummary {
  years: number[];
  newest: number | null;
  totals: Record<string, RefusalTotals>;
  knownGaps: Record<string, KnownGap[]>;
  /** The address State serves each year's file at, where the load vouched for the exact bytes. */
  sources: Record<string, string>;
  /** The Eastern day the table last changed. */
  changedOn: string | null;
}

/** The grounds the page follows across the years. */
export const PUBLIC_CHARGE = "212(a)(4)";
export const MISSING_DOCUMENTS = "221(g)";
export const INTENT_TO_RETURN = "214(b)";
export const TRACKED_CODES = [PUBLIC_CHARGE, MISSING_DOCUMENTS, INTENT_TO_RETURN] as const;

/** What the three grounds mean, in plain words, from the sections of the law themselves. */
export const TRACKED_WORDS: Record<(typeof TRACKED_CODES)[number], { name: string; what: string }> = {
  "212(a)(4)": {
    name: "Public charge",
    what: "the consular officer judged the applicant likely at any time to become a public charge",
  },
  "221(g)": {
    name: "221(g)",
    what: "the application didn't yet meet the law or its rules, often for a missing document or more processing",
  },
  "214(b)": {
    name: "214(b)",
    what: "the applicant didn't show the officer they qualify for the nonimmigrant visa, such as that they'll return home",
  },
};

export const FIELD_LABEL: Record<RefusalField, string> = {
  ivFound: "Immigrant visas, found ineligible",
  ivOvercome: "Immigrant visas, overcome",
  nivFound: "Nonimmigrant visas, found ineligible",
  nivOvercome: "Nonimmigrant visas, overcome",
};

/** A year as State labels it. */
export const fyLabel = (fy: number): string => `FY${fy}`;

/** One ground's row in each year, oldest first; a year whose table lacks the ground is left out. */
export function series(rows: readonly RefusalRow[], code: string): RefusalRow[] {
  const byYear = new Map<number, RefusalRow>();
  for (const r of rows) {
    if (r.code !== code) continue;
    // A code State repeats in a year (212(a)(9)(A)(i) has three rows) isn't a tracked one; keep the first.
    if (!byYear.has(r.fy)) byYear.set(r.fy, r);
  }
  return [...byYear.values()].sort((a, b) => a.fy - b.fy);
}

/** The grounds with the most findings of one kind, most first, leaving out not-applicable and zero rows. */
export function topGrounds(rows: readonly RefusalRow[], field: RefusalField, n: number): RefusalRow[] {
  return rows
    .filter((r) => (r[field] ?? 0) > 0)
    .sort((a, b) => (b[field] ?? 0) - (a[field] ?? 0) || a.line - b.line)
    .slice(0, n);
}

export interface Extremes {
  high: RefusalRow;
  low: RefusalRow;
  newest: RefusalRow;
}

/** The highest and lowest years of one field, and the newest, for a sentence that states them. */
export function extremes(points: readonly RefusalRow[], field: RefusalField): Extremes | null {
  const known = points.filter((p) => p[field] !== null);
  if (!known.length) return null;
  const by = (pick: (a: number, b: number) => boolean) =>
    known.reduce((best, p) => (pick(p[field]!, best[field]!) ? p : best), known[0]!);
  return { high: by((a, b) => a > b), low: by((a, b) => a < b), newest: known[known.length - 1]! };
}

/** A row's place in the table, as a fiscal year must be. */
export function isFiscalYear(value: string | null): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const fy = Number(value);
  return fy >= 1990 && fy <= 2100 ? fy : null;
}
