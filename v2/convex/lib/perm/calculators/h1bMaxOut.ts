import { addDays, addYears, differenceInCalendarDays, format, parseISO } from "date-fns";

/**
 * The H-1B six-year limit against the PERM 365-day rule.
 *
 * INA 214(g)(4) caps H-1B status at six years. AC21 section 106(a), at
 * 8 CFR 214.2(h)(13)(iii)(D), lets an employer keep extending in one-year
 * increments beyond the sixth year if a labor certification (the PERM) or an
 * I-140 was FILED at least 365 days before the request for the extension
 * takes effect, and the case has not been denied or abandoned. Section 104(c),
 * at (h)(13)(iii)(E), separately allows three-year extensions once an I-140
 * is approved and a visa number is not available. So the date that matters
 * to someone planning a PERM is the last day a filing still lands 365 days
 * before the sixth anniversary of H-1B status.
 *
 * WHAT THIS DOES NOT DO. Time spent outside the United States does not count
 * toward the six years and can be recaptured; the caller may pass those days
 * and they are added to the max-out date, but the calculator cannot know
 * them. It counts from the H-1B start date the caller gives, which should
 * be the first day in H-1B status (or the earliest H-1B start when there
 * were gaps in other statuses; L-1 time counts too under 214(g)(4) and
 * (h)(13)(iii)(A) for the combined six years, which the caller must fold
 * into the start date). None of this is legal advice; the citations are the
 * primary sources.
 */

export const H1B_MAX_YEARS = 6;
export const PERM_ADVANCE_DAYS = 365;

export interface H1bMaxOutInput {
  /** First day of H-1B (or combined H-1B/L-1) status, YYYY-MM-DD. */
  h1bStart: string;
  /** Days physically outside the United States during H-1B status, recapturable. Default 0. */
  daysOutside?: number;
  /** The PERM's filing date, or the date it is planned for, YYYY-MM-DD. Optional. */
  permFiled?: string;
}

export interface H1bMaxOutResult {
  /** The sixth anniversary of H-1B status, plus any recaptured days. */
  maxOutDate: string;
  /** The last day a PERM (or I-140) filing is still 365 days before max-out. */
  permFileBy: string;
  /** Days from today's caller-supplied reference to permFileBy; null when no reference. */
  daysOfMargin: number | null;
  /** When permFiled was given: whether it meets the 365-day rule, and by how many days. */
  perm: { filed: string; qualifies: boolean; daysBeforeMaxOut: number } | null;
  citations: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function calculateH1bMaxOut(input: H1bMaxOutInput, today?: string): H1bMaxOutResult {
  if (!DATE_RE.test(input.h1bStart)) throw new Error("h1bStart must be YYYY-MM-DD");
  const outside = Math.max(0, Math.floor(input.daysOutside ?? 0));
  const start = parseISO(input.h1bStart);
  // The sixth anniversary is the first day OUT of status, so the last day in
  // status is the day before; recaptured days push it later.
  const maxOut = addDays(addYears(start, H1B_MAX_YEARS), outside - 1);
  const fileBy = addDays(maxOut, -PERM_ADVANCE_DAYS);
  let perm: H1bMaxOutResult["perm"] = null;
  if (input.permFiled) {
    if (!DATE_RE.test(input.permFiled)) throw new Error("permFiled must be YYYY-MM-DD");
    const filed = parseISO(input.permFiled);
    const daysBefore = differenceInCalendarDays(maxOut, filed);
    perm = { filed: input.permFiled, qualifies: daysBefore >= PERM_ADVANCE_DAYS, daysBeforeMaxOut: daysBefore };
  }
  const daysOfMargin = today && DATE_RE.test(today) ? differenceInCalendarDays(fileBy, parseISO(today)) : null;
  return {
    maxOutDate: format(maxOut, "yyyy-MM-dd"),
    permFileBy: format(fileBy, "yyyy-MM-dd"),
    daysOfMargin,
    perm,
    citations: [
      "INA 214(g)(4): six-year limit on H-1B status",
      "AC21 section 106(a); 8 CFR 214.2(h)(13)(iii)(D): one-year extensions when the PERM or I-140 was filed 365 days or more before the sixth-year limit",
      "AC21 section 104(c); 8 CFR 214.2(h)(13)(iii)(E): three-year extensions with an approved I-140 and no visa number available",
    ],
  };
}
