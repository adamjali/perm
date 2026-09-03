/**
 * The per-case record of what DOL did on a given day, across every FLAG
 * program we watch: PERM, prevailing wage requests, and H-1B LCAs.
 *
 * WHY THIS EXISTS SEPARATELY FROM `daily_decisions`. That table answers "how
 * many", which is the shape of the queue. This one answers "which cases, and
 * what did they move from and to", which is the only view that shows an RFI
 * being issued, an appeal opening, or a denial landing on a named employer.
 * A count cannot show a transition, because a count has no `from`.
 *
 * TWO CLASSES OF ROW LIVE IN THOSE TABLES AND ONLY ONE OF THEM HAPPENED THAT
 * DAY.
 *
 * A sweep observes a case's status and records the difference against what we
 * last held. When the sweep is new, or when it re-reads a corpus it has never
 * checked, that difference can be months old: the event is dated when we SAW
 * it, not when DOL did it. Measured on 2026-08-28, the first full sweep wrote
 * 92,113 `CERTIFIED -> CERTIFIED - EXPIRED` rows under a single timestamp, and
 * a second on 2026-08-29 wrote 45,107 more. Not one of those expiries happened
 * that day. They are 180-day I-140 windows that lapsed across two years and
 * were all noticed at once.
 *
 * Rendering that as "94,581 cases changed on 28 August" would be a fabricated
 * surge on the busiest-looking day in the record - the same defect the RFI
 * funnel guards against by filtering on source, one class down.
 *
 * SO THE FEED IS FILTERED TWICE, ON WHAT THE ROWS MEAN:
 *
 *   1. EXPIRY IS NOT AN ADJUDICATION. `CERTIFIED -> CERTIFIED - EXPIRED` is a
 *      clock running out, not DOL acting on a case. It is excluded by status
 *      PAIR, not by the destination alone: 20 rows in the corpus arrive there
 *      from `DENIED`, and folding those in would overstate the exclusion.
 *   2. A BULK WRITE IS NOT A DAY'S WORK. Any single timestamp carrying more
 *      than `BULK_WRITE_ROWS` rows is a sweep catching up, not a day of
 *      adjudication, so the whole timestamp is dropped. The threshold sits far
 *      above a real day (DOL's busiest measured day is ~1,900 decisions) and
 *      far below a backfill (94,523), and the gap between those is three orders
 *      of magnitude, so no plausible real day is at risk.
 *
 * Both filters are stated on the page rather than applied silently, because a
 * feed that quietly drops rows is indistinguishable from one with no data, and
 * both counts are carried out of here for that purpose.
 *
 * WHERE THE READS GO, AND WHY THE SHAPE CHANGED (2026-09-03)
 * ---------------------------------------------------------
 * Turso bills rows READ, and this module used to be a cost bug. Every query
 * matched the day with `DATE(changed_at / 1000, 'unixepoch') = ?`, which is an
 * expression over the indexed column and therefore unindexable, and every one
 * also carried `changed_at NOT IN (SELECT ... GROUP BY changed_at HAVING
 * COUNT(*) > ?)`, an unbounded second pass. Measured with EXPLAIN QUERY PLAN
 * against production, one feed request ran four statements over a
 * 147,328-row table:
 *
 *     SCAN perm_case_events                    x3   (day list, feed, transitions)
 *     SCAN perm_case_events USING COVERING ... x3   (the NOT IN subquery)
 *     SEARCH ... case_events_status_time            (the expiry count)
 *
 * roughly 977,000 rows read to render at most 1,090. Two changes fix it and
 * neither one changes a published number:
 *
 *   - THE DAY IS A RANGE, NOT AN EXPRESSION. `changed_at >= lo AND < hi` with
 *     the bounds computed in JS from the ISO date. `DATE(x/1000,'unixepoch')`
 *     is UTC, so the bounds are UTC midnights and the two forms select exactly
 *     the same rows. The plan becomes
 *     `SEARCH e USING INDEX case_events_recent (changed_at>? AND changed_at<?)`.
 *   - THE CALENDAR IS COMPUTED ONCE, ON THE PAGE, NOT PER REQUEST. The picker's
 *     day list only changes when the sweep runs, and the client already holds
 *     it from the prerendered HTML, so the API path never recomputes it.
 *
 * The bulk-write rule is applied in TypeScript, from a per-timestamp roll-up,
 * rather than in SQL in three places. There are 15 distinct timestamps in
 * 147,328 rows (the sweep writes one per run), so the roll-up returns 15 rows
 * and one pass answers "which timestamps are backfills", "how many
 * adjudications per day" and "how many expiries per day" together.
 */
