import { ISO_MONTH_RE, monthIndex, shiftMonth } from "@convex/lib/months";

/**
 * The homepage's first picture: PERM cases by the month they were filed,
 * decided against still waiting, from a few months before the month DOL is
 * deciding up to this month.
 *
 * Every month in the window is drawn, an empty one too, so a gap (October
 * 2025, when DOL's filing system was shut) reads as a gap rather than as two
 * neighbouring months pushed together.
 */
export interface HomeMonth {
  /** Filing month, "YYYY-MM". */
  month: string;
  decided: number;
  waiting: number;
  total: number;
  /** The month DOL says its analysts are deciding. */
  isFront: boolean;
  /** This month: still taking filings, so its bar is still growing. */
  isPartial: boolean;
}

export interface MonthCounts {
  month: string;
  decided: number;
  pending: number;
}

/** Months drawn before the month DOL is deciding. */
export const MONTHS_BEFORE_FRONT = 5;

/**
 * The window, oldest first. Empty when the front month or today's month can't
 * be read, or when the front sits after today (a bad reading): the page then
 * draws no chart rather than a wrong one.
 */
export function homeMonths(
  months: readonly MonthCounts[],
  frontMonth: string | null,
  todayMonth: string,
  before = MONTHS_BEFORE_FRONT,
): HomeMonth[] {
  const front = frontMonth?.slice(0, 7) ?? null;
  if (!front || !ISO_MONTH_RE.test(front) || !ISO_MONTH_RE.test(todayMonth)) return [];
  if (monthIndex(front) > monthIndex(todayMonth)) return [];
  const byMonth = new Map(months.map((m) => [m.month, m]));
  const out: HomeMonth[] = [];
  for (let m = shiftMonth(front, -before); monthIndex(m) <= monthIndex(todayMonth); m = shiftMonth(m, 1)) {
    const row = byMonth.get(m);
    const decided = row?.decided ?? 0;
    const waiting = row?.pending ?? 0;
    out.push({ month: m, decided, waiting, total: decided + waiting, isFront: m === front, isPartial: m === todayMonth });
  }
  return out;
}

