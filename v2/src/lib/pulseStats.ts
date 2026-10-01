/**
 * The daily pulse: the newest day of PERM decisions our sweep observed, how it
 * compares with the same weekday before it, the last 30 days as bars, and the
 * average by day of the week. Pure, so the `unit` project can test it; the
 * read is src/lib/turso/pulse.ts.
 *
 * WHY "A TYPICAL TUESDAY" AND NOT "THE DAY BEFORE". DOL decides a fraction as
 * much at weekends, so a Monday against the Sunday before it reads as a jump
 * of thousands of percent, and a Saturday against a Friday as a collapse. The
 * comparison that means something is the same weekday over the weeks before.
 *
 * Nothing here is projected. Every figure is a count of decisions DOL made,
 * dated by the day our sweep saw them change.
 */
import {
  type ActivityDay,
  type WeekdayProfile,
  weekdayIndex,
  weekdayProfile,
} from "./activityStats";

export interface PulseHeadline {
  /** The newest day on record. */
  day: ActivityDay;
  /** Mean total of the same weekday over the earlier weeks, or null with none on record. */
  typical: number | null;
  /** Whole-percent change against `typical`, or null. */
  changePct: number | null;
  /** How many earlier same weekdays `typical` is the mean of. */
  compared: number;
}

function byDate(days: readonly ActivityDay[]): ActivityDay[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

/** The newest day and how it stands against the same weekday in the `weeks` before it. */
export function pulseHeadline(days: readonly ActivityDay[], weeks = 4): PulseHeadline | null {
  if (days.length === 0) return null;
  const sorted = byDate(days);
  const day = sorted[sorted.length - 1]!;
  const wd = weekdayIndex(day.date);
  const earlier = sorted
    .slice(0, -1)
    .filter((d) => weekdayIndex(d.date) === wd)
    .slice(-weeks);
  if (earlier.length === 0) return { day, typical: null, changePct: null, compared: 0 };
  const typical = Math.round(earlier.reduce((a, b) => a + b.total, 0) / earlier.length);
  const changePct = typical > 0 ? Math.round(((day.total - typical) / typical) * 100) : null;
  return { day, typical, changePct, compared: earlier.length };
}

/** The last `n` days on record, oldest first. */
export function lastDays(days: readonly ActivityDay[], n = 30): ActivityDay[] {
  return byDate(days).slice(-n);
}

/**
 * Mean decisions by weekday over the last `weeks` weeks, Monday first.
 *
 * A weekday with no day in the window has `days: 0` and is drawn as absent,
 * never as a zero: no Saturday on record is not "DOL decided nothing on
 * Saturdays".
 */
export function recentWeekdays(days: readonly ActivityDay[], weeks = 4): WeekdayProfile[] {
  return weekdayProfile(byDate(days).slice(-weeks * 7));
}

/** Share of a day's decisions that were certifications, whole percent, or null on an empty day. */
export function certifiedShare(day: ActivityDay): number | null {
  return day.total > 0 ? Math.round((day.certified / day.total) * 100) : null;
}
