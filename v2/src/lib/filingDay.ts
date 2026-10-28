/**
 * One filing day's cases, as the day page shows them (owner, Oct 27 2026: open a month by
 * status, by filing day and by employer letter, down to the cases). Plain module: the page
 * reads the day's rows on the server, and the list filters and pages them in the browser.
 */

export interface DayCase {
  caseNumber: string;
  /** DOL's status word as it prints it. */
  status: string;
  employer: string;
  jobTitle: string;
  /** DOL has decided it. */
  final: boolean;
}

/** One filing day in a month's calendar: cases filed, and how many DOL hasn't decided. */
export interface DayTally {
  filed: number;
  waiting: number;
}

/** Cases a page of the day's list shows. */
export const DAY_PAGE_SIZE = 50;

/** The letter a name is filed under: its first letter, or # for a digit or a symbol. */
export function letterOf(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
}

export interface DayView {
  rows: DayCase[];
  /** Cases the picks leave. */
  total: number;
  /** The page shown, 1-based, never past the last. */
  page: number;
  pageCount: number;
  /** Every status on the day, busiest first, counted over the whole day. */
  statuses: { status: string; n: number }[];
  /** Every letter on the day, in order, counted over the whole day. */
  letters: { letter: string; n: number }[];
}

const tally = (keys: string[]) => {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
};

export function dayView(cases: readonly DayCase[], pick: { status: string | null; letter: string | null; page: number }): DayView {
  const kept = cases.filter((x) => (!pick.status || x.status === pick.status) && (!pick.letter || letterOf(x.employer) === pick.letter));
  const pageCount = Math.max(1, Math.ceil(kept.length / DAY_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(pick.page) || 1), pageCount);
  const statuses = [...tally(cases.map((x) => x.status))]
    .map(([status, n]) => ({ status, n }))
    .sort((a, b) => b.n - a.n || a.status.localeCompare(b.status));
  const letters = [...tally(cases.map((x) => letterOf(x.employer)))]
    .map(([letter, n]) => ({ letter, n }))
    .sort((a, b) => a.letter.localeCompare(b.letter));
  return { rows: kept.slice((page - 1) * DAY_PAGE_SIZE, page * DAY_PAGE_SIZE), total: kept.length, page, pageCount, statuses, letters };
}

/** The day an address names, `YYYY-MM-DD`, or null when it isn't a real day up to today. */
export function filingDayOf(month: string, day: string, today: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^\d{2}$/.test(day)) return null;
  const iso = `${month}-${day}`;
  const t = Date.parse(`${iso}T12:00:00Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== iso) return null;
  return iso <= today ? iso : null;
}