import "server-only";

import { rows } from "./client";
// The program list and its labels are a PLAIN module: this one is
// `server-only`, and the browser needs the same labels for its column and
// its filter. One definition, reachable from both sides.
import { CHANGE_PROGRAMS, type ChangeProgram } from "@/lib/changeProgram";

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
 * decisions; the 2026-08-28 backfill wrote 94,523 under one stamp. Anything
 * over this is not a day of work.
 */
const BULK_WRITE_ROWS = 5000;

/**
 * How far back the calendar looks.
 *
 * The picker offers `DAY_LIST_LIMIT` days, so the roll-up only has to reach a
 * little further than that. Without a floor the calendar is an unbounded scan
 * that grows with the record - at roughly 1,500 event rows a day it would pass
 * half a million within a year, read in full every time the page regenerates.
 * `observedSince` is read separately with `MIN(changed_at)`, an index seek, so
 * the floor never hides how far back the record really goes.
 */
const CALENDAR_WINDOW_DAYS = 90;

/** Days offered by the picker, newest first. */
export const DAY_LIST_LIMIT = 60;

/**
 * The most rows one day's feed will carry.
 *
 * A day cannot legitimately exceed this by much: any single timestamp over
 * `BULK_WRITE_ROWS` is dropped whole as a backfill, and a day normally holds
 * one or two timestamps. The busiest day in the record holds 1,090 rows, which
 * is 267 KB of JSON and 24 KB over the wire. The cap exists so a future
 * anomaly cannot ship a several-megabyte response, and any truncation is
 * stated on the page rather than silently applied.
 */
export const DAY_ROW_CAP = 5000;

const MS_PER_DAY = 86_400_000;

/**
 * Each program keeps its own pair of tables, deliberately.
 *
 * They are not one table with a `program` column because the PERM tables feed
 * the census, the stage pages, the RFI funnel and the alert sweep, all written
 * against a PERM status vocabulary. The mechanics of reading them are
 * identical, which is what this map is for.
 */
const TABLES: Record<ChangeProgram, { events: string; status: string }> = {
  perm: { events: "perm_case_events", status: "perm_case_status" },
  pwd: { events: "pwd_case_events", status: "pwd_case_status" },
  lca: { events: "lca_case_events", status: "lca_case_status" },
};

export interface CaseChange {
  caseNumber: string;
  program: ChangeProgram;
  /** ISO date the change was OBSERVED, which is not necessarily when it happened. */
  observedOn: string;
  fromStatus: string;
  toStatus: string;
  /** True once the case has reached a status DOL does not move it out of. */
  isFinal: boolean;
  employerName: string | null;
  jobTitle: string | null;
  /** Filing date, `YYYY-MM-DD`, when the live corpus carries one. */
  filingDate: string | null;
}

export interface ChangeDay {
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** Adjudication events observed that day, after both filters. */
  total: number;
  /** The same total split by program, so an empty program says so. */
  byProgram: Record<ChangeProgram, number>;
}

/** Transition counts for one day, most common first. */
export interface TransitionCount {
  fromStatus: string;
  toStatus: string;
  n: number;
}

/** The picker's day list, plus how far back the record itself goes. */
export interface ChangeCalendar {
  /** Days carrying at least one adjudication event, newest first. */
  days: ChangeDay[];
  /** Earliest day any event was observed. Coverage starts here, not earlier. */
  observedSince: string | null;
  /** Earliest day each program was observed, or null if never. */
  programSince: Record<ChangeProgram, string | null>;
  /** True when the record runs further back than the offered days. */
  truncated: boolean;
}

