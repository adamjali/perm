/**
 * The live backlog, per filing month AND per DOL queue stage.
 *
 * WHY THIS FILE EXISTS SEPARATELY FROM `publicData.ts`. That module already
 * reads the mirror twice - `getLiveBacklog` for month totals and
 * `getLiveCohort` for one month's status split - and neither can answer the
 * question these pages are actually for: of the cases still waiting in a
 * given month, how many are in the ordinary queue and how many have been
 * pulled out of filing order. That needs month AND status in one read, which
 * is a third shape rather than a variation on the first two.
 *
 * `perm_case_status` IS THE ONLY PLACE A PENDING CASE EXISTS. DOL's quarterly
 * disclosure files carry a decision date on every record and no pending rows
 * at all, so nothing here is derivable from them at any level of effort. That
 * is also why every figure this module returns is dated and attributed on the
 * page rather than presented as a DOL publication.
 *
 * TWO THINGS THE QUERIES DO DELIBERATELY:
 *
 * 1. They GROUP BY the raw `current_status` column, not `UPPER(...)`. There
 *    is an index on `(substr(filing_date,1,7), current_status)`, and wrapping
 *    the column in a function makes it unusable, which turns a bounded read
 *    into a full scan of 412,865 rows. Normalisation happens in TypeScript
 *    instead, where two rows differing only in case are merged rather than
 *    silently rendered as two statuses.
 *
 * 2. Pending is `is_final = 0`, never a status allow-list. Verified on the
 *    settled table: zero integrity violations across all 16 statuses. The
 *    count went from 15 to 16 while this surface was being built, because
 *    `DENIED - BALCA DISMISSED` arrived carrying one case. A hardcoded list
 *    would have absorbed that silently and kept looking healthy.
 */
import "server-only";

import { rows } from "./client";

/** One status bucket inside a filing month, or across the whole mirror. */
export interface BacklogStatusCount {
  /** Normalised to upper case, as DOL prints it. */
  status: string;
  count: number;
  isFinal: boolean;
}

/** Everything the queue surfaces need about one filing month. */
export interface BacklogMonth {
  /** Filing month, "YYYY-MM". */
  month: string;
  total: number;
  pending: number;
  decided: number;
  /** decided / total as 0-100, null when the month holds nothing. */
  decidedPct: number | null;
  /** Every status present in the month, largest first, pending and final. */
  statuses: BacklogStatusCount[];
}

interface RawRow {
  month: unknown;
  status: unknown;
  is_final: unknown;
  n: unknown;
}

/**
 * Fold raw `(month, status, is_final, n)` rows into months.
 *
 * Exported for the unit test, which is the only way to prove the case-merge
 * actually merges: the live table is canonical upper case today, so a test
 * against real data can never exercise it.
 */
