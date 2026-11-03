import { shiftMonth } from "@convex/lib/months";

/** One month's immigrant visas abroad, split between nationals of the 75 paused countries and everyone else. */
export interface SeventyFiveMonth {
  month: string;
  eb75: number;
  all75: number;
  ebOther: number;
  allOther: number;
}

export interface Change {
  from: number;
  to: number;
  /** Whole percent, rounded; null when the earlier month is zero. */
  percent: number | null;
}

const change = (from: number, to: number): Change => ({ from, to, percent: from > 0 ? Math.round(((to - from) / from) * 100) : null });

/**
 * The newest month against the same month a year earlier, both ways. Null unless both months are
 * held: a month missing from State's tables is never read as zero.
 */
export function yearOnYear(months: readonly SeventyFiveMonth[]): {
  newest: string;
  yearBefore: string;
  eb75: Change;
  ebOther: Change;
  all75: Change;
} | null {
  const newest = months.at(-1);
  if (!newest) return null;
  const yearBefore = shiftMonth(newest.month, -12);
  const before = months.find((m) => m.month === yearBefore);
  if (!before) return null;
  return {
    newest: newest.month,
    yearBefore,
    eb75: change(before.eb75, newest.eb75),
    ebOther: change(before.ebOther, newest.ebOther),
    all75: change(before.all75, newest.all75),
  };
}

/** "down 76%", "up 18%", "no change". */
export function changeWords(c: Change): string {
  if (c.percent === null) return "new";
  if (c.percent === 0) return "no change";
  return c.percent < 0 ? `down ${-c.percent}%` : `up ${c.percent}%`;
}
