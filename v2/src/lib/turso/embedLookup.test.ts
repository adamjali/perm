import { createClient } from "@libsql/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The embedded lookup: ask DOL live under a per-site and an all-sites daily
 * cap, fall back to the stored record, and never overwrite a stored row.
 *
 * The counters run their REAL SQL against an in-memory libSQL database, so
 * the one-row JSON map is tested as written, not as a mock imagines it.
 */

const db = createClient({ url: ":memory:" });
const execSpy = vi.fn();
vi.mock("./client", () => ({
  exec: async (sql: string, args: unknown[] = []) => {
    execSpy(sql, args);
    const rs = await db.execute({ sql, args: args as never[] });
    return rs.rowsAffected;
  },
  one: async (sql: string, args: unknown[] = []) => {
    const rs = await db.execute({ sql, args: args as never[] });
    return (rs.rows[0] as unknown) ?? null;
  },
  rows: async () => [],
}));

const lookupCase = vi.fn();
vi.mock("./caseLookup", async (orig) => ({
  ...(await orig<typeof import("./caseLookup")>()),
  lookupCase: (...a: unknown[]) => lookupCase(...a),
}));

const discoverCase = vi.fn();
const fetchDolCase = vi.fn();
const underDailyBudget = vi.fn();
vi.mock("./caseDiscovery", async (orig) => ({
  ...(await orig<typeof import("./caseDiscovery")>()),
  discoverCase: (...a: unknown[]) => discoverCase(...a),
  fetchDolCase: (...a: unknown[]) => fetchDolCase(...a),
  underDailyBudget: (...a: unknown[]) => underDailyBudget(...a),
}));

import { EMBED_ALL_DAILY_LIVE, EMBED_SITE_DAILY_LIVE } from "@/lib/embeds";
import { chargeEmbedLive, embedProgramOf, lookupForEmbed } from "./embedLookup";
import { pwd } from "./pwdCases";

const NOW = new Date("2026-09-26T15:00:00Z");
const KEY = "embed_live_2026-09-26";
const CN = "G-100-26125-868956";

const STORED = {
  caseNumber: CN,
  live: {
    status: "ANALYST REVIEW",
    isFinal: false,
    filingDate: "2026-05-05",
    employerName: "ACME ROBOTICS LLC",
    jobTitle: "Software Developer",
    lastCheckedAt: "2026-09-26T08:30:00Z",
  },
  decided: null,
  cohort: null,
  employer: null,
  statusOutlook: null,
};
const MISS = { ...STORED, live: null };

async function seed(json: Record<string, number>) {
  await db.execute({ sql: "INSERT INTO perm_docs (key, json, computed_at) VALUES (?, ?, 0)", args: [KEY, JSON.stringify(json)] });
}
async function counts(): Promise<Record<string, number>> {
  const rs = await db.execute({ sql: "SELECT json FROM perm_docs WHERE key = ?", args: [KEY] });
  return rs.rows[0] ? JSON.parse(String(rs.rows[0].json)) : {};
}

beforeEach(async () => {
  await db.execute("DROP TABLE IF EXISTS perm_docs");
  await db.execute("CREATE TABLE perm_docs (key TEXT PRIMARY KEY, json TEXT, computed_at INTEGER)");
  vi.restoreAllMocks();
  execSpy.mockReset();
  lookupCase.mockReset().mockResolvedValue(STORED);
  discoverCase.mockReset().mockResolvedValue(null);
  fetchDolCase.mockReset().mockResolvedValue(null);
  underDailyBudget.mockReset().mockResolvedValue(true);
});

describe("embedProgramOf", () => {
  it("routes P- and I- numbers before the PERM shape, which accepts any letter", () => {
    expect(embedProgramOf("p-100-26161-003499")?.program).toBe("pwd");
    expect(embedProgramOf("I-200-26239-199921")?.program).toBe("lca");
    expect(embedProgramOf(` ${CN.toLowerCase()} `)).toEqual({ program: "perm", caseNumber: CN });
    expect(embedProgramOf("not a case")).toBeNull();
  });
});

