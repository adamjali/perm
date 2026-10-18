/**
 * How long a PERM case waits, read off DOL's own determinations: for each
 * month DOL decided cases, the median filing month of the cases it decided.
 */

import { ISO_MONTH_RE, monthIndex } from "@convex/lib/months";

/** One month of determinations, as the disclosure ingest summarises it. */
export interface WaitMonthRow {
  /** Month DOL issued the determinations, "YYYY-MM". */
  decisionMonth: string;
  /** Median filing month of the cases decided that month, "YYYY-MM". */
  medianFilingMonth: string;
  /** How many determinations that month: the sample behind the median. */
  decisions: number;
}

/**
 * The wait in whole months for the newest month DOL decided cases in: filing
 * month to determination month. Null when no row parses, or when the newest
 * row says no time passed, which isn't a wait anyone could have.
 */
export function currentWait(rows: readonly WaitMonthRow[]): number | null {
  let newest: { to: number; wait: number } | null = null;
  for (const row of rows) {
    if (!ISO_MONTH_RE.test(row.medianFilingMonth) || !ISO_MONTH_RE.test(row.decisionMonth)) continue;
    const from = monthIndex(row.medianFilingMonth);
    const to = monthIndex(row.decisionMonth);
    if (to < from) continue;
    if (!newest || to > newest.to) newest = { to, wait: to - from };
  }
  return newest && newest.wait > 0 ? newest.wait : null;
}
