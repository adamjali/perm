import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The retry predicate in `client.ts`, which is the whole point of the helper
 * and was excluding the failure it was written for.
 *
 * Production Sentry, 2026-08-31 06:45 EDT, on a `perm-employers/[slug]` server
 * component: `SocketError: other side closed` wrapped in `TypeError: fetch
 * failed`, thrown straight through because the predicate was
 * `String(e).includes("turso query deadline")`. A dead pooled keep-alive
 * connection is the most retryable error there is.
 *
 * THE TRAP THESE TESTS EXIST FOR: `String(err)` on undici's wrapper is exactly
 * `"TypeError: fetch failed"`. The reason lives in `err.cause`, so a predicate
 * reading only the message can never see `other side closed` no matter how many
 * patterns it lists. Every fixture below is built with a real `cause` chain for
 * that reason - a test that puts the reason in the message would pass against
 * the broken version too.
 */

vi.mock("server-only", () => ({}));

const execute = vi.fn();
vi.mock("@libsql/client", () => ({
  createClient: () => ({ execute }),
}));

const OK = { rows: [], columns: [], rowsAffected: 1 };

/** undici's shape: a bare wrapper whose message says nothing. */
function fetchFailed(reason: string) {
  const err = new TypeError("fetch failed");
  (err as { cause?: unknown }).cause = new Error(reason);
  return err;
}

beforeEach(() => {
  vi.resetModules();
  execute.mockReset();
  process.env.TURSO_DATABASE_URL = "libsql://test";
  process.env.TURSO_AUTH_TOKEN = "t";
  delete process.env.TURSO_RW_AUTH_TOKEN;
});

describe("reads retry a dropped connection", () => {
  it("retries `other side closed` hidden in the cause, and succeeds", async () => {
    const { rows } = await import("../client");
    execute
      .mockRejectedValueOnce(fetchFailed("SocketError: other side closed"))
      .mockResolvedValueOnce(OK);

    await expect(rows("SELECT 1")).resolves.toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it.each([
    "SocketError: other side closed",
    "Error: read ECONNRESET",
    "Error: connect ETIMEDOUT 1.2.3.4:443",
    "getaddrinfo EAI_AGAIN db.turso.io",
    "getaddrinfo ENOTFOUND db.turso.io",
  ])("retries %s", async (reason) => {
    const { rows } = await import("../client");
    execute.mockRejectedValueOnce(fetchFailed(reason)).mockResolvedValueOnce(OK);
    await expect(rows("SELECT 1")).resolves.toEqual([]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("gives up after ONE retry rather than looping", async () => {
    const { rows } = await import("../client");
    execute.mockRejectedValue(fetchFailed("SocketError: other side closed"));
    await expect(rows("SELECT 1")).rejects.toThrow("fetch failed");
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a real SQL error", async () => {
    const { rows } = await import("../client");
    // No cause chain and no network vocabulary: this is the server answering.
    execute.mockRejectedValue(new Error("SQLITE_ERROR: no such table: nope"));
    await expect(rows("SELECT 1")).rejects.toThrow("no such table");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry a read-only rejection", async () => {
    const { rows } = await import("../client");
    execute.mockRejectedValue(
      new Error("BLOCKED: SQL write operations are forbidden"),
    );
    await expect(rows("SELECT 1")).rejects.toThrow("BLOCKED");
    expect(execute).toHaveBeenCalledTimes(1);
  });
});

describe("writes do not", () => {
  it("throws a dropped connection straight through instead of re-applying", async () => {
    // The reason `retryTransient` is a parameter rather than the default.
    // "other side closed" does not say whether the far end processed the
    // statement first, so a retried INSERT could apply twice.
    const { exec } = await import("../client");
    execute.mockRejectedValueOnce(fetchFailed("SocketError: other side closed"));

    await expect(exec("INSERT INTO t VALUES (1)")).rejects.toThrow(
      "fetch failed",
    );
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
