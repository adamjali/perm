/**
 * The per-case record of what DOL did on a given day, over `perm_case_events`.
 *
 * WHY THIS EXISTS SEPARATELY FROM `daily_decisions`. That table answers "how
 * many", which is the shape of the queue. This one answers "which cases, and
 * what did they move from and to", which is the only view that shows an RFI
 * being issued, an appeal opening, or a denial landing on a named employer.
 * A count cannot show a transition, because a count has no `from`.
 *
 * TWO CLASSES OF ROW LIVE IN THAT TABLE AND ONLY ONE OF THEM HAPPENED THAT DAY.
 *
 * A sweep observes a case's status and records the difference against what we
 * last held. When the sweep is new, or when it re-reads a corpus it has never
 * checked, that difference can be months old: the event is dated when we SAW
 * it, not when DOL did it. Measured on 2026-08-28, the first full sweep wrote
 * 92,113 `CERTIFIED -> CERTIFIED - EXPIRED` rows under two timestamps. Not one
 * of those expiries happened that day. They are 180-day I-140 windows that
 * lapsed across two years and were all noticed at once.
 *
 * Rendering that as "94,581 cases changed on 28 August" would be a fabricated
 * surge on the busiest-looking day in the record - the same defect the RFI
 * funnel guards against by filtering on source, one class down.
 *
 * SO THE FEED IS FILTERED TWICE, ON WHAT THE ROWS MEAN:
 *
 *   1. EXPIRY IS NOT AN ADJUDICATION. `CERTIFIED -> CERTIFIED - EXPIRED` is a
 *      clock running out, not DOL acting on a case. It is excluded by status,
 *      which removes the backfill and is the correct product rule anyway: this
 *      page reports decisions, and nobody decided anything.
 *   2. A BULK WRITE IS NOT A DAY'S WORK. Any single timestamp carrying more
 *      than `BULK_WRITE_ROWS` rows is a sweep catching up, not a day of
 *      adjudication, so the whole timestamp is dropped. The threshold sits far
 *      above a real day (DOL's busiest measured day is ~1,900 decisions) and
 *      far below a backfill (92k), and the gap between those is three orders of
 *      magnitude, so no plausible real day is at risk.
 *
 * Both filters are stated on the page rather than applied silently, because a
 * feed that quietly drops rows is indistinguishable from one with no data.
 */
import "server-only";

import { rows } from "./client";

/**
 * A status pair that records a lapsed certification rather than a decision.
 * Kept as a pair, not a single status: `-> CERTIFIED - EXPIRED` is mechanical,
 * but a case arriving at `CERTIFIED` is exactly what we want to show.
 */
const EXPIRY_FROM = "CERTIFIED";
const EXPIRY_TO = "CERTIFIED - EXPIRED";

/**
 * Rows under one timestamp above which the write is a catch-up sweep.
 *
 * DOL's heaviest measured day in the disclosure corpus is under 2,000
 * decisions; the 2026-08-28 backfill wrote 92,113 under one stamp. Anything
 * over this is not a day of work.
 */
const BULK_WRITE_ROWS = 5000;

export interface CaseChange {
  caseNumber: string;
  /** ISO date the change was OBSERVED, which is not necessarily when it happened. */
  observedOn: string;
  fromStatus: string;
  toStatus: string;
  /** True once the case has reached a status DOL does not move it out of. */
  isFinal: boolean;
  employerName: string | null;
  employerSlug: string | null;
  jobTitle: string | null;
  /** Filing date, `YYYY-MM-DD`, when the live corpus carries one. */
  filingDate: string | null;
}

export interface ChangeDay {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** Adjudication events observed that day, after both filters. */
  total: number;
}

/** Transition counts for one day, most common first. */
export interface TransitionCount {
  fromStatus: string;
  toStatus: string;
  n: number;
}

export interface ChangeFeed {
  /** The day rendered, `YYYY-MM-DD`. */
  date: string;
  /** Every adjudication event we observed that day, newest employer first. */
  changes: CaseChange[];
  /** How many there were in total, which can exceed `changes.length`. */
  total: number;
  /** The shape of the day: which transitions, how many of each. */
  transitions: TransitionCount[];
  /** Days that carry at least one adjudication event, newest first. */
  availableDays: ChangeDay[];
  /** Earliest day any event was observed. Coverage starts here, not earlier. */
  observedSince: string | null;
  /** Mechanical expiries excluded from this day, for the disclosure line. */
  expiriesExcluded: number;
}

