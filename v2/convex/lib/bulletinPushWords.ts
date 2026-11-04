/**
 * What a bulletin notification says: the new bulletin, and what it did to the reader's own line, in the
 * words a line page uses. Cutoffs arrive as State prints them in the archive (visa_bulletins.final_action):
 * "01APR25", or "C" (Current: open to every priority date) and "U" (Unavailable: no visa numbers).
 */

import { longDate, MONTH_NAMES } from "./months";
import { lineName } from "./bulletinLineNames";
import type { CountryKey } from "./perm/calculators/priorityDate";

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

/** "01APR25" -> "2025-04-01"; null for "C", "U" or anything else. Years 50 to 99 are the 1900s. */
export function cutoffIso(cutoff: string): string | null {
  const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec(cutoff.trim().toUpperCase());
  if (!m || !MONTHS[m[2]!]) return null;
  const yy = Number(m[3]);
  return `${yy >= 50 ? 1900 + yy : 2000 + yy}-${MONTHS[m[2]!]}-${m[1]}`;
}

/** A cutoff in words: "April 1, 2025", "Current" or "Unavailable"; an unreadable cell as State printed it. */
export function cutoffWords(cutoff: string): string {
  if (cutoff === "C") return "Current";
  if (cutoff === "U") return "Unavailable";
  const iso = cutoffIso(cutoff);
  return (iso && longDate(iso)) || cutoff;
}

export interface BulletinPush {
  title: string;
  body: string;
}

/** "2026-12" -> "December 2026". */
function monthName(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1] ?? month} ${month.slice(0, 4)}`;
}

/** The notification for one reader's line when a new bulletin is out. */
export function bulletinPushMessage(a: {
  month: string;
  category: string;
  country: CountryKey;
  from: string;
  to: string;
}): BulletinPush {
  const line = lineName(a.category, a.country);
  const title = `The ${monthName(a.month)} visa bulletin is out`;
  const { from, to } = a;
  let body: string;
  if (to === "C") body = from === "C" ? `${line} is still Current: open to every priority date.` : `${line} is now Current: open to every priority date.`;
  else if (to === "U") body = from === "U" ? `${line} is still unavailable: no visa numbers this month.` : `${line} is unavailable this month: no visa numbers.`;
  else if (from === "C") body = `${line}'s cutoff returned: ${cutoffWords(to)}, after Current.`;
  else if (from === "U") body = `${line} reopened at ${cutoffWords(to)}.`;
  else {
    const f = cutoffIso(from);
    const t = cutoffIso(to);
    if (!f || !t || f === t) body = `${line}'s final action date held at ${cutoffWords(to)}.`;
    else body = `${line}'s final action date moved ${t > f ? "forward" : "back"} to ${cutoffWords(to)}, from ${cutoffWords(from)}.`;
  }
  return { title, body: `${body} Tap to see the line.` };
}
