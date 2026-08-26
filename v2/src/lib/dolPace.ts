/**
 * Pace derivations over DOL's daily decision series.
 *
 * Deliberately free of the server-only boundary that publicData.ts sits
 * behind. Two reasons: the calculators are client components and want this
 * same number, and the unit vitest project runs happy-dom, where importing
 * server-only throws - so a derivation living in publicData.ts could not be
 * tested at all.
 *
 * The input is structural rather than the DailyDecisions row type, so callers
 * can pass anything carrying a date and a total.
 */

export interface DailyTotal {
  /** ISO date, "YYYY-MM-DD". */
  date: string;
  total: number;
}

export interface Pace {
  perBusinessDay: number;
  businessDays: number;
  from: string;
  to: string;
}

/**
 * Decisions per BUSINESS day over the most recent `days` of a daily series.
 *
 * DOL does not decide cases at weekends, so a plain mean over calendar days
 * understates the working pace by roughly two sevenths, and it moves depending
 * on where the window happens to land. Counting only days that carry at least
 * one decision measures what it claims to: how much work a working day clears.
 *
 * Returns null rather than 0 when the window holds no working days. A pace of
 * zero and "we cannot say" are different statements, and only one of them is
 * safe to put on a page.
 */
export function businessDayPace(
  series: readonly DailyTotal[],
  days = 28,
): Pace | null {
  const window = series.slice(-days).filter((d) => d.total > 0);
  if (window.length === 0) return null;
  const total = window.reduce((sum, d) => sum + d.total, 0);
  return {
    perBusinessDay: Math.round(total / window.length),
    businessDays: window.length,
    from: window[0]!.date,
    to: window[window.length - 1]!.date,
  };
}