export interface ChangeDayFeed {
  /** The day rendered, `YYYY-MM-DD`. */
  date: string;
  /** The day's adjudication events, capped at `DAY_ROW_CAP`. */
  changes: CaseChange[];
  /** How many there were in total, which can exceed `changes.length`. */
  total: number;
  /** The same total split by program. */
  byProgram: Record<ChangeProgram, number>;
  /**
   * The shape of the day: which transitions, how many of each. Computed over
   * the WHOLE day rather than over `changes`, so the filter options a reader
   * is offered are complete even when the row list is capped.
   */
  transitions: TransitionCount[];
  /** Mechanical expiries excluded from this day, for the disclosure line. */
  expiriesExcluded: number;
  /** Rows dropped because their timestamp was a catch-up sweep. */
  bulkExcluded: number;
}

/** UTC midnight bounds for an ISO date, matching `DATE(x/1000,'unixepoch')`. */
function dayBounds(date: string): { lo: number; hi: number } | null {
  const lo = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(lo)) return null;
  return { lo, hi: lo + MS_PER_DAY };
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function emptyByProgram(): Record<ChangeProgram, number> {
  return { perm: 0, pwd: 0, lca: 0 };
}

/** One row of the per-timestamp roll-up. */
interface StampRoll {
  ts: number;
  /** Every row under this timestamp, before any filter. The bulk test. */
  n: number;
  /** How many of those are the mechanical expiry pair. */
  expiries: number;
}

async function rollUp(
  program: ChangeProgram,
  floor: number,
  ceiling?: number,
): Promise<StampRoll[]> {
  // ONE PASS PER PROGRAM, and it answers three questions at once. Grouping by
  // the indexed column means SQLite walks `case_events_recent` in order and
  // needs no temp b-tree; the bounds turn the plan from SCAN into
  // `SEARCH ... (changed_at>? AND changed_at<?)`.
  //
  // THE CEILING IS NOT OPTIONAL FOR A SINGLE DAY. Without it, asking about an
  // old day reads every timestamp from that day to the present, which is the
  // unbounded read this rewrite exists to remove.
  const r = await rows<Record<string, unknown>>(
    `SELECT changed_at AS ts, COUNT(*) AS n,
            SUM(CASE WHEN from_status = ? AND to_status = ? THEN 1 ELSE 0 END) AS expiries
       FROM ${TABLES[program].events}
      WHERE changed_at >= ?${ceiling === undefined ? "" : " AND changed_at < ?"}
      GROUP BY changed_at`,
    ceiling === undefined
      ? [EXPIRY_FROM, EXPIRY_TO, floor]
      : [EXPIRY_FROM, EXPIRY_TO, floor, ceiling],
  );
  return r.map((row) => ({
    ts: Number(row.ts ?? 0),
    n: Number(row.n ?? 0),
    expiries: Number(row.expiries ?? 0),
  }));
}

/**
 * Apply the two filters to a program's roll-up.
 *
 * IN TYPESCRIPT, NOT IN SQL, AND THAT IS THE POINT. The bulk rule used to live
 * in a `NOT IN` subquery repeated in three statements, which is three places
 * for one editorial judgement to drift and an unbounded extra pass every time
 * it ran. Here it is one comparison against a number a test can read.
 *
 * THE TEST IS ON THE TIMESTAMP'S RAW SIZE, NOT ITS POST-FILTER SIZE. The
 * 2026-08-28 backfill holds 94,523 rows of which 92,113 are expiries, leaving
 * 2,410. Testing the remainder would put that stamp under the threshold and
 * quietly restore 2,410 rows the current page correctly excludes.
 */
function foldDays(
  program: ChangeProgram,
  roll: StampRoll[],
  into: Map<string, ChangeDay>,
): void {
  for (const s of roll) {
    if (s.n > BULK_WRITE_ROWS) continue;
    const date = isoDay(s.ts);
    const day = into.get(date) ?? { date, total: 0, byProgram: emptyByProgram() };
    const kept = s.n - s.expiries;
    day.total += kept;
    day.byProgram[program] += kept;
    into.set(date, day);
  }
}

