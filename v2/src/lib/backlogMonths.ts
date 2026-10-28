/**
 * A filing month's PERM cases by status: the shapes the queue pages draw and the
 * fold that builds them from census rows. A plain module: the queue's day picker
 * draws a past day in the browser, and a client component can't import a type
 * from a server-only module (a type-only import 404'd a whole route once).
 */

/**
 * The first day the queue can be shown on: scripts/build_census_days.py's START,
 * held equal to it by src/lib/__tests__/backlogMonths.test.ts. Aug 28 and 29
 * 2026 carried the event log's one-time backfills.
 */
export const CENSUS_DAYS_FROM = "2026-08-30";

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

export interface BacklogRow {
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
export function foldBacklogRows(raw: readonly BacklogRow[]): BacklogMonth[] {
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
