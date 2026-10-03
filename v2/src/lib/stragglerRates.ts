/**
 * The straggler rate's shape, and the rules for when it can be used.
 *
 * A straggler is a case still in analyst review that was filed before the
 * month DOL says it is working: the queue has passed it, so no filing-order
 * model can date it. What can be measured is how fast DOL decides that group
 * (scripts/build_straggler_rates.py, nightly). Plain module, so the unit
 * project tests the rules and the browser could read the type.
 */

import { MS_PER_DAY } from "@/lib/time";

export interface StragglerRates {
  /** Eastern date the measurement was taken. */
  asOf: string;
  /** DOL's own Analyst Review month at the time. */
  frontierMonth: string;
  windowDays: number;
  /** Stragglers pending when measured. */
  pending: number;
  /** Everyone at risk over the window. */
  pool: number;
  decided: number;
  dailyRate: number;
  medianDays: number;
  p80Days: number;
}

/** Older than this, the measurement is not today's. The sweep runs nightly. */
export const MAX_AGE_DAYS = 8;
/** Fewer decisions than this in the window, and the rate is noise. */
export const MIN_DECIDED = 30;

/** The doc as stored, or null when it is unreadable, stale or thin. */
export function parseStragglerRates(json: string, today: string): StragglerRates | null {
  let d: Partial<StragglerRates>;
  try {
    d = JSON.parse(json) as Partial<StragglerRates>;
  } catch {
    return null;
  }
  if (
    typeof d.asOf !== "string" ||
    typeof d.frontierMonth !== "string" ||
    typeof d.dailyRate !== "number" ||
    typeof d.medianDays !== "number" ||
    typeof d.p80Days !== "number" ||
    typeof d.decided !== "number"
  ) {
    return null;
  }
  const age = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d.asOf}T00:00:00Z`)) / MS_PER_DAY);
  if (!Number.isFinite(age) || age > MAX_AGE_DAYS || age < 0) return null;
  if (d.decided < MIN_DECIDED || !(d.dailyRate > 0 && d.dailyRate < 1)) return null;
  if (!(d.medianDays >= 1 && d.p80Days >= d.medianDays)) return null;
  return {
    asOf: d.asOf,
    frontierMonth: d.frontierMonth,
    windowDays: Number(d.windowDays ?? 14),
    pending: Number(d.pending ?? 0),
    pool: Number(d.pool ?? 0),
    decided: d.decided,
    dailyRate: d.dailyRate,
    medianDays: d.medianDays,
    p80Days: d.p80Days,
  };
}
