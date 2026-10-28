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

/** One status's change between two readings of the same cases. */
export interface StatusChange {
  status: string;
  /** Which side of the line the status sits on, from the newer reading. */
  isFinal: boolean;
  /** Newer count less older count. */
  change: number;
}

export interface StatusShift {
  /** Every status whose count moved, the largest move first. */
  statuses: StatusChange[];
  /** The change in cases still waiting and in cases decided. */
  pending: number;
  decided: number;
  /** The change in cases held: filings found since the older reading, less any that left. */
  total: number;
}

/**
 * How a set of cases moved between two readings, status by status: today's
 * live count against a past day's replayed one (`perm_census_days`), for one
 * filing month or for every month together. Both sides are counts of the same
 * kind, so the difference is DOL's work plus the filings found in between.
 */
export function statusShift(now: readonly BacklogStatusCount[], before: readonly BacklogStatusCount[]): StatusShift {
  const byStatus = new Map<string, StatusChange>();
  for (const s of before) byStatus.set(s.status, { status: s.status, isFinal: s.isFinal, change: -s.count });
  for (const s of now) {
    const held = byStatus.get(s.status);
    byStatus.set(s.status, { status: s.status, isFinal: s.isFinal, change: s.count + (held ? held.change : 0) });
  }
  const statuses = [...byStatus.values()]
    .filter((s) => s.change !== 0)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.status.localeCompare(b.status));
  let pending = 0;
  let decided = 0;
  for (const s of statuses) {
    if (s.isFinal) decided += s.change;
    else pending += s.change;
  }
  return { statuses, pending, decided, total: pending + decided };
}
