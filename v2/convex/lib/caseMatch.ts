/**
 * Finding a saved case's DOL case number from the data the attorney already
 * entered — the employer and the filing date — so they never have to type it.
 *
 * This is the pure half: turn an employer name into a safe SQL LIKE term, and
 * rank the rows the mirror returns by how close their filing date is to the
 * case's. The impure half (the mirror read, behind sign-in) is in
 * `convex/appCaseMatch.ts`.
 *
 * The whole thing only ever SUGGESTS: the attorney confirms "is this it?", so a
 * loose match is safe. `likely` is set only when there is exactly one candidate
 * in a tight date window, which is the small-employer case (one filing around
 * that date); a big employer that files many on one day returns several and no
 * single `likely`, because nothing we hold (DOL publishes no beneficiary name)
 * can tell them apart.
 *
 * @module
 */

export interface MatchRow {
  caseNumber: string;
  status: string;
  employer: string | null;
  jobTitle: string | null;
  filingDate: string | null;
}

export interface MatchResult {
  candidates: MatchRow[];
  /** The one confident match, or null when there isn't exactly one close one. */
  likely: string | null;
}

/** Form words dropped before matching an employer name. */
const SUFFIXES = new Set([
  "llc", "inc", "incorporated", "corp", "corporation", "ltd", "limited", "co",
  "company", "lp", "llp", "lllp", "pllc", "pc", "plc", "group", "holdings",
  "usa", "us", "na", "the",
]);

/** The most candidates to return for the attorney to choose among. */
export const MAX_CANDIDATES = 6;
/** A candidate this many days or fewer from the case's filing date is "close". */
export const TIGHT_WINDOW_DAYS = 14;
/** The SQL date window to pull before ranking in JS. */
export const SEARCH_WINDOW_DAYS = 45;

/**
 * A safe SQL `LIKE` term for an employer name, or null when the name has no
 * core distinctive enough to match on (so we never match half the corpus).
 */
export function employerLike(name: string): string | null {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  const words = cleaned.split(" ").filter((w) => w && !SUFFIXES.has(w));
  if (words.length === 0) return null;
  const core = words.slice(0, 2).join(" ");
  // At least four letters of signal, so a one- or two-letter core can't match
  // thousands of unrelated employers.
  if (core.replace(/ /g, "").length < 4) return null;
  return `%${core}%`;
}

function daysBetween(a: string, b: string): number {
  return Math.abs((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

/** Rank the mirror rows by filing-date proximity and pick the lone close one. */
export function rankCandidates(rows: readonly MatchRow[], filingDate: string): MatchResult {
  const dated = rows.filter((r) => r.filingDate && !Number.isNaN(Date.parse(`${r.filingDate}T00:00:00Z`)));
  const byClose = [...dated].sort(
    (a, b) => daysBetween(a.filingDate!, filingDate) - daysBetween(b.filingDate!, filingDate),
  );
  const candidates = byClose.slice(0, MAX_CANDIDATES);
  const tight = byClose.filter((r) => daysBetween(r.filingDate!, filingDate) <= TIGHT_WINDOW_DAYS);
  const likely = tight.length === 1 ? tight[0]!.caseNumber : null;
  return { candidates, likely };
}

/** `[from, to]` ISO dates, `days` either side of the filing date. */
export function dateWindow(filingDate: string, days: number): [string, string] {
  const t = Date.parse(`${filingDate}T00:00:00Z`);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return [iso(t - days * 86_400_000), iso(t + days * 86_400_000)];
}