/**
 * The picker's day list, and how far back the record goes.
 *
 * READ ONCE PER PAGE REGENERATION, NEVER PER REQUEST. This is the only query
 * in the module that is not bounded to a single day, and the client already
 * holds its answer from the prerendered HTML.
 */
export async function getChangeCalendar(
  limit = DAY_LIST_LIMIT,
): Promise<ChangeCalendar> {
  const floor = Date.now() - CALENDAR_WINDOW_DAYS * MS_PER_DAY;
  const rolls = await Promise.all(
    CHANGE_PROGRAMS.map(async (p) => [p, await rollUp(p, floor)] as const),
  );

  const byDate = new Map<string, ChangeDay>();
  const programSince: Record<ChangeProgram, string | null> = {
    perm: null,
    pwd: null,
    lca: null,
  };
  for (const [program, roll] of rolls) {
    foldDays(program, roll, byDate);
    for (const s of roll) {
      if (s.n > BULK_WRITE_ROWS || s.n - s.expiries <= 0) continue;
      const d = isoDay(s.ts);
      const cur = programSince[program];
      if (cur === null || d < cur) programSince[program] = d;
    }
  }

  const all = [...byDate.values()]
    .filter((d) => d.total > 0)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const days = all.slice(0, limit);

  // `MIN(changed_at)` is an index seek, not a scan, so the true start of the
  // record costs nothing even though the roll-up above is floored.
  const firsts = await Promise.all(
    CHANGE_PROGRAMS.map(async (p) => {
      const r = await rows<Record<string, unknown>>(
        `SELECT MIN(changed_at) AS lo FROM ${TABLES[p].events}`,
      );
      const lo = Number(r[0]?.lo ?? 0);
      return Number.isFinite(lo) && lo > 0 ? isoDay(lo) : null;
    }),
  );
  const earliest = firsts.filter((d): d is string => d !== null).sort()[0] ?? null;

  return {
    days,
    observedSince: earliest,
    programSince,
    truncated: all.length > days.length,
  };
}

/** The columns one program's day query returns, before the program is attached. */
async function dayRows(
  program: ChangeProgram,
  lo: number,
  hi: number,
  bulkStamps: number[],
  limit: number,
): Promise<Record<string, unknown>[]> {
  const t = TABLES[program];
  // The bulk timestamps come from the roll-up rather than from a subquery, so
  // the statement carries no second pass over the table at all: the plan is
  // one range SEARCH plus a primary-key join.
  const drop = bulkStamps.length
    ? ` AND e.changed_at NOT IN (${bulkStamps.map(() => "?").join(", ")})`
    : "";
  return rows<Record<string, unknown>>(
    `SELECT e.case_number, e.from_status, e.to_status, e.to_final,
            s.employer_name, s.job_title, s.filing_date
       FROM ${t.events} e
       LEFT JOIN ${t.status} s ON s.case_number = e.case_number
      WHERE e.changed_at >= ? AND e.changed_at < ?
        AND NOT (e.from_status = ? AND e.to_status = ?)${drop}
      ORDER BY s.employer_name IS NULL, s.employer_name, e.case_number
      LIMIT ?`,
    [lo, hi, EXPIRY_FROM, EXPIRY_TO, ...bulkStamps, limit],
  );
}

/** The day's transitions for one program, over the whole day. */
async function dayTransitions(
  program: ChangeProgram,
  lo: number,
  hi: number,
  bulkStamps: number[],
): Promise<TransitionCount[]> {
  const drop = bulkStamps.length
    ? ` AND changed_at NOT IN (${bulkStamps.map(() => "?").join(", ")})`
    : "";
  const r = await rows<Record<string, unknown>>(
    `SELECT from_status, to_status, COUNT(*) AS n
       FROM ${TABLES[program].events}
      WHERE changed_at >= ? AND changed_at < ?
        AND NOT (from_status = ? AND to_status = ?)${drop}
      GROUP BY from_status, to_status`,
    [lo, hi, EXPIRY_FROM, EXPIRY_TO, ...bulkStamps],
  );
  return r.map((row) => ({
    fromStatus: String(row.from_status ?? ""),
    toStatus: String(row.to_status ?? ""),
    n: Number(row.n ?? 0),
  }));
}

