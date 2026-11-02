/**
 * Where DOL is in the PERM line by our own daily check of its case status: the oldest filing month with
 * LINE_MIN_CASES or more cases that DOL hasn't decided LINE_WORKING_BELOW of, from the census matrix
 * (perm_docs['live_census'], rebuilt after every sweep).
 *
 * The one copy of the rule. The site reads it through src/lib/permLine.ts, Convex's PERM month alerts read it
 * directly (DOL's processing-times page stopped printing a month on Oct 31 2026), and scripts/lib_perm_line.py
 * is its Python twin, held to the same answers by scripts/fixtures/perm_line.json. The two constants equal
 * FRONT_MIN_CASES (src/lib/liveQueue.ts) and WORKING_BELOW (src/lib/pwdLine.ts); a test holds them together.
 *
 * Imports nothing, so Convex's bundle and the site's both take it.
 */

/** A month needs this many cases on record to count. */
export const LINE_MIN_CASES = 100;
/** Under this share decided, DOL is still working the month. */
export const LINE_WORKING_BELOW = 0.5;

export interface PermLine {
  /** The filing month DOL is deciding now, "YYYY-MM". */
  month: string;
  /** That month's cases, and how many of them DOL has decided. */
  total: number;
  decided: number;
  /** The day our check ran (ISO). */
  asOf: string;
}

const MONTH = /^\d{4}-\d{2}$/;

/** The line from the census matrix: null when the census doesn't reach back far enough to see it. */
export function permLineFrom(
  matrix: readonly { month: string; is_final: number; n: number }[],
  asOf: string,
): PermLine | null {
  const months = new Map<string, { total: number; decided: number }>();
  for (const r of matrix) {
    if (!MONTH.test(r.month)) continue;
    const m = months.get(r.month) ?? { total: 0, decided: 0 };
    m.total += r.n;
    if (r.is_final === 1) m.decided += r.n;
    months.set(r.month, m);
  }
  const busy = [...months.entries()]
    .filter(([, m]) => m.total >= LINE_MIN_CASES)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const at = busy.findIndex(([, m]) => m.decided / m.total < LINE_WORKING_BELOW);
  // The first month on record still mostly waiting: the record doesn't show where DOL is.
  if (at <= 0) return null;
  const [month, m] = busy[at]!;
  return { month, total: m.total, decided: m.decided, asOf };
}
