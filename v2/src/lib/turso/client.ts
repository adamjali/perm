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

/**
 * A per-query deadline with one retry on a fresh request.
 *
 * Added 2026-08-28, during a Turso incident their own status page called
 * degraded: most requests answered normally while a fraction HUNG - undici's
 * HeadersTimeoutError after minutes with no response headers - and one hung
 * request was enough to blow a page's whole prerender budget three times and
 * fail two production deploys. The client cannot abort libSQL's underlying
 * fetch, so the race abandons the stuck request (it times out harmlessly on
 * its own) and the retry rides a NEW connection, which is exactly what a
 * flaky-connection failure mode wants. A genuinely slow query still throws
 * after two deadlines rather than hanging a build for minutes.
 */
const QUERY_DEADLINE_MS = 20_000;

async function withDeadline<T>(run: () => Promise<T>, what: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const timer = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`turso query deadline (${QUERY_DEADLINE_MS}ms, attempt ${attempt}): ${what}`)),
        QUERY_DEADLINE_MS,
      ).unref?.(),
    );
    try {
      return await Promise.race([run(), timer]);
    } catch (e) {
      if (attempt >= 2 || !String(e).includes("turso query deadline")) throw e;
    }
  }
}

/** Rows as plain objects, with libSQL's bigints narrowed to numbers. */
export async function rows<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  const rs = await withDeadline(
    () => turso().execute({ sql, args: args as never[] }),
    sql.slice(0, 80),
  );
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

let rwClient: Client | null = null;

/**
 * The write-capable connection, used by exec() alone.
 *
 * PRODUCTION'S DEFAULT TOKEN IS READ-ONLY ON PURPOSE, and that is worth
 * keeping: the entire read layer runs on a credential that cannot corrupt
 * the corpus even if the web tier is compromised. Discovered the hard way
 * 2026-08-28 - the first write feature failed silently in prod with
 * "BLOCKED: SQL write operations are forbidden" while the same code
 * worked locally, because the local env carries a full-access token under
 * the same variable name. TURSO_RW_AUTH_TOKEN is the explicit write
 * credential; absent (local dev), the default token serves both roles.
 */
function tursoRw(): Client {
  const rw = process.env.TURSO_RW_AUTH_TOKEN;
  if (!rw) return turso();
  if (rwClient) return rwClient;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set.");
  rwClient = createClient({ url, authToken: rw });
  return rwClient;
}

/**
 * A parameterized write. The web layer was read-only until case discovery
 * (caseDiscovery.ts) needed to record lookups that miss the corpus; keep it
 * that way for everything else - aggregates are the ingest's job, and this
 * database holds public federal records only.
 */
export async function exec(sql: string, args: unknown[] = []): Promise<number> {
  const rs = await withDeadline(
    () => tursoRw().execute({ sql, args: args as never[] }),
    sql.slice(0, 80),
  );
  return rs.rowsAffected;
}
