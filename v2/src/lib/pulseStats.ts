/**
 * The daily pulse: DOL's last working day of PERM decisions our sweep
 * observed, how it compares with the same weekday before it, the last 30 days
 * as bars, and the average by day of the week. Pure, so the `unit` project can
 * test it; the read is src/lib/db/pulse.ts.
 *
 * WHY THE LAST WORKING DAY AND NOT THE NEWEST DAY. On Tuesday Oct 13 2026 the
 * homepage board read "Decided Oct 12: 11": Columbus Day, DOL closed, and a
 * reader saw DOL all but stop. A weekend does the same every Monday morning
 * (Sunday's 6). So the headline is the newest Monday-to-Friday day that isn't
 * a federal holiday, the holidays after it are named (`closedAfter`), and no
 * holiday counts toward a typical day.
 *
 * WHY "A TYPICAL TUESDAY" AND NOT "THE DAY BEFORE". DOL decides a fraction as
 * much at weekends, so a Monday against the Sunday before it reads as a jump
 * of thousands of percent, and a Saturday against a Friday as a collapse. The
 * comparison that means something is the same weekday over the weeks before.
 *
 * Nothing here is projected. Every figure is a count of decisions DOL made,
 * dated by the day DOL worked (the day our sweep saw them change, or the day
 * before when it saw them before 7 AM Eastern).
 */
import { federalHolidayName, isFederalHoliday } from "@/lib/perm";
import { MS_PER_DAY } from "@/lib/time";
import {
  type ActivityDay,
  type WeekdayProfile,
  weekdayIndex,
  weekdayProfile,
} from "./activityStats";

export interface ClosedDay {
  date: string;
  /** The holiday, as a person reads it ("Columbus Day"). */
  name: string;
  /** What our sweep still saw decided that day (employers withdraw on holidays too). */
  total: number;
}

export interface PulseHeadline {
  /** DOL's last working day on record (the newest day when none is a working day). */
  day: ActivityDay;
  /** Mean total of the same weekday over the earlier weeks, holidays left out, or null with none on record. */
  typical: number | null;
  /** Whole-percent change against `typical`, or null. */
  changePct: number | null;
  /** How many earlier same weekdays `typical` is the mean of. */
  compared: number;
  /** Federal holidays on record after `day`, oldest first: DOL was closed. */
  closedAfter: ClosedDay[];
}

function byDate(days: readonly ActivityDay[]): ActivityDay[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

/** Monday to Friday and not a federal holiday: a day DOL decides cases. */
export function isDolWorkday(iso: string): boolean {
  return weekdayIndex(iso) < 5 && !isFederalHoliday(iso);
}

/** DOL's last working day and how it stands against the same weekday in the `weeks` before it. */
export function pulseHeadline(days: readonly ActivityDay[], weeks = 4): PulseHeadline | null {
  if (days.length === 0) return null;
  const sorted = byDate(days);
  const workdays = sorted.filter((d) => isDolWorkday(d.date));
  const day = workdays[workdays.length - 1] ?? sorted[sorted.length - 1]!;
  const wd = weekdayIndex(day.date);
  const closedAfter: ClosedDay[] = [];
  for (const d of sorted) {
    if (d.date <= day.date) continue;
    const name = federalHolidayName(d.date);
    if (name) closedAfter.push({ date: d.date, name, total: d.total });
  }
  const earlier = sorted
    .filter((d) => d.date < day.date && weekdayIndex(d.date) === wd && !isFederalHoliday(d.date))
    .slice(-weeks);
  if (earlier.length === 0) return { day, typical: null, changePct: null, compared: 0, closedAfter };
  const typical = Math.round(earlier.reduce((a, b) => a + b.total, 0) / earlier.length);
  const changePct = typical > 0 ? Math.round(((day.total - typical) / typical) * 100) : null;
  return { day, typical, changePct, compared: earlier.length, closedAfter };
}

/** The last `n` days on record, oldest first. */
export function lastDays(days: readonly ActivityDay[], n = 30): ActivityDay[] {
  return byDate(days).slice(-n);
}

/**
 * Mean decisions by weekday over the last `weeks` weeks, Monday first.
 * Federal holidays are left out: Columbus Day's 11 isn't a typical Monday.
 *
 * A weekday with no day in the window has `days: 0` and is drawn as absent,
 * never as a zero: no Saturday on record is not "DOL decided nothing on
 * Saturdays".
 */
export function recentWeekdays(days: readonly ActivityDay[], weeks = 4): WeekdayProfile[] {
  return weekdayProfile(byDate(days).slice(-weeks * 7).filter((d) => !isFederalHoliday(d.date)));
}

/** Share of a day's decisions that were certifications, whole percent, or null on an empty day. */
export function certifiedShare(day: ActivityDay): number | null {
  return day.total > 0 ? Math.round((day.certified / day.total) * 100) : null;
}

export interface PulseSummary {
  /** Decisions in the 7 calendar days ending on the newest day. */
  last7: number;
  /** Decisions in the 30 calendar days ending on the newest day. */
  last30: number;
  /** Mean decisions on a DOL working day (Monday to Friday, not a federal holiday) in those 30 days, or null with none. */
  weekdayAvg: number | null;
  /** Share of the 30 days' decisions that were certifications, whole percent, or null. */
  certifiedPct: number | null;
}

/**
 * The few numbers a reader wants before any chart: how many in the last week,
 * the last month, on a typical working day, and how many were approvals.
 * Windows are CALENDAR days back from the newest day, so a missing day counts
 * as nothing rather than pulling an older day into the window.
 */
export function pulseSummary(days: readonly ActivityDay[]): PulseSummary | null {
  if (days.length === 0) return null;
  const sorted = byDate(days);
  const newest = Date.parse(`${sorted[sorted.length - 1]!.date}T00:00:00Z`);
  const within = (n: number) => sorted.filter((d) => newest - Date.parse(`${d.date}T00:00:00Z`) < n * MS_PER_DAY);
  const sum = (rows: readonly ActivityDay[], key: "total" | "certified") => rows.reduce((a, r) => a + r[key], 0);
  const month = within(30);
  const weekdays = month.filter((d) => isDolWorkday(d.date));
  const last30 = sum(month, "total");
  return {
    last7: sum(within(7), "total"),
    last30,
    weekdayAvg: weekdays.length ? Math.round(sum(weekdays, "total") / weekdays.length) : null,
    certifiedPct: last30 > 0 ? Math.round((sum(month, "certified") / last30) * 100) : null,
  };
}
