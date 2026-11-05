/**
 * One filing day's cases, as the day page shows them (owner, Oct 27 2026: open a month by
 * status, by filing day and by employer letter, down to the cases). Plain module: the page
 * reads the day's rows on the server, and the list filters and pages them in the browser.
 *
 * Every program, DOL's live record and its published files together (owner, Nov 5 2026): a
 * case the live record holds lists on its live filing day, with what the file adds (the
 * decision day, the worksite state, the wage) and the file's own day when it differs; a
 * decided case only a file holds lists on the file's day. A case is listed once.
 */

export interface DayCase {
  caseNumber: string;
  /** DOL's status word as it prints it. */
  status: string;
  employer: string;
  /** The employer page's slug, or null where it has none (keepLinkableSlugs clears it). */
  employerSlug: string | null;
  jobTitle: string;
  /** DOL has decided it. */
  final: boolean;
  /** Where it's held: the live record alone, the live record and a file, or a file alone. */
  source?: DaySource;
  /** The file's received day when it isn't the live record's filing day. */
  fileDate?: string | null;
  /** DOL's decision day, from the file. */
  decided?: string | null;
  /** The worksite state, from the file. */
  state?: string | null;
  /** The offered wage as DOL printed it, with its unit ("$145,000 a year"). */
  wage?: string | null;
}

export type DaySource = "live" | "both" | "file";

/** How the day's list is ordered. */
export const DAY_SORTS = [
  { key: "employer", label: "Employer, A to Z" },
  { key: "case", label: "Case number" },
  { key: "status", label: "Status" },
  { key: "decided", label: "Decided, newest first" },
] as const;
export type DaySort = (typeof DAY_SORTS)[number]["key"];

/** One filing day in a month's calendar: cases filed, and how many DOL hasn't decided. */
export interface DayTally {
  filed: number;
  waiting: number;
}

/** The first day the day pages list: DOL's FY2020, where every program's files reach (scripts/build_filings_by_day.py). */
export const FILINGS_FROM = "2019-10-01";

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

const fold = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const ORDER: Record<DaySort, (a: DayCase, b: DayCase) => number> = {
  employer: (a, b) => a.employer.localeCompare(b.employer) || a.caseNumber.localeCompare(b.caseNumber),
  case: (a, b) => a.caseNumber.localeCompare(b.caseNumber),
  status: (a, b) => a.status.localeCompare(b.status) || a.employer.localeCompare(b.employer),
  // Undecided cases last, so the newest decisions lead.
  decided: (a, b) => (b.decided ?? "").localeCompare(a.decided ?? "") || a.employer.localeCompare(b.employer),
};

export function dayView(
  cases: readonly DayCase[],
  pick: { status: string | null; letter: string | null; page: number; q?: string | null; sort?: DaySort | null },
): DayView {
  // Every word must appear in the case number, the employer or the job, whatever the punctuation.
  const words = fold(pick.q ?? "").split(" ").filter(Boolean);
  const hay = (x: DayCase) => fold(`${x.caseNumber} ${x.employer} ${x.jobTitle}`);
  const kept = cases
    .filter((x) => (!pick.status || x.status === pick.status) && (!pick.letter || letterOf(x.employer) === pick.letter))
    .filter((x) => words.length === 0 || words.every((w) => hay(x).includes(w)))
    .sort(ORDER[pick.sort && pick.sort in ORDER ? pick.sort : "employer"]);
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
