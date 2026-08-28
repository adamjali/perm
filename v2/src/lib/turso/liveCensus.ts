import "server-only";

import { cache } from "react";

import { one } from "./client";

/**
 * The live-mirror census, read once per request instead of aggregated per
 * request.
 *
 * WHY THIS EXISTS. `/perm-case-status?case=` renders dynamically, and before
 * this doc every render aggregated the 414k-row mirror live: a full status
 * count, an unbounded ahead-of-month index range, a whole-table month
 * group-by, and a bare COUNT(*). Measured, one lookup cost ~1.8M row reads -
 * which is how a month of modest crawler traffic burned through a 500M
 * row-read budget. The ingest now writes `perm_docs['live_census']` after
 * every run (2x daily), and this module folds everything the pages used to
 * ask SQL for out of that one row.
 *
 * THE MATRIX IS THE WHOLE TRUTH, in the same row shape `foldBacklogRows`
 * already consumes: one row per (filing month, status, is_final) with its
 * count. Every derivation is a fold, so the headline figures and the month
 * board can never disagree with each other - they are the same rows.
 */

export interface CensusMatrixRow {
  month: string;
  status: string;
  is_final: number;
  n: number;
}

export interface LiveCensus {
  /** ISO date the ingest computed this census. */
  asOf: string;
  /** Every case in the mirror, including rows with no filing date. */
  totalCases: number;
  /** Rows excluded from the matrix because they carry no filing date. */
  noFilingDate: number;
  /** Attribution string, carried through to pages that cite it. */
  source: string;
  matrix: CensusMatrixRow[];
  /** ms epoch of the perm_docs write. */
  computedAt: number;
}

/**
 * A census older than this is treated as absent. The ingest runs twice a day
 * and `ingest-health` alerts within 24 hours of it going quiet, so eight days
 * of staleness means alerting failed too - at which point a stale queue
 * position reads as a current one, which is worse than an empty state.
 */
const MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;

function isMatrixRow(x: unknown): x is CensusMatrixRow {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.month === "string" &&
    typeof r.status === "string" &&
    (r.is_final === 0 || r.is_final === 1) &&
    typeof r.n === "number" &&
    Number.isFinite(r.n)
  );
}

/**
 * Parse and validate one census doc. Pure, so the rejection rules are
 * testable without a database.
 *
 * ALL-OR-NOTHING ON PURPOSE. A matrix with one malformed row dropped would
 * still fold into plausible numbers - a smaller backlog, a shorter queue -
 * and nothing downstream could tell. The reconciliation check is the same
 * idea: sum(matrix) + noFilingDate must equal totalCases, or the writer's
 * two queries saw different tables and every figure is suspect.
 */
export function parseLiveCensusDoc(
  json: string,
  computedAt: number,
  now: number,
): LiveCensus | null {
  if (now - computedAt > MAX_AGE_MS) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const d = parsed as Record<string, unknown>;
  if (
    typeof d.asOf !== "string" ||
    typeof d.totalCases !== "number" ||
    typeof d.noFilingDate !== "number" ||
    typeof d.source !== "string" ||
    !Array.isArray(d.matrix) ||
    !d.matrix.every(isMatrixRow)
  ) {
    return null;
  }
  const matrix = d.matrix as CensusMatrixRow[];
  const sum = matrix.reduce((a, r) => a + r.n, 0);
  if (sum + d.noFilingDate !== d.totalCases) return null;
  return {
    asOf: d.asOf,
    totalCases: d.totalCases,
    noFilingDate: d.noFilingDate,
    source: d.source,
    matrix,
    computedAt,
  };
}

/**
 * One doc read per request, deduped across every caller in the render via
 * React's cache(). The lookup page calls this from caseLookup, the backlog
 * band, the mirror-size banner and the queue-ahead panel; they all share the
 * single read.
 */
export const getLiveCensus = cache(async (): Promise<LiveCensus | null> => {
  const r = await one<{ json: string; computed_at: number }>(
    "SELECT json, computed_at FROM perm_docs WHERE key = 'live_census'",
  );
  if (!r) return null;
  return parseLiveCensusDoc(String(r.json), Number(r.computed_at), Date.now());
});

// ---------------------------------------------------------------------------
// Pure folds. Each replaces a query that used to run per request.
// ---------------------------------------------------------------------------

/** All of one filing month's rows. Replaces the substr(=) group-by. */
export function monthRowsFrom(
  matrix: readonly CensusMatrixRow[],
  month: string,
): CensusMatrixRow[] {
  return matrix.filter((r) => r.month === month);
}

/**
 * Pending cases filed in STRICTLY earlier months. Replaces the unbounded
 * index-range count. Decided cases have left the queue; same-month pending
 * is a different figure and stays separate. Rows with no month are position-
 * less and never count as ahead of anyone.
 */
export function aheadPendingFrom(
  matrix: readonly CensusMatrixRow[],
  month: string,
): number {
  let n = 0;
  for (const r of matrix) {
    if (r.is_final === 0 && r.month !== "" && r.month < month) n += r.n;
  }
  return n;
}

const canon = (s: string) => s.trim().toUpperCase().replace(/\s+/g, " ");

/** Cases currently in one status, across every month. Replaces a full scan. */
export function statusTotalFrom(
  matrix: readonly CensusMatrixRow[],
  status: string,
): number {
  const want = canon(status);
  let n = 0;
  for (const r of matrix) {
    if (canon(r.status) === want) n += r.n;
  }
  return n;
}

/**
 * The nearest month WITH CASES on each side, for month-page navigation.
 * A month with no cases has no page, and a link into notFound() is worse
 * than no link.
 */
export function adjacentFrom(
  matrix: readonly CensusMatrixRow[],
  month: string,
): { previous: string | null; next: string | null } {
  let previous: string | null = null;
  let next: string | null = null;
  for (const r of matrix) {
    if (r.month === "" || r.month === month) continue;
    if (r.month < month) {
      if (previous === null || r.month > previous) previous = r.month;
    } else if (next === null || r.month < next) {
      next = r.month;
    }
  }
  return { previous, next };
}
