/**
 * DOL processing times, read from Turso.
 *
 * Written by scripts/ingest_processing_times.mts, which runs the SAME parser
 * the Convex action used (convex/lib/dolProcessingTimes.ts, unmodified) so
 * the stored shape is identical and nothing had to be re-derived.
 *
 * ON THE HISTORY, AND BE HONEST ABOUT IT. The series is keyed by DOL's own
 * as-of date, and this store began on 2026-08-25, so it holds one point until
 * DOL republishes. The older series is still sitting in the disabled Convex
 * deployment; if that is ever re-enabled it can be backfilled here. Until
 * then a "watch the queue move" chart has one point, and a chart that draws a
 * trend through one point would be inventing one.
 */
import "server-only";

import { one, rows } from "./client";

// Re-exported from the parser so there is exactly one declaration of these
// shapes. Writing a second set here is how a field quietly acquires a
// different name on the read side than the write side.
export type {
  PermQueueRow,
  PermDeterminationRow,
  PwdQueueRow,
  PwdBacklogRow,
} from "../../../convex/lib/dolProcessingTimes";
import type {
  PermQueueRow,
  PermDeterminationRow,
  PwdQueueRow,
  PwdBacklogRow,
} from "../../../convex/lib/dolProcessingTimes";

export interface ProcessingTimesSnapshot {
  permAsOf: string;
  permQueues: PermQueueRow[];
  permAverageDays: PermDeterminationRow[];
  pwdAsOf: string | null;
  pwdQueues: PwdQueueRow[];
  pwdPermBacklog: PwdBacklogRow[];
  sourceUrl: string;
  fetchedAt: number;
}

function hydrate(r: { json: string; fetched_at: number }): ProcessingTimesSnapshot {
  return { ...(JSON.parse(r.json) as object), fetchedAt: r.fetched_at } as ProcessingTimesSnapshot;
}

/** The newest snapshot, or null if the ingest has never run. */
export async function getProcessingTimes(): Promise<ProcessingTimesSnapshot | null> {
  const r = await one<{ json: string; fetched_at: number }>(
    "SELECT json, fetched_at FROM processing_times ORDER BY perm_as_of DESC LIMIT 1",
  );
  return r ? hydrate(r) : null;
}

/**
 * The stored series, newest first.
 *
 * Clamped at BOTH ends, carried over from the Convex query for the same
 * reason it existed there: `limit` reaches this from an unauthenticated
 * caller, and -1 and NaN both used to pass through unchallenged.
 */
export async function getProcessingTimesHistory(
  limit?: number,
): Promise<ProcessingTimesSnapshot[]> {
  const requested = Math.floor(limit ?? 24);
  const n = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 120) : 24;
  const r = await rows<{ json: string; fetched_at: number }>(
    "SELECT json, fetched_at FROM processing_times ORDER BY perm_as_of DESC LIMIT ?",
    [n],
  );
  return r.map(hydrate);
}
