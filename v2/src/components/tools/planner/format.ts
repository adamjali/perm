import { aboutMonths } from "@/lib/board";
import { monthsToDays, type DayRange, type PlanStage, type SideStage, type Span, type StageOwner } from "@/lib/perm";
import { MONTH_ABBR, shortDate } from "@convex/lib/months";
import { daysBetween } from "@convex/lib/time";

/** The planner's words for dates, lengths and money: one place, so every part says them alike. */

export const usd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** "Mar 2029": a day far off, to its month. */
export function monthShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${MONTH_ABBR[Number(m[2]) - 1]} ${m[1]}` : iso;
}

/** Past this many days ahead, a date reads to its month: the range is wider than a day says. */
export const MONTH_PRECISION_AFTER_DAYS = 120;

/** A day as precise as it deserves: to the day when known or near, to the month when far off. */
export function dayLabel(iso: string, today: string, known = false): string {
  return known || daysBetween(today, iso) <= MONTH_PRECISION_AFTER_DAYS ? shortDate(iso) ?? iso : monthShort(iso);
}

/** "Nov 2028 to Jul 2029", or one day when the range is one day. */
export function rangeLabel(r: DayRange, today: string): string {
  const lo = dayLabel(r.low, today);
  const hi = dayLabel(r.high, today);
  return lo === hi ? lo : `${lo} to ${hi}`;
}

/** "in about 4 months", "about 2 months ago", "today". */
export function fromToday(iso: string, today: string): string {
  const d = daysBetween(today, iso);
  if (d === 0) return "today";
  return d > 0 ? `in ${aboutMonths(d)}` : `${aboutMonths(-d)} ago`;
}

/** A step's length in words from its start and end, at the typical track. */
export const lengthLabel = (start: DayRange, end: DayRange) => aboutMonths(Math.max(0, daysBetween(start.mid, end.mid)));

/** Which unit each step's lengths are read and typed in: DOL's and the employer's in days, USCIS's in months. */
export type LengthKey = Exclude<PlanStage, "visa"> | SideStage;
export const LENGTH_UNIT: Record<LengthKey, "days" | "months"> = {
  pwd: "days",
  recruitment: "days",
  perm: "days",
  i140Prep: "days",
  i140: "months",
  i485: "months",
  ead: "months",
  ap: "months",
};
/** Months shown to one decimal place, the way USCIS prints its medians. */
const MONTH_PLACES = 10;
export const toUnit = (days: number, unit: "days" | "months") =>
  unit === "days" ? Math.round(days) : Math.round((days / monthsToDays(1)) * MONTH_PLACES) / MONTH_PLACES;
export const fromUnit = (n: number, unit: "days" | "months") => (unit === "days" ? n : monthsToDays(n));
export const spanInUnit = (s: Span, unit: "days" | "months"): Span => ({ low: toUnit(s.low, unit), mid: toUnit(s.mid, unit), high: toUnit(s.high, unit) });

export const OWNER_LABEL: Record<StageOwner, string> = { employer: "Employer", dol: "DOL", uscis: "USCIS", state: "State Dept." };
