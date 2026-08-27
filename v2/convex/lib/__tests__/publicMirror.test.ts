/**
 * The read-only Turso client Convex uses to reach the public DOL mirror.
 *
 * The read-only guard is the only part of this file that is a security control
 * rather than plumbing, so it gets probed hardest. `TURSO_AUTH_TOKEN` grants
 * WRITE access to the whole database, and nothing in Convex has any business
 * touching the public corpus, which is owned end to end by the ingest scripts.
 *
 * @module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { one, placeholders, query, rows } from "../publicMirror";

const originalFetch = global.fetch;

function cellOf(v: string | number | null) {
  if (v === null) return { type: "null" };
  if (typeof v === "number") return { type: "integer", value: String(v) };
  return { type: "text", value: v };
}

function stubPipeline(
  resultsFor: (sql: string) => Record<string, string | number | null>[] | "error",
) {
  const seen: string[] = [];
  global.fetch = (async (_url: unknown, init?: { body?: string }) => {
    const body = JSON.parse(init?.body ?? "{}") as {
      requests: { type: string; stmt?: { sql: string } }[];
    };
    const results = body.requests.map((req) => {
      if (req.type !== "execute" || !req.stmt) {
        return { type: "ok", response: { type: "close" } };
      }
      seen.push(req.stmt.sql);
      const out = resultsFor(req.stmt.sql);
      if (out === "error") {
        return { type: "error", error: { message: "no such table: nope" } };
      }
      const cols = out.length > 0 ? Object.keys(out[0]!) : [];
      return {
        type: "ok",
        response: {
          type: "execute",
          result: {
            cols: cols.map((name) => ({ name })),
            rows: out.map((r) => cols.map((c) => cellOf(r[c] ?? null))),
          },
        },
      };
    });
    return new Response(JSON.stringify({ results }), { status: 200 });
  }) as unknown as typeof fetch;
  return seen;
}

beforeEach(() => {
  vi.stubEnv("TURSO_DATABASE_URL", "libsql://example.turso.io");
  vi.stubEnv("TURSO_AUTH_TOKEN", "stub-token");
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("the read-only guard", () => {
  it("refuses anything that is not a SELECT", async () => {
    const seen = stubPipeline(() => []);
    for (const sql of [
      "DELETE FROM perm_case_status",
      "UPDATE perm_case_status SET current_status = 'CERTIFIED'",
      "INSERT INTO perm_case_status VALUES (1)",
      "DROP TABLE perm_case_status",
      "PRAGMA writable_schema = 1",
      "  delete from perm_case_status",
      "WITH x AS (SELECT 1) DELETE FROM perm_case_status",
    ]) {
      await expect(rows(sql), sql).rejects.toThrow(/read-only/i);
    }
    // Nothing reached the network, so the guard is a refusal rather than a
    // complaint printed after the fact.
    expect(seen).toHaveLength(0);
  });

  it("refuses a second statement smuggled into one string", async () => {
    const seen = stubPipeline(() => []);
    await expect(
      rows("SELECT 1; DROP TABLE perm_case_status"),
    ).rejects.toThrow(/multiple statements/i);
    expect(seen).toHaveLength(0);
  });

  it("still allows an ordinary SELECT, trailing semicolon and all", async () => {
    stubPipeline(() => [{ n: 5 }]);
    expect(await one("SELECT count(*) AS n FROM perm_case_status;")).toEqual({ n: 5 });
    // The guard is checked on EVERY statement in a batch, not just the first.
    await expect(
      query([{ sql: "SELECT 1" }, { sql: "DELETE FROM perm_case_status" }]),
    ).rejects.toThrow(/read-only/i);
  });
});

describe("configuration", () => {
  it("throws loudly when the credentials are missing", async () => {
    vi.stubEnv("TURSO_DATABASE_URL", "");
    // A missing credential that degraded to an empty result set would report
    // "nothing changed" forever, which is indistinguishable from a working
    // sweep in a quiet week.
    await expect(rows("SELECT 1")).rejects.toThrow(/TURSO_DATABASE_URL/);
  });
});

describe("result decoding", () => {
  it("narrows Hrana's string integers back to numbers", async () => {
    stubPipeline(() => [{ total: 412865, name: "Psomagen, Inc.", gap: null }]);
    const row = await one("SELECT total, name, gap FROM perm_entities");
    expect(row).toEqual({ total: 412865, name: "Psomagen, Inc.", gap: null });
    expect(typeof row!.total).toBe("number");
  });

  it("throws on a statement error rather than returning no rows", async () => {
    // Hrana answers HTTP 200 even when an individual statement failed. Without
    // the per-result check a failed query returns an empty array and reads
    // exactly like a case that has not moved.
    stubPipeline(() => "error");
    await expect(rows("SELECT * FROM nope")).rejects.toThrow(/libsql error/);
  });

  it("keeps results positional across a batch", async () => {
    stubPipeline((sql) => (sql.includes("first") ? [{ a: 1 }] : [{ b: 2 }]));
    const [firstRows, secondRows] = await query([
      { sql: "SELECT 1 AS first" },
      { sql: "SELECT 2 AS second" },
    ]);
    // The trailing `close` request has no result. Skipping it by SHAPE rather
    // than by index is what keeps the mapping from statement to result stable,
    // and callers destructure on that.
    expect(firstRows).toEqual([{ a: 1 }]);
    expect(secondRows).toEqual([{ b: 2 }]);
  });
});

describe("placeholders", () => {
  it("returns null for an empty list so callers must branch", () => {
    // `WHERE case_number IN ()` is a syntax error, and building it from a
    // silently-empty string is how a sweep with no subscribers throws.
    expect(placeholders(0)).toBeNull();
    expect(placeholders(1)).toBe("?");
    expect(placeholders(3)).toBe("?,?,?");
  });
});