describe("chargeEmbedLive", () => {
  it(`allows ${EMBED_SITE_DAILY_LIVE} a day per site, then refuses, and keeps other sites open`, async () => {
    for (let i = 0; i < EMBED_SITE_DAILY_LIVE; i++) {
      expect(await chargeEmbedLive("example.com", NOW)).toBe("ok");
    }
    expect(await chargeEmbedLive("example.com", NOW)).toBe("capped");
    expect(await chargeEmbedLive("other.org", NOW)).toBe("ok");
    const c = await counts();
    expect(c["example.com"]).toBe(EMBED_SITE_DAILY_LIVE + 1);
    expect(c.all).toBe(EMBED_SITE_DAILY_LIVE + 2);
  });

  it("refuses every site once all sites together hit the cap, without adding the site to the map", async () => {
    await seed({ all: EMBED_ALL_DAILY_LIVE });
    expect(await chargeEmbedLive("fresh-name.example", NOW)).toBe("capped");
    expect(await counts()).toEqual({ all: EMBED_ALL_DAILY_LIVE + 1 });
  });

  it("refuses a key that is not a plain hostname without writing anything", async () => {
    expect(await chargeEmbedLive("all", NOW)).toBe("error");
    expect(await chargeEmbedLive('x"; DROP', NOW)).toBe("error");
    expect(execSpy).not.toHaveBeenCalled();
  });

  it("keeps one row per UTC day", async () => {
    await chargeEmbedLive("example.com", NOW);
    await chargeEmbedLive("example.com", new Date("2026-09-27T01:00:00Z"));
    const rs = await db.execute("SELECT key FROM perm_docs ORDER BY key");
    expect(rs.rows.map((r) => r.key)).toEqual([KEY, "embed_live_2026-09-27"]);
  });
});

describe("lookupForEmbed", () => {
  it("reads DOL's status now for a stored case and writes nothing but the counter", async () => {
    fetchDolCase.mockResolvedValue({ caseNumber: CN, caseStatus: "CERTIFIED", employerName: null, jobTitle: null, submittedDate: null, visaType: null });
    const a = await lookupForEmbed(CN, "example.com", NOW);
    expect(a).toMatchObject({ found: true, status: "CERTIFIED", source: "dol-now", capped: false, employerName: "ACME ROBOTICS LLC" });
    expect(lookupCase).toHaveBeenCalledWith(CN, { discover: false });
    expect(discoverCase).not.toHaveBeenCalled();
    for (const [sql] of execSpy.mock.calls) expect(String(sql)).toMatch(/INSERT INTO perm_docs/);
  });

  it("serves the stored record once the site's checks are used up, without asking DOL", async () => {
    await seed({ all: 10, "example.com": EMBED_SITE_DAILY_LIVE });
    const a = await lookupForEmbed(CN, "example.com", NOW);
    expect(a).toMatchObject({ found: true, status: "ANALYST REVIEW", source: "stored", capped: true });
    expect(fetchDolCase).not.toHaveBeenCalled();
  });

  it("falls back to the stored record when DOL does not answer", async () => {
    const a = await lookupForEmbed(CN, "example.com", NOW);
    expect(a).toMatchObject({ source: "stored", capped: false, checkedAt: "2026-09-26T08:30:00Z" });
  });

  it("sends a case we do not hold through the ordinary discovery path", async () => {
    lookupCase.mockResolvedValue(MISS);
    discoverCase.mockResolvedValue({ status: "ANALYST REVIEW", isFinal: false, filingDate: "2026-05-05", employerName: "ACME", jobTitle: "Dev", lastCheckedAt: NOW.toISOString() });
    const a = await lookupForEmbed(CN, "example.com", NOW);
    expect(discoverCase).toHaveBeenCalledWith(CN, expect.any(Function), NOW);
    expect(a).toMatchObject({ found: true, source: "dol-now" });
  });

  it("says not found, and capped, when a miss meets a spent cap", async () => {
    lookupCase.mockResolvedValue(MISS);
    await seed({ all: EMBED_ALL_DAILY_LIVE });
    const a = await lookupForEmbed(CN, "example.com", NOW);
    expect(a).toMatchObject({ found: false, capped: true, source: null });
    expect(discoverCase).not.toHaveBeenCalled();
  });

  it("reads a stored PWD row without discovery and never records from a live re-read", async () => {
    const lookup = vi.spyOn(pwd, "lookup").mockResolvedValue({
      caseNumber: "P-100-26161-003499", filingDate: "2026-06-10", status: "Determination Issued", isFinal: true,
      employerName: "ACME", employerSlug: "acme", jobTitle: "Dev", visaType: null, submittedDate: null,
      firstSeenAt: null, lastCheckedAt: "2026-09-25T00:00:00Z",
    } as never);
    const discover = vi.spyOn(pwd, "discover");
    fetchDolCase.mockResolvedValue({ caseNumber: "P-100-26161-003499", caseStatus: "Determination Issued", employerName: null, jobTitle: null, submittedDate: null, visaType: null });
    const a = await lookupForEmbed("P-100-26161-003499", "example.com", NOW);
    expect(lookup).toHaveBeenCalledWith("P-100-26161-003499", { discover: false });
    expect(discover).not.toHaveBeenCalled();
    expect(underDailyBudget).toHaveBeenCalledWith(NOW, pwd.config.budgetPrefix);
    expect(a).toMatchObject({ program: "pwd", source: "dol-now" });
  });

  it("asks DOL nothing when the counter itself fails", async () => {
    await db.execute("DROP TABLE perm_docs");
    const a = await lookupForEmbed(CN, "example.com", NOW);
    expect(a).toMatchObject({ source: "stored", capped: false });
    expect(fetchDolCase).not.toHaveBeenCalled();
  });
});
