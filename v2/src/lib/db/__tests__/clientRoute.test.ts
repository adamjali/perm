import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The client sends a statement on `lca_cases` to the LCA filings' own database
 * (DATABASE_LCA_URL, since Oct 19 2026) and everything else to the main one,
 * and refuses a statement that joins the two. Unset, everything goes to the
 * main database, as before the move.
 */

vi.mock("server-only", () => ({}));

const made: { url: string; authToken: string }[] = [];
const calls: string[] = [];
vi.mock("@libsql/client/http", () => ({
  createClient: (cfg: { url: string; authToken: string }) => {
    made.push(cfg);
    return {
      execute: async () => {
        calls.push(cfg.url);
        return { rows: [], columns: [], rowsAffected: 1 };
      },
    };
  },
}));

beforeEach(() => {
  vi.resetModules();
  made.length = 0;
  calls.length = 0;
  process.env.DATABASE_URL = "http://main.test";
  process.env.DATABASE_AUTH_TOKEN = "ro";
  delete process.env.DATABASE_RW_AUTH_TOKEN;
  delete process.env.DATABASE_LCA_URL;
});

describe("with the LCA database set", () => {
  beforeEach(() => {
    process.env.DATABASE_LCA_URL = "http://lca.test";
  });

  it("reads the LCA table there and everything else from the main database", async () => {
    const { rows } = await import("../client");
    await rows("SELECT COUNT(*) FROM lca_cases INDEXED BY lca_cases_emp WHERE employer_slug = ?", ["x"]);
    await rows("SELECT 1 FROM lca_case_status");
    await rows("SELECT 1 FROM perm_docs WHERE key = ?", ["k"]);
    expect(calls).toEqual(["http://lca.test", "http://main.test", "http://main.test"]);
    expect(made.every((m) => m.authToken === "ro")).toBe(true);
  });

  it("writes with the write token, to the database that holds the table", async () => {
    process.env.DATABASE_RW_AUTH_TOKEN = "rw";
    const { exec } = await import("../client");
    await exec("UPDATE lca_cases SET naics = ? WHERE case_number = ?", ["1", "I-200-26001-000001"]);
    await exec("INSERT INTO perm_docs (key, value) VALUES (?, ?)", ["k", "v"]);
    expect(calls).toEqual(["http://lca.test", "http://main.test"]);
    expect(made.map((m) => [m.url, m.authToken])).toEqual([
      ["http://lca.test", "rw"],
      ["http://main.test", "rw"],
    ]);
  });

  it("refuses a statement joining the LCA table to a main-file table, asking nothing", async () => {
    const { rows } = await import("../client");
    await expect(
      rows("SELECT * FROM lca_cases l JOIN employer_page_map m ON m.source_slug = l.employer_slug"),
    ).rejects.toThrow(/employer_page_map.*read them separately/);
    expect(calls).toEqual([]);
  });
});

describe("with no LCA database set", () => {
  it("sends every statement to the main database", async () => {
    const { rows } = await import("../client");
    await rows("SELECT * FROM lca_cases LIMIT 1");
    await rows("SELECT 1 FROM perm_docs");
    expect(calls).toEqual(["http://main.test", "http://main.test"]);
    expect(made).toHaveLength(1);
  });

  it("still refuses a join outside production, so it shows up before the move", async () => {
    const { rows } = await import("../client");
    await expect(rows("SELECT 1 FROM lca_cases JOIN pwd_cases USING (case_number)")).rejects.toThrow(
      /pwd_cases/,
    );
  });

  it("in production runs it on the one file and logs it once", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const { rows } = await import("../client");
      const sql = "SELECT 1 FROM lca_cases JOIN pwd_cases USING (case_number)";
      await rows(sql);
      await rows(sql);
      expect(calls).toEqual(["http://main.test", "http://main.test"]);
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0]?.[0])).toMatch(/\[lcaRoute\].*pwd_cases/);
    } finally {
      log.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