/**
 * The SQL predicate that keeps only adjudication events.
 *
 * Written once and shared by every query in this module: a feed and its own
 * day-list computed under different predicates would disagree about which days
 * have data, and the reader would click a day and be told there is nothing in
 * it. Same defect class as a checker that cannot see its subject.
 */
function adjudicationOnly(alias = ""): string {
  const c = alias ? `${alias}.` : "";
  return `NOT (${c}from_status = ? AND ${c}to_status = ?)
      AND ${c}changed_at NOT IN (
        SELECT changed_at FROM perm_case_events
         GROUP BY changed_at HAVING COUNT(*) > ?
      )`;
}
const ADJUDICATION_ARGS = [EXPIRY_FROM, EXPIRY_TO, BULK_WRITE_ROWS];

/** Days carrying adjudication events, newest first. */
export async function getChangeDays(limit = 30): Promise<ChangeDay[]> {
  const r = await rows<Record<string, unknown>>(
    `SELECT DATE(changed_at / 1000, 'unixepoch') AS d, COUNT(*) AS n
       FROM perm_case_events
      WHERE ${adjudicationOnly()}
      GROUP BY d ORDER BY d DESC LIMIT ?`,
    [...ADJUDICATION_ARGS, limit],
  );
  return r.map((row) => ({
    date: String(row.d ?? ""),
    total: Number(row.n ?? 0),
  }));
}

/**
 * One day's adjudication events, with the employer attached.
 *
 * The join is LEFT: an event can arrive for a case the live corpus has not
 * named yet (a discovery writes the status before the next sweep fills the
 * employer), and dropping those rows would under-report the day rather than
 * showing a case with a blank employer, which is the honest rendering.
 */
export async function getChangeFeed(
  date: string | null,
  limit = 100,
): Promise<ChangeFeed | null> {
  const days = await getChangeDays(60);
  if (days.length === 0) return null;

  const wanted = date && days.some((d) => d.date === date) ? date : days[0]!.date;
  const day = days.find((d) => d.date === wanted)!;

  const [changeRows, transitionRows, expiryRows] = await Promise.all([
    rows<Record<string, unknown>>(
      `SELECT e.case_number, e.from_status, e.to_status, e.to_final,
              s.employer_name, s.job_title, s.filing_date
         FROM perm_case_events e
         LEFT JOIN perm_case_status s ON s.case_number = e.case_number
        WHERE DATE(e.changed_at / 1000, 'unixepoch') = ?
          AND ${adjudicationOnly("e")}
        ORDER BY s.employer_name IS NULL, s.employer_name, e.case_number
        LIMIT ?`,
      [wanted, ...ADJUDICATION_ARGS, limit],
    ),
    rows<Record<string, unknown>>(
      `SELECT from_status, to_status, COUNT(*) AS n
         FROM perm_case_events
        WHERE DATE(changed_at / 1000, 'unixepoch') = ?
          AND ${adjudicationOnly()}
        GROUP BY from_status, to_status ORDER BY n DESC`,
      [wanted, ...ADJUDICATION_ARGS],
    ),
    rows<Record<string, unknown>>(
      `SELECT COUNT(*) AS n FROM perm_case_events
        WHERE DATE(changed_at / 1000, 'unixepoch') = ?
          AND from_status = ? AND to_status = ?`,
      [wanted, EXPIRY_FROM, EXPIRY_TO],
    ),
  ]);

  return {
    date: wanted,
    total: day.total,
    changes: changeRows.map((row) => ({
      caseNumber: String(row.case_number ?? ""),
      observedOn: wanted,
      fromStatus: String(row.from_status ?? ""),
      toStatus: String(row.to_status ?? ""),
      isFinal: Number(row.to_final ?? 0) === 1,
      employerName: row.employer_name ? String(row.employer_name) : null,
      employerSlug: null,
      jobTitle: row.job_title ? String(row.job_title) : null,
      filingDate: row.filing_date ? String(row.filing_date) : null,
    })),
    transitions: transitionRows.map((row) => ({
      fromStatus: String(row.from_status ?? ""),
      toStatus: String(row.to_status ?? ""),
      n: Number(row.n ?? 0),
    })),
    availableDays: days,
    observedSince: days[days.length - 1]?.date ?? null,
    expiriesExcluded: Number(expiryRows[0]?.n ?? 0),
  };
}
