import "server-only";

import { MS_PER_MINUTE } from "@/lib/time";

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
 * `PRAGMA table_info`, which the site's read-only token is allowed (checked on
 * production, Oct 18 2026): it names an empty table's columns too, which a
 * sample row couldn't, and answers no rows, not an error, for a table that
 * doesn't exist. Every reader that asks whether a column has arrived uses this
 * one (the decided-cases feed had its own, which took any error for "none").
 *
 * A failed read is not cached: a transient error must not hide a table for the
 * next ten minutes. And only "no such table" answers an empty set; any other
 * error throws. Answered empty, one failed read sent the employer pages back
 * to the retired name-prefix match (three other firms' 8,219 LCAs on Intel's
 * page) or to a 404, and served that as the real page for its window.
 */

const TTL_MS = 10 * MS_PER_MINUTE;
const cache = new Map<string, { at: number; cols: Promise<Set<string>> }>();

export function tableColumns(table: string): Promise<Set<string>> {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`not a table name: ${table}`);
  const hit = cache.get(table);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.cols;
  const cols = rows<{ name: string }>(`PRAGMA table_info(${table})`)
    .then((r) => new Set(r.map((c) => String(c.name))))
    .catch((err: unknown) => {
      cache.delete(table);
      throw err;
    });
  cache.set(table, { at: Date.now(), cols });
  return cols;
}

/** Tests and a deploy-time probe only. */
export function forgetTableColumns(): void {
  cache.clear();
}
