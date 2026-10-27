/**
 * The day DOL worked, for a status our records first saw at an instant.
 *
 * A DOL day runs from 7 AM Eastern to 7 AM the next morning. Our sweeps catch
 * PERM decisions in three batches, about 4 AM, 10 AM and 3 PM Eastern, and the
 * 4 AM batch is the previous evening's work: over the three weeks to Oct 27
 * 2026 it held 414 decisions on Saturday mornings, 12 on Sunday mornings and 5
 * on Monday mornings, because DOL works Friday evening and barely at all on the
 * weekend. Dated by the hour we saw them, Saturdays read 111 to 146 decisions.
 *
 * Plain module: the change feed (src/lib/db/changes.ts) buckets its days with
 * it, and `observed_day` in scripts/ingest_case_status_direct.py folds the
 * daily_decisions series the same way; scripts/fixtures/dol_day.json holds the
 * two to one answer.
 */

import { easternDay } from "@/lib/time";

/** The Eastern hour a DOL day starts at. */
export const DOL_DAY_STARTS_HOUR = 7;

const EASTERN_HOUR = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  hourCycle: "h23",
});

const prevDay = (day: string) =>
  new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const nextDay = (day: string) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** The DOL day an instant falls in, "YYYY-MM-DD". */
export function dolDayOf(ms: number): string {
  const day = easternDay(ms);
  return Number(EASTERN_HOUR.format(ms)) < DOL_DAY_STARTS_HOUR ? prevDay(day) : day;
}

/** The instant a DOL day starts: 7 AM Eastern on that calendar day. */
function dayStart(day: string): number | null {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return null;
  // Eastern is UTC-4 or UTC-5; 7 AM is never the hour a clock changes.
  for (const offset of [4, 5]) {
    const ms = Date.UTC(y, m - 1, d, DOL_DAY_STARTS_HOUR + offset);
    if (easternDay(ms) === day && Number(EASTERN_HOUR.format(ms)) === DOL_DAY_STARTS_HOUR) return ms;
  }
  return null;
}

/** A DOL day's instants, [lo, hi): 7 AM Eastern that day to 7 AM the next. Null for a non-date. */
export function dolDayBounds(day: string): { lo: number; hi: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const t = Date.parse(`${day}T12:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== day) return null;
  const lo = dayStart(day);
  const hi = dayStart(nextDay(day));
  return lo === null || hi === null ? null : { lo, hi };
}