/**
 * One day's adjudication events, across every program.
 *
 * The join is LEFT: an event can arrive for a case the live corpus has not
 * named yet (a discovery writes the status before the next sweep fills the
 * employer), and dropping those rows would under-report the day rather than
 * showing a case with a blank employer, which is the honest rendering.
 *
 * A PROGRAM WITH NOTHING THAT DAY COSTS NO QUERY. The roll-up already knows,
 * so on an ordinary day this issues one pair of statements, not three.
 */
export async function getChangeDay(
  date: string,
  limit = DAY_ROW_CAP,
): Promise<ChangeDayFeed | null> {
  const bounds = dayBounds(date);
  if (!bounds) return null;
  const { lo, hi } = bounds;
  const cap = Math.min(Math.max(1, Math.floor(limit)), DAY_ROW_CAP);

  const rolls = await Promise.all(
    CHANGE_PROGRAMS.map(async (p) => [p, await rollUp(p, lo, hi)] as const),
  );

  const byProgram = emptyByProgram();
  const bulk: Record<ChangeProgram, number[]> = { perm: [], pwd: [], lca: [] };
  let expiriesExcluded = 0;
  let bulkExcluded = 0;

  for (const [program, roll] of rolls) {
    for (const s of roll) {
      // Every expiry that day is counted, backfill stamps included: the 92,113
      // the page discloses for 2026-08-28 all sit under a bulk stamp, so
      // counting them only on surviving stamps would report zero and lose the
      // whole disclosure.
      expiriesExcluded += s.expiries;
      if (s.n > BULK_WRITE_ROWS) {
        bulk[program].push(s.ts);
        bulkExcluded += s.n - s.expiries;
        continue;
      }
      byProgram[program] += s.n - s.expiries;
    }
  }

  const total = CHANGE_PROGRAMS.reduce((sum, p) => sum + byProgram[p], 0);

  const parts = await Promise.all(
    CHANGE_PROGRAMS.map(async (program) => {
      if (byProgram[program] === 0) {
        return { program, rows: [] as Record<string, unknown>[], transitions: [] };
      }
      const [r, t] = await Promise.all([
        dayRows(program, lo, hi, bulk[program], cap),
        dayTransitions(program, lo, hi, bulk[program]),
      ]);
      return { program, rows: r, transitions: t };
    }),
  );

  const changes: CaseChange[] = [];
  const transitions: TransitionCount[] = [];
  for (const part of parts) {
    for (const row of part.rows) {
      changes.push({
        caseNumber: String(row.case_number ?? ""),
        program: part.program,
        observedOn: date,
        fromStatus: String(row.from_status ?? ""),
        toStatus: String(row.to_status ?? ""),
        isFinal: Number(row.to_final ?? 0) === 1,
        // DOL returns some employer names with a leading space. Trimmed here
        // rather than at each reader: an untrimmed name sorts before every
        // other employer and a search for its first word misses it.
        employerName: text(row.employer_name),
        jobTitle: text(row.job_title),
        filingDate: text(row.filing_date),
      });
    }
    transitions.push(...part.transitions);
  }
  transitions.sort((a, b) => b.n - a.n);

  return {
    date,
    changes: changes.slice(0, cap),
    total,
    byProgram,
    transitions,
    expiriesExcluded,
    bulkExcluded,
  };
}

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * The calendar and one day together, for the statically rendered page.
 *
 * `date` of `null` means the newest day that carries events. A date the
 * calendar does not list falls back to the newest one for the same reason the
 * picker only offers days that exist: an empty answer to "what happened on the
 * 4th" reads as "DOL did nothing", which is not what it means.
 */
export async function getChangeActivity(
  date: string | null,
  limit: number,
): Promise<{ calendar: ChangeCalendar; day: ChangeDayFeed } | null> {
  const calendar = await getChangeCalendar();
  const first = calendar.days[0];
  if (!first) return null;
  const wanted =
    date && calendar.days.some((d) => d.date === date) ? date : first.date;
  const day = await getChangeDay(wanted, limit);
  return day ? { calendar, day } : null;
}
