/**
 * Read-only access to the public DOL mirror (Turso/libSQL) from Convex.
 *
 * ## Why Convex needs this at all
 *
 * The per-case corpus lives in Turso and the subscriber list lives in Convex,
 * and that split is deliberate rather than accidental. `src/lib/turso/client.ts`
 * states the boundary: Turso holds public federal records only, and user data
 * stays on Convex because Convex is the system with auth in front of it. An
 * email address is user data, so the subscriptions cannot move to Turso; the
 * case corpus is 412,865 rows of public record, so it will not move to Convex.
 * Something has to cross, and a READ of public data is the cheaper direction.
 *
 * ## Pull, not push
 *
 * The alternative was having `scripts/mirror_case_status.py` POST changed cases
 * to a Convex HTTP route. Rejected: that is a new unauthenticated-shaped
 * endpoint to defend, and a push that fails while Convex is down loses the
 * event unless Turso separately tracks delivery, which is more moving parts for
 * less. Pulling means Convex owns its own scheduling and retry, and a missed
 * run costs nothing because the next one sees the same state.
 *
 * ## What this deliberately cannot do
 *
 * `execute` refuses anything that is not a SELECT. The token in
 * `TURSO_AUTH_TOKEN` grants write access to the whole database, so the
 * restriction is a real one rather than documentation: nothing in Convex has
 * any business writing to the public corpus, which is owned end to end by the
 * ingest scripts. A guard that only says "please don't" is not a guard.
 *
 * ## Configuration
 *
 * `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` must be set on the Convex
 * deployment. They are the SAME pair the Next.js server already holds, and they
 * are not currently set on Convex, so every caller here throws until they are.
 * That is on purpose: a missing credential that degraded to an empty result set
 * would report "nothing changed" forever, which is indistinguishable from a
 * working sweep with a quiet week.
 *
 * @module convex/lib/publicMirror
 */

/** A cell as Hrana returns it. Integers arrive as strings to protect precision. */
type HranaValue =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "float"; value: number }
  | { type: "text"; value: string }
  | { type: "blob"; base64: string };

/** One value as an Hrana argument. Mirrors `lit()` in scripts/lib_turso.py. */
function lit(v: string | number | null): HranaValue {
  if (v === null) return { type: "null" };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { type: "integer", value: String(v) }
      : { type: "float", value: v };
  }
  return { type: "text", value: v };
}

/** A row as a plain object, with Hrana's string integers narrowed to numbers. */
export type Row = Record<string, string | number | null>;

function cell(v: HranaValue): string | number | null {
  switch (v.type) {
    case "null":
      return null;
    case "integer":
      return Number(v.value);
    case "float":
      return v.value;
    case "text":
      return v.value;
    default:
      // A blob has no meaning in this corpus and silently stringifying one
      // would put "[object Object]" in an email.
      return null;
  }
}

/** One statement plus its positional arguments. */
export interface Statement {
  sql: string;
  args?: (string | number | null)[];
}

/**
 * Anything that is not a single SELECT is refused before it leaves the process.
 *
 * Checked on the statement the caller actually passes, not on a caller's
 * promise about it. The trailing-semicolon strip is so `SELECT 1;` passes; the
 * embedded-semicolon check is what stops `SELECT 1; DROP TABLE x` riding along
 * as a second statement in the same string.
 */
function assertReadOnly(sql: string): void {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (!/^select\b/i.test(trimmed)) {
    throw new Error(`publicMirror is read-only; refused: ${trimmed.slice(0, 60)}`);
  }
  if (trimmed.includes(";")) {
    throw new Error("publicMirror refuses multiple statements in one string");
  }
}

function config(): { url: string; token: string } {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;
  if (!url || !token) {
    throw new Error(
      "TURSO_DATABASE_URL / TURSO_AUTH_TOKEN are not set on this Convex " +
        "deployment. The case-status alerts cannot read the mirror without " +
        "them. Set both with `npx convex env set`.",
    );
  }
  return { url: url.replace(/^libsql:\/\//, "https://"), token };
}

/**
 * Run one or more SELECTs in a single round trip and return their rows.
 *
 * Hrana answers 200 even when an individual statement failed, so the per-result
 * error check is the whole point rather than belt and braces: without it a
 * failed query returns an empty array and reads exactly like a case that has
 * not moved.
 */
export async function query(statements: Statement[]): Promise<Row[][]> {
  if (statements.length === 0) return [];
  for (const s of statements) assertReadOnly(s.sql);

  const { url, token } = config();
  const response = await fetch(`${url}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        ...statements.map((s) => ({
          type: "execute",
          stmt: { sql: s.sql, args: (s.args ?? []).map(lit) },
        })),
        { type: "close" },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`libsql HTTP ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as {
    results?: {
      type: string;
      error?: { message?: string };
      response?: {
        result?: { cols: { name: string }[]; rows: HranaValue[][] };
      };
    }[];
  };

  const out: Row[][] = [];
  for (const r of body.results ?? []) {
    if (r.type === "error") {
      throw new Error(`libsql error: ${r.error?.message ?? "unknown"}`);
    }
    const result = r.response?.result;
    // The trailing `close` has no result. Skipping it here rather than by index
    // means the mapping from statement to result stays positional for the
    // statements themselves, which is what callers destructure on.
    if (!result) continue;
    out.push(
      result.rows.map((row) => {
        const o: Row = {};
        result.cols.forEach((c, i) => {
          const v = row[i];
          o[c.name] = v === undefined ? null : cell(v);
        });
        return o;
      }),
    );
  }
  return out;
}

/** One statement, its rows. */
export async function rows(sql: string, args: (string | number | null)[] = []): Promise<Row[]> {
  const [first] = await query([{ sql, args }]);
  return first ?? [];
}

/** One statement, its first row or null. */
export async function one(sql: string, args: (string | number | null)[] = []): Promise<Row | null> {
  const r = await rows(sql, args);
  return r.length > 0 ? (r[0] as Row) : null;
}

/** `?,?,?` for an IN list. Returns null for an empty list so callers must branch. */
export function placeholders(n: number): string | null {
  return n > 0 ? new Array(n).fill("?").join(",") : null;
}
