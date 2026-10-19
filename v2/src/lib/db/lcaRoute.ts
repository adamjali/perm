/**
 * Which database a statement goes to.
 *
 * THE H-1B LCA FILINGS LIVE IN A DATABASE FILE OF THEIR OWN (Oct 19 2026). The
 * main file is held in memory whole (`permtracker-dbcache`), and its lock stops
 * at 6 GB; the LCA table and its indexes were 2.75 GB of 6.69. A statement that
 * names `lca_cases` goes to DATABASE_LCA_URL, every other statement to
 * DATABASE_URL, with the same tokens (both servers trust one signing key). Left
 * unset, everything goes to the main file, as before the move.
 *
 * A statement can't join `lca_cases` to a table in the main file once they are
 * two servers; `lcaJoins` finds one so the client can refuse it by name.
 *
 * The same rule is in scripts/lib_db.py; both are held to
 * scripts/fixtures/lca_routing.json.
 */

export type DatabaseHome = "lca" | "main";

const LCA_TABLE_RE = /\blca_cases\b/;
const TXN_CONTROL = /^\s*(BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE)\b/i;
// A table a statement reads or writes: the name after FROM, JOIN, INTO or
// UPDATE, unless a parenthesis follows (a table-valued function like json_each).
const TABLE_REF = /\b(?:FROM|JOIN|INTO|UPDATE)\s+([A-Za-z_]\w*)\b(?!\s*\()/gi;
// A name the statement defines for itself: `WITH f AS (` or `, f AS (`.
const CTE_NAME = /(?:\bWITH(?:\s+RECURSIVE)?|,)\s*([A-Za-z_]\w*)\s+AS\s*(?:NOT\s+)?(?:MATERIALIZED\s*)?\(/gi;
// Words that can follow those four and aren't tables (`ON CONFLICT DO UPDATE SET`).
const NOT_TABLES = new Set(["set", "select", "values", "where", "default", "or", "ignore", "replace"]);

/** "lca" for a statement on the LCA table, "main" for any other, null for
 *  transaction control, which goes wherever the rest of its request goes. */
export function statementHome(sql: string): DatabaseHome | null {
  if (TXN_CONTROL.test(sql)) return null;
  return LCA_TABLE_RE.test(sql) ? "lca" : "main";
}

/** The main-file tables a statement on `lca_cases` also names. Empty means the
 *  statement can run on the LCA database alone. */
export function lcaJoins(sql: string): string[] {
  if (!LCA_TABLE_RE.test(sql)) return [];
  const own = new Set(Array.from(sql.matchAll(CTE_NAME), (m) => m[1]!.toLowerCase()));
  const found = new Set<string>();
  for (const m of sql.matchAll(TABLE_REF)) {
    const t = m[1]!;
    const lower = t.toLowerCase();
    if (t !== "lca_cases" && !own.has(lower) && !NOT_TABLES.has(lower)) found.add(t);
  }
  return [...found].sort();
}
