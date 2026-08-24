/**
 * Priority dates against the visa bulletin's employment-based cutoffs.
 *
 * Answers "is my date current, and which way is the line moving?"
 *
 * The second half is the point. Anyone can read this month's cutoff off the
 * State Department's own page, and this project cannot even fetch that page:
 * travel.state.gov refuses automated clients, so the figures here come from
 * the Internet Archive and lag the live bulletin by a month or two. What the
 * archive gives that a single month never does is the SERIES, and a cutoff's
 * direction is the thing people actually need. Measured across the archived
 * run, EB-2 India advanced from January 2013 to July 2014 and then went
 * backwards to September 2013 before becoming unavailable outright.
 *
 * So every figure this returns is labelled with the bulletin it came from, and
 * nothing here claims to be the current month.
 */

// ============================================================================
// TYPES
// ============================================================================

export type CountryKey = "worldwide" | "china" | "india" | "mexico" | "philippines";

export type ChartKind = "finalAction" | "datesForFiling";

/** One bulletin's employment-based charts, as published. */
export interface BulletinMonth {
  /** The bulletin's own month, `YYYY-MM`. Not when it was archived. */
  bulletinMonth: string;
  finalAction: Record<string, Partial<Record<CountryKey, string>>>;
  datesForFiling: Record<string, Partial<Record<CountryKey, string>>>;
}

/**
 * A cutoff cell, which is one of three things and not simply a date.
 *
 * - `date`        a real cutoff; anyone with an earlier priority date is current
 * - `current`     printed `C`; the category is open to everyone
 * - `unavailable` printed `U`; no numbers at all this month, for anyone
 *
 * Treating `U` as "a very old date" would tell someone they are nearly there
 * when the category is in fact shut, which is the worst available answer.
 */
export type Cutoff =
  | { kind: "date"; iso: string }
  | { kind: "current" }
  | { kind: "unavailable" };

export interface PriorityDateInput {
  /** The case's priority date, `YYYY-MM-DD`. */
  priorityDate: string;
  category: string;
  country: CountryKey;
  chart: ChartKind;
  /** Bulletins in any order. The newest is used for the verdict. */
  bulletins: readonly BulletinMonth[];
}

export interface CutoffPoint {
  bulletinMonth: string;
  cutoff: Cutoff;
}

export interface PriorityDateEstimate {
  category: string;
  country: CountryKey;
  chart: ChartKind;
  /** The newest bulletin in the data. Never claimed to be the current month. */
  asOfBulletin: string | null;
  latest: Cutoff | null;
  /** True only when the priority date is on or before a real cutoff, or C. */
  isCurrent: boolean;
  /** Days between the priority date and the cutoff. Null unless both are dates. */
  daysFromCutoff: number | null;
  /** Oldest first, for plotting. */
  history: CutoffPoint[];
  /**
   * Net movement across the series, in days. Positive means the cutoff
   * advanced. Null when either end is not a real date.
   */
  netMovementDays: number | null;
  /** Months in the series where the cutoff moved backwards. */
  retrogressions: string[];
  caveats: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

/**
 * Parse a bulletin cell such as `01JAN13`, `C` or `U`.
 *
 * The two-digit year is resolved against a 50-year window. Priority dates run
 * from the late 1990s to the near future, so a cutoff of `98` is 1998 and `13`
 * is 2013; there is no bulletin cutoff far enough out for the boundary to bite.
 */
export function parseCutoff(cell: string | undefined): Cutoff | null {
  if (!cell) return null;
  const value = cell.trim().toUpperCase();
  if (value === "C") return { kind: "current" };
  if (value === "U") return { kind: "unavailable" };

  const m = /^(\d{2})([A-Z]{3})(\d{2})$/.exec(value);
  if (!m) return null;
  const day = Number(m[1]);
  const month = MONTHS[m[2]!];
  if (!month) return null;
  const yy = Number(m[3]);
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  if (day < 1 || day > 31) return null;
  return {
    kind: "date",
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/**
 * Compare a priority date against the archived bulletin series.
 *
 * Returns the whole history alongside the verdict, because the verdict alone
 * is the part that goes stale and the history is the part that does not.
 */
export function estimatePriorityDate(input: PriorityDateInput): PriorityDateEstimate {
  if (!DATE_RE.test(input.priorityDate)) {
    throw new Error(
      `priorityDate: expected YYYY-MM-DD, got ${JSON.stringify(input.priorityDate)}`,
    );
  }

  const sorted = [...input.bulletins].sort((a, b) =>
    a.bulletinMonth.localeCompare(b.bulletinMonth),
  );

  const history: CutoffPoint[] = [];
  for (const b of sorted) {
    const cell = b[input.chart]?.[input.category]?.[input.country];
    const cutoff = parseCutoff(cell);
    if (cutoff) history.push({ bulletinMonth: b.bulletinMonth, cutoff });
  }

  const newest = history.length > 0 ? history[history.length - 1]! : null;
  const latest = newest ? newest.cutoff : null;

  let isCurrent = false;
  let daysFromCutoff: number | null = null;
  if (latest?.kind === "current") {
    isCurrent = true;
  } else if (latest?.kind === "date") {
    daysFromCutoff = daysBetween(input.priorityDate, latest.iso);
    isCurrent = daysFromCutoff >= 0;
  }

  // Net movement and retrogressions, over real dates only. A month that went
  // to U is recorded as a retrogression because the category shut, which is
  // the strongest form of moving backwards.
  const dated = history.filter((h) => h.cutoff.kind === "date");
  const first = dated[0];
  const last = dated[dated.length - 1];
  const netMovementDays =
    first && last && first !== last && first.cutoff.kind === "date" && last.cutoff.kind === "date"
      ? daysBetween(first.cutoff.iso, last.cutoff.iso)
      : null;

  const retrogressions: string[] = [];
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1]!.cutoff;
    const curr = history[i]!.cutoff;
    if (curr.kind === "unavailable" && prev.kind !== "unavailable") {
      retrogressions.push(history[i]!.bulletinMonth);
    } else if (prev.kind === "date" && curr.kind === "date" && curr.iso < prev.iso) {
      retrogressions.push(history[i]!.bulletinMonth);
    }
  }

  const caveats: string[] = [];
  if (latest?.kind === "unavailable") {
    caveats.push(
      "This category was unavailable in the most recent bulletin held here. No priority date is current while that is the case, however early it is.",
    );
  }
  if (newest) {
    caveats.push(
      `These figures are from the ${newest.bulletinMonth} bulletin, which is the most recent one available here. The State Department publishes a new one every month, and cutoffs can move in either direction.`,
    );
  } else {
    caveats.push(
      "No bulletin in the record publishes a cutoff for this category and country.",
    );
  }
  if (retrogressions.length > 0) {
    caveats.push(
      `The cutoff moved backwards in ${retrogressions.length} of the ${history.length} months recorded here. A date that is current one month can stop being current the next.`,
    );
  }

  return {
    category: input.category,
    country: input.country,
    chart: input.chart,
    asOfBulletin: newest ? newest.bulletinMonth : null,
    latest,
    isCurrent,
    daysFromCutoff,
    history,
    netMovementDays,
    retrogressions,
    caveats,
  };
}