export function foldBacklogRows(raw: readonly RawRow[]): BacklogMonth[] {
  const byMonth = new Map<string, Map<string, BacklogStatusCount>>();

  for (const r of raw) {
    const month = String(r.month ?? "");
    if (!month) continue;
    const status = String(r.status ?? "").toUpperCase().trim();
    if (!status) continue;
    const count = Number(r.n) || 0;
    const isFinal = Number(r.is_final) === 1;

    let bucket = byMonth.get(month);
    if (!bucket) {
      bucket = new Map();
      byMonth.set(month, bucket);
    }
    const existing = bucket.get(status);
    if (existing) {
      existing.count += count;
      // A row is final only if every row folded into it is. Disagreement here
      // would be a real integrity fault upstream, and resolving it towards
      // "still pending" is the direction that cannot understate the backlog.
      existing.isFinal = existing.isFinal && isFinal;
    } else {
      bucket.set(status, { status, count, isFinal });
    }
  }

  return [...byMonth.entries()]
    .map(([month, bucket]) => summariseMonth(month, [...bucket.values()]))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function summariseMonth(month: string, statuses: BacklogStatusCount[]): BacklogMonth {
  let pending = 0;
  let decided = 0;
  for (const s of statuses) {
    if (s.isFinal) decided += s.count;
    else pending += s.count;
  }
  const total = pending + decided;
  return {
    month,
    total,
    pending,
    decided,
    decidedPct: total > 0 ? (decided / total) * 100 : null,
    statuses: statuses.sort((a, b) => b.count - a.count),
  };
}

const MATRIX_SQL = `SELECT substr(filing_date, 1, 7) AS month,
                           current_status              AS status,
                           is_final                    AS is_final,
                           COUNT(*)                    AS n
                      FROM perm_case_status
                     WHERE filing_date IS NOT NULL AND filing_date <> ''
                     GROUP BY month, status, is_final`;

/**
 * Every filing month with its full status breakdown, oldest first.
 *
 * One read for the whole board. The alternative shape - a totals query plus
 * one status query per month - is 40 round trips for a page that renders in
 * one pass, and it can return a total and a breakdown that disagree because
 * the mirror moved between them.
 */
export async function getBacklogMatrix(): Promise<BacklogMonth[]> {
  return foldBacklogRows(await rows<RawRow>(MATRIX_SQL));
}

/**
 * One filing month, read through the index rather than sliced off the matrix.
 *
 * The month pages regenerate independently, and making each one pay for a
 * 412,865-row aggregate to render a single row is the kind of cost that only
 * shows up as a bill.
 */
export async function getMonthBacklog(month: string): Promise<BacklogMonth | null> {
  const raw = await rows<RawRow>(
    `SELECT substr(filing_date, 1, 7) AS month,
            current_status              AS status,
            is_final                    AS is_final,
            COUNT(*)                    AS n
       FROM perm_case_status
      WHERE substr(filing_date, 1, 7) = ?
      GROUP BY month, status, is_final`,
    [month],
  );
  return foldBacklogRows(raw)[0] ?? null;
}

/** The whole live population, in one shape. */
export interface BacklogCensus {
  /** Every status in the mirror, largest first. */
  statuses: BacklogStatusCount[];
  pending: number;
  decided: number;
  total: number;
  /** Filing months carrying at least one case, oldest first. */
  months: BacklogMonth[];
}

/**
 * Roll the matrix up to a single census.
 *
 * Derived from the same rows the board renders rather than read separately,
 * so the headline figure and the month list can never disagree. They did in
 * an earlier draft, by four cases, because the two queries ran a second apart
 * while the mirror was being written to.
 */
export function censusFrom(months: readonly BacklogMonth[]): BacklogCensus {
  const merged = new Map<string, BacklogStatusCount>();
  let pending = 0;
  let decided = 0;
  for (const m of months) {
    pending += m.pending;
    decided += m.decided;
    for (const s of m.statuses) {
      const existing = merged.get(s.status);
      if (existing) existing.count += s.count;
      else merged.set(s.status, { ...s });
    }
  }
  return {
    statuses: [...merged.values()].sort((a, b) => b.count - a.count),
    pending,
    decided,
    total: pending + decided,
    months: [...months],
  };
}

/** The matrix and its census in one call, for the board. */
export async function getBacklogCensus(): Promise<BacklogCensus> {
  return censusFrom(await getBacklogMatrix());
}

/** The filing months either side of one that has a page. */
export interface AdjacentMonths {
  previous: string | null;
  next: string | null;
}

/**
 * The nearest filing month on each side, for a month page's own navigation.
 *
 * READ THROUGH THE INDEX, NOT BY SUBTRACTING ONE FROM THE MONTH. A month with
 * no cases has no page, and a link to a route that renders `notFound()` is
 * worse than no link at all.
 *
 * `substr(filing_date, 1, 7)` is written out rather than compared against a
 * date literal because that expression IS the leading column of
 * `case_status_month`, so both queries are an index seek plus one row. The
 * obvious alternative, `SELECT DISTINCT substr(filing_date, 1, 7)`, measured
 * 8.6 seconds against 0.3 for this pair: DISTINCT over an expression cannot
 * use the index and sorts 412,865 rows to return 39.
 */
export async function getAdjacentMonths(month: string): Promise<AdjacentMonths> {
  const [next, previous] = await Promise.all([
    rows<{ m: unknown }>(
      `SELECT substr(filing_date, 1, 7) AS m
         FROM perm_case_status
        WHERE substr(filing_date, 1, 7) > ?
        ORDER BY 1 ASC LIMIT 1`,
      [month],
    ),
    rows<{ m: unknown }>(
      `SELECT substr(filing_date, 1, 7) AS m
         FROM perm_case_status
        WHERE substr(filing_date, 1, 7) < ? AND substr(filing_date, 1, 7) <> ''
        ORDER BY 1 DESC LIMIT 1`,
      [month],
    ),
  ]);
  return {
    previous: previous[0] ? String(previous[0].m) : null,
    next: next[0] ? String(next[0].m) : null,
  };
}

/**
 * Undecided cases filed strictly before a given month.
 *
 * What DOL has to get through before a month's own turn comes up, which is
 * the figure a person with that filing month is actually asking for.
 *
 * PENDING ONLY. A decided case in an earlier month is no longer in front of
 * anyone, and counting it would inflate the number in exactly the direction
 * that flatters a wait.
 *
 * The predicate is shaped for the `(is_final, filing_date)` index: the
 * equality first, the range on the trailing column. `filing_date < '<month>-01'`
 * rather than `substr(...) < month` for the same reason - a function around
 * the column makes the index unusable and turns this into a full scan.
 */
export async function getPendingBefore(month: string): Promise<number> {
  const r = await rows<{ n: unknown }>(
    `SELECT COUNT(*) AS n
       FROM perm_case_status
      WHERE is_final = 0 AND filing_date <> '' AND filing_date < ?`,
    [`${month}-01`],
  );
  return Number(r[0]?.n) || 0;
}
