/**
 * What the wage-validity figure says, from the central rules: the determination's expiry
 * (calculatePWDExpiration), whether it still limits the filing for a given first recruitment step
 * (pwdBearing, pwdFilingLimit), and the window's close (calculateFilingWindow). Pure, so the
 * server's render and the browser's first render say the same thing. An illustration: the
 * determination date belongs to an example case.
 */
import { addDaysUTC, calculateFilingWindow, calculatePWDExpiration, pwdBearing, pwdFilingLimit, type PwdBearing } from "@/lib/perm";
import { monthDay, shortDate } from "@convex/lib/months";
import { MS_PER_DAY } from "@/lib/time";

/** The example determination, issued in the 90-day season (April 2 to June 30). */
export const DETERMINED = "2026-04-15";
export const EXPIRES = calculatePWDExpiration(DETERMINED);
/** Days from the determination to its expiry, both counted inside the validity period. */
export const VALID_DAYS = Math.round((Date.parse(`${EXPIRES}T00:00:00Z`) - Date.parse(`${DETERMINED}T00:00:00Z`)) / MS_PER_DAY);
/** The first step's sweep, in days from the determination: from before it to after the expiry. */
export const FIRST_MIN = -40;
export const FIRST_MAX = VALID_DAYS + 30;
/** A job order runs 30 days, so the example's last mandatory step ends 30 days after the first. */
const RECRUIT_DAYS = 30;

export interface PwdReading {
  /** The first recruitment step, ISO. */
  first: string;
  bearing: PwdBearing;
  /** The last day to file, ISO, or null when this determination can't be used. */
  closes: string | null;
  /** Days from the determination to the close, for the drawing. */
  closeDay: number | null;
  sentence: string;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayOf = (isoDay: string) => Math.round((Date.parse(`${isoDay}T00:00:00Z`) - Date.parse(`${DETERMINED}T00:00:00Z`)) / MS_PER_DAY);

/** The reading for a first recruitment step `firstDay` days after the determination. */
export function readPwdValidity(firstDay: number): PwdReading {
  const first = iso(addDaysUTC(new Date(`${DETERMINED}T00:00:00Z`), firstDay));
  const input = { pwdDeterminationDate: DETERMINED, pwdExpirationDate: EXPIRES, firstPwdStep: first };
  const bearing = pwdBearing(input);
  if (bearing === "began-after") {
    return { first, bearing, closes: null, closeDay: null, sentence: `First step ${monthDay(first)}, after it expired: this determination can't be used.` };
  }
  const last = iso(addDaysUTC(new Date(`${first}T00:00:00Z`), RECRUIT_DAYS));
  const w = calculateFilingWindow({ firstRecruitmentDate: first, lastRecruitmentDate: last, pwdExpirationDate: pwdFilingLimit(input) });
  if (!w) throw new Error(`no filing window for ${first}`);
  const sentence =
    bearing === "began-inside"
      ? `First step ${monthDay(first)}, inside the validity: file by ${shortDate(w.closes)}, after it expires.`
      : `First step ${monthDay(first)}, before the determination: file by ${shortDate(w.closes)}${w.closes === EXPIRES ? ", the day it expires" : ""}.`;
  return { first, bearing, closes: w.closes, closeDay: dayOf(w.closes), sentence };
}
