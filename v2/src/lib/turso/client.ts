/**
 * The Turso (libSQL) connection, for PUBLIC DOL data only.
 *
 * WHAT LIVES BEHIND THIS CLIENT
 * -----------------------------
 * Public federal records and aggregates computed from them: the case corpus,
 * entity rankings, wage cells, and the visa bulletin history. DOL's
 * disclosure files carry no beneficiary name, so this identifies employers
 * and law firms and never an individual.
 *
 * User data is NOT here and must never be added. Accounts, a user's own
 * tracked cases, chat history and audit logs stay on Convex, which is the
 * system with auth in front of it. The database is literally named
 * `permtracker-public-data` so the boundary is visible from the dashboard.
 *
 * `server-only` is load-bearing rather than decorative: TURSO_AUTH_TOKEN
 * grants access to the whole database, and importing this module from a
 * client component would put it in the browser bundle. The import makes that
 * a build error instead of a leak.
 */
import "server-only";

import { createClient, type Client } from "@libsql/client";

let client: Client | null = null;

export function turso(): Client {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    // Loud, not silent. A missing credential that degrades to an empty
    // result set renders as "no data" - indistinguishable from a genuinely
    // empty table, which is how a whole page ships blank and passes review.
    throw new Error(
      "TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are not set. The public data " +
        "pages cannot render without them.",
    );
  }
  client = createClient({ url, authToken });
  return client;
}

/** Rows as plain objects, with libSQL's bigints narrowed to numbers. */
export async function rows<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  const rs = await turso().execute({ sql, args: args as never[] });
  return rs.rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const c of rs.columns) {
      const v = (r as unknown as Record<string, unknown>)[c];
      // libSQL returns INTEGER as bigint when it exceeds 2^53. Every count
      // and wage here is far below that, and a bigint leaking into JSON.
      // stringify throws "Do not know how to serialize a BigInt".
      o[c] = typeof v === "bigint" ? Number(v) : v;
    }
    return o as T;
  });
}

export async function one<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
): Promise<T | null> {
  const r = await rows<T>(sql, args);
  return r[0] ?? null;
}
