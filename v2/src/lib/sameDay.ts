/**
 * The PERM cases filed on the same day as one case, grouped by what has
 * happened to them since.
 *
 * WHY (2026-09-26). A reader waiting on one case asks "are people who filed
 * when I did hearing back?" Case numbers carry the filing day and a serial
 * from one sequential counter, so the cases filed that day, and the handful
 * with the serials right beside yours, are exactly that cohort. USCIS
 * trackers show neighbouring receipts; no PERM site does. Every number here
 * is a public DOL record we already hold.
 *
 * Plain module so the unit project tests the grouping.
 */

export type DayGroup = "certified" | "denied" | "withdrawn" | "inLine" | "aside";

export function groupOf(status: string | null): DayGroup {
  const s = (status ?? "").trim().toUpperCase();
  if (s.startsWith("CERTIFIED")) return "certified";
  if (s.startsWith("DENIED")) return "denied";
  if (s.startsWith("WITHDRAWN")) return "withdrawn";
  if (s === "ANALYST REVIEW") return "inLine";
  return "aside";
}

export interface SameDayCase {
  caseNumber: string;
  status: string | null;
  employerName: string | null;
}

export interface SameDay {
  /** `YYYY-MM-DD`, decoded from the day code. */
  day: string;
  total: number;
  counts: Record<DayGroup, number>;
  /** Up to `each` cases either side of this one, in serial order, this one included. */
  nearby: (SameDayCase & { group: DayGroup; isThis: boolean })[];
}

/** The day code prefixes a case number shares with its day's other PERM cases. */
export function dayKey(caseNumber: string): { office: string; code: string } | null {
  const m = /^([A-Z])-(\d{3})-(\d{5})-(\d{6})$/.exec(caseNumber.trim().toUpperCase());
  if (!m) return null;
  return { office: `${m[1]}-${m[2]}`, code: m[3]! };
}

export function assembleSameDay(
  subject: string,
  day: string,
  dayCases: readonly SameDayCase[],
  each = 8,
): SameDay | null {
  const me = subject.trim().toUpperCase();
  const key = dayKey(me);
  if (!key) return null;
  const counts: Record<DayGroup, number> = { certified: 0, denied: 0, withdrawn: 0, inLine: 0, aside: 0 };
  for (const c of dayCases) counts[groupOf(c.status)] += 1;
  // Neighbours come from THIS case's own office code: serials are assigned per
  // counter, and a G-200 case is not "next to" a G-100 one.
  const sameOffice = dayCases
    .filter((c) => c.caseNumber.startsWith(`${key.office}-${key.code}-`))
    .sort((a, b) => (a.caseNumber < b.caseNumber ? -1 : a.caseNumber > b.caseNumber ? 1 : 0));
  const i = sameOffice.findIndex((c) => c.caseNumber === me);
  if (i === -1) return { day, total: dayCases.length, counts, nearby: [] };
  const nearby = sameOffice
    .slice(Math.max(0, i - each), i + each + 1)
    .map((c) => ({ ...c, group: groupOf(c.status), isThis: c.caseNumber === me }));
  return { day, total: dayCases.length, counts, nearby };
}
