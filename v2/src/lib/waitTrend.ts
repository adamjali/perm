/**
 * How long a PERM case waits, read off DOL's own determinations: for each
 * month DOL decided cases, the median filing month of the cases it decided.
 */

/** One month of determinations, as the disclosure ingest summarises it. */
export interface WaitMonthRow {
  /** Month DOL issued the determinations, "YYYY-MM". */
  decisionMonth: string;
  /** Median filing month of the cases decided that month, "YYYY-MM". */
  medianFilingMonth: string;
  /** How many determinations that month: the sample behind the median. */
  decisions: number;
}

/** "YYYY-MM" as a count of months, or null when it isn't a real month. */
export function monthIndex(value: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return Number(m[1]) * 12 + (month - 1);
}

/**
 * The wait in whole months for the newest month DOL decided cases in: filing
 * month to determination month. Null when no row parses, or when the newest
 * row says no time passed, which isn't a wait anyone could have.
 */
export function currentWait(rows: readonly WaitMonthRow[]): number | null {
  let newest: { to: number; wait: number } | null = null;
  for (const row of rows) {
    const from = monthIndex(row.medianFilingMonth);
    const to = monthIndex(row.decisionMonth);
    if (from === null || to === null || to < from) continue;
    if (!newest || to > newest.to) newest = { to, wait: to - from };
  }
  return newest && newest.wait > 0 ? newest.wait : null;
}
