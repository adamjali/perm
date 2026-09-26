import "server-only";

import { rows } from "./client";

/**
 * Which columns a table has, read from the table itself and cached.
 *
 * WHY THE SEARCH ASKS. The case search reads two PERM tables whose columns
 * arrive at different times: `perm_cases` gains the worker and industry
 * columns when the quarterly loader first runs with them, and
 * `perm_cases_history` is loaded once by `scripts/ingest_perm_history.py`.
 * Naming a column that is not there yet throws `no such column` and, behind
 * the search's per-source catch, silently empties the whole published half.
 * Asking first turns an absent column into NULL in the row and "no match" for
 * a filter on it, and an absent table into a half that contributes nothing.
 *
 * `SELECT * ... LIMIT 1`, not `PRAGMA table_info`: production reads through a
 * READ-ONLY token, and a plain SELECT is the one statement shape certain to be
 * allowed there. It costs one row read, once per cache window per instance.
 * An empty table answers with no row and so no column names, which reads as
 * "unknown"; every caller treats unknown as "assume nothing beyond the base".
 *
 * A failed read is not cached: a transient error must not hide a table for the
 * next ten minutes.
 */

const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; cols: Promise<Set<string>> }>();

export function tableColumns(table: string): Promise<Set<string>> {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`not a table name: ${table}`);
  const hit = cache.get(table);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cols;
  const cols = rows<Record<string, unknown>>(`SELECT * FROM ${table} LIMIT 1`)
    .then((r) => new Set(r[0] ? Object.keys(r[0]) : []))
    .catch(() => {
      cache.delete(table);
      return new Set<string>();
    });
  cache.set(table, { at: Date.now(), cols });
  return cols;
}

/** Tests and a deploy-time probe only. */
export function forgetTableColumns(): void {
  cache.clear();
}
