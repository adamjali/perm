import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const unifiedSearch = vi.fn();
vi.mock("@/lib/turso/unifiedSearch", async () => {
  const real = await vi.importActual<typeof import("@/lib/turso/unifiedSearch")>("@/lib/turso/unifiedSearch");
  return { ...real, unifiedSearch: (...a: unknown[]) => unifiedSearch(...a) };
});
vi.mock("@/lib/turso/entities", () => ({ searchByName: vi.fn().mockResolvedValue([]) }));
const searchEntities = vi.fn();
vi.mock("../reads", () => ({ searchEntities: (...a: unknown[]) => searchEntities(...a) }));

const { entitiesToCsv, exportCap, runExport, sandboxExport } = await import("../exports");
const { API_PLANS } = await import("@convex/lib/apiPlans");

const plus = API_PLANS.plus;
const u = (qs: string, kind = "employers") => new URL(`https://permtracker.app/v1/exports/${kind}?${qs}`);
const meta = { source: "DOL", asOf: "2026-06-30", url: "https://permtracker.app/perm-employers?q=acme" };
const searchResult = (rows: unknown[], extra: Record<string, unknown> = {}) => ({
  rows,
  counts: { perm: rows.length, pwd: 0, lca: 0, seasonal: 0 },
  truncated: false,
  capped: false,
  ...extra,
});

beforeEach(() => {
  unifiedSearch.mockReset();
  searchEntities.mockReset();
});

describe("what a plan may export", () => {
  it("holds Plus to 1,000 rows and Free to none", () => {
    expect(exportCap(plus)).toBe(1_000);
    expect(exportCap(API_PLANS.free)).toBe(0);
  });

  it("refuses a plan without exports, saying what it can do instead", async () => {
    const r = await runExport("employers", u("q=acme"), API_PLANS.free);
    expect(r).toMatchObject({ ok: false, status: 403, code: "plan_feature" });
    expect(searchEntities).not.toHaveBeenCalled();
  });

  it.each([["0"], ["-3"], ["1.5"], ["many"]])("refuses limit=%s", async (limit) => {
    expect(await runExport("employers", u(`q=acme&limit=${limit}`), plus)).toMatchObject({ ok: false, status: 400 });
  });
});

describe("a name-search export", () => {
  it("reads up to the cap in one search, past the 100-row page", async () => {
    searchEntities.mockResolvedValue({ ok: true, data: { results: [{ name: "Acme" }], more: false }, meta });
    await runExport("employers", u("q=acme"), plus);
    expect(searchEntities).toHaveBeenCalledWith("employer", "acme", 1_000, 1_000);
  });

  it("says when more matched than it holds", async () => {
    searchEntities.mockResolvedValue({ ok: true, data: { results: [{ name: "Acme" }], more: true }, meta });
    const r = await runExport("employers", u("q=acme&limit=1"), plus);
    expect(r).toMatchObject({ ok: true, truncated: true });
    expect(r.ok && r.note).toMatch(/More matched/);
  });

  it("writes a cell a spreadsheet would run as a formula as text", () => {
    const csv = entitiesToCsv([{ kind: "employer", name: "=HYPERLINK(\"x\")", slug: "-x" }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain("'-x");
    expect(csv.split("\r\n")[0]).toMatch(/^kind,slug,name,/);
  });
});

describe("a case export", () => {
  it("runs the site's case search, capped at the plan's rows", async () => {
    unifiedSearch.mockResolvedValue(searchResult([{ caseNumber: "G-100-26045-000001" }]));
    const r = await runExport("cases", u("q=acme&limit=5000", "cases"), plus);
    expect(r).toMatchObject({ ok: true, cap: 1_000 });
    expect(unifiedSearch.mock.calls[0]![0]).toMatchObject({ lead: { kind: "employer" }, limit: 1_000 });
  });

  it("refuses an export with nothing to lead the search", async () => {
    const r = await runExport("cases", u("state=", "cases"), plus);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(unifiedSearch).not.toHaveBeenCalled();
  });

  it("refuses the case search's own malformed requests in its own words", async () => {
    expect(await runExport("cases", u("q=acme&state=California", "cases"), plus)).toMatchObject({
      ok: false,
      status: 400,
      message: "state must be two letters",
    });
  });

  it("says when the search stopped short of everything", async () => {
    unifiedSearch.mockResolvedValue(searchResult([{ caseNumber: "G-100-26045-000001" }], { truncated: true }));
    const r = await runExport("cases", u("q=acme", "cases"), plus);
    expect(r).toMatchObject({ ok: true, truncated: true });
  });
});

describe("a sandbox export", () => {
  it("answers from the samples and marks them so", () => {
    const r = sandboxExport("cases", plus);
    expect(r.ok && r.rows.length).toBeGreaterThan(0);
    expect(r.ok && r.meta.source).toMatch(/sandbox/i);
    expect(r.ok && r.csv.split("\r\n")[0]).toBe("caseNumber,program,status,filingDate,employer,jobTitle");
  });
});
