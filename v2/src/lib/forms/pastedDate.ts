import { MONTH_ABBR, MONTH_NAMES } from "@convex/lib/months";

/**
 * A date pasted into a date box, read into the ISO form the box stores.
 *
 * A native date field takes typed digits one part at a time and drops a paste
 * whole, so a date copied from a DOL letter, an email or a spreadsheet
 * ("March 15, 2025", "3/15/2025") lands as nothing. These are the shapes people
 * paste; anything else is null, so the box can say it couldn't read it.
 *
 * Numbers with slashes are read the US way (month first), because every form
 * this site mirrors (DOL's, USCIS's) prints dates that way. A two-digit year is
 * refused: "03/15/25" could be 1925 or 2025, and a wrong year in a deadline is
 * worse than asking. Years outside 1900 to 2100 are refused, the same range the
 * date box accepts when typed.
 */
export function parsePastedDate(text: string): string | null {
  const s = text.trim().replace(/\.$/, "").replace(/\s+/g, " ");
  if (!s) return null;

  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) return isoOf(Number(m[3]), Number(m[1]), Number(m[2]));

  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return isoOf(Number(m[1]), Number(m[2]), Number(m[3]));

  // "March 15, 2025", "Mar. 15 2025", "March 1st, 2025"
  m = /^([A-Za-z]+)\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/.exec(s);
  if (m) {
    const month = monthOf(m[1] ?? "");
    return month ? isoOf(Number(m[3]), month, Number(m[2])) : null;
  }

  // "15 March 2025", "1st Mar 2025"
  m = /^(\d{1,2})(?:st|nd|rd|th)? ([A-Za-z]+)\.?,? (\d{4})$/.exec(s);
  if (m) {
    const month = monthOf(m[2] ?? "");
    return month ? isoOf(Number(m[3]), month, Number(m[1])) : null;
  }

  return null;
}

/** 1 to 12 for a month's full name or its three-letter form ("Sept" too), else 0. */
function monthOf(word: string): number {
  const w = word.toLowerCase();
  const full = MONTH_NAMES.findIndex((n) => n.toLowerCase() === w);
  if (full >= 0) return full + 1;
  if (w === "sept") return 9;
  const abbr = MONTH_ABBR.findIndex((n) => n.toLowerCase() === w);
  return abbr >= 0 ? abbr + 1 : 0;
}

/** The ISO day, or null when the parts aren't a real calendar day in range. */
function isoOf(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1) return null;
  // Day 0 of the next month is this month's last day, so this is its length.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > last) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
