import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The title and filing-month filters on the employer search, both halves.
 *
 * Asserts the SQL, not a result set: the defects worth pinning are a LIKE that
 * lets a typed `%` match everything, a month range closed on the wrong end,
 * and a filter that quietly applies to one half and not the other.
 */

vi.mock("server-only", () => ({}));

const rows = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown[]>>();
const one = vi.fn<(sql: string, args?: unknown[]) => Promise<unknown>>();
vi.mock("../client", () => ({ rows, one }));

const { LIVE_SEARCH_MAX, narrowingClauses, searchCases, searchLiveCases } = await import("../cases");

beforeEach(() => {
  rows.mockReset();
  rows.mockResolvedValue([]);
});

describe("narrowingClauses", () => {
  it("is empty when nothing narrows", () => {
    expect(narrowingClauses("filing_date", {})).toEqual({ conds: [], params: [] });
    expect(narrowingClauses("filing_date", { title: "   " })).toEqual({ conds: [], params: [] });
  });

  it("escapes LIKE wildcards so a typed % or _ is literal", () => {
    const n = narrowingClauses("filing_date", { title: "100%_dev" });
    expect(n.conds).toEqual(["job_title LIKE ? ESCAPE '\\'"]);
    expect(n.params).toEqual(["%100\\%\\_dev%"]);
  });

  it("months are inclusive on both ends as a half-open date range", () => {
    const n = narrowingClauses("received_date", { from: "2026-04", to: "2026-06" });
    expect(n.conds).toEqual(["received_date >= ?", "received_date < ?"]);
    expect(n.params).toEqual(["2026-04-01", "2026-07-01"]);
    expect(narrowingClauses("x", { to: "2025-12" }).params).toEqual(["2026-01-01"]);
  });

  it("refuses a malformed month or an over-long title before SQL", () => {
    expect(() => narrowingClauses("x", { from: "2026-13" })).toThrow();
    expect(() => narrowingClauses("x", { to: "26-04" })).toThrow();
    expect(() => narrowingClauses("x", { title: "a".repeat(81) })).toThrow();
  });
});

describe("searchLiveCases", () => {
  it("applies the filters after the indexed employer range, caps at 200, and orders totally", async () => {
    await searchLiveCases("amazon", { title: "software", from: "2026-05", to: "2026-05" });
    const [sql, args] = rows.mock.calls[0]!;
    // The index is named in the statement and asserted here, because without
    // it the month range moved the plan onto `perm_live_recent_filed` and read
    // every filing in that window for every employer in the country. Measured
    // 2026-09-03; the fix is one clause and it is invisible in the results.
    expect(sql).toMatch(/FROM perm_live_recent INDEXED BY perm_live_recent_emp/);
    expect(sql).toMatch(/WHERE employer_slug >= \? AND employer_slug < \? AND job_title LIKE \? ESCAPE '\\' AND filing_date >= \? AND filing_date < \?/);
    expect(sql).toMatch(/ORDER BY filing_date DESC, case_number DESC LIMIT \?/);
    expect(args).toEqual(["amazon", "amazoo", "%software%", "2026-05-01", "2026-06-01", LIVE_SEARCH_MAX]);
  });

  it("defaults to the 200 cap, not the old 25", async () => {
    await searchLiveCases("amazon");
    expect(rows.mock.calls[0]![1]).toEqual(["amazon", "amazoo", LIVE_SEARCH_MAX]);
    await searchLiveCases("amazon", { limit: 5000 });
    expect(rows.mock.calls[1]![1]).toEqual(["amazon", "amazoo", LIVE_SEARCH_MAX]);
  });
});

describe("searchCases (published half)", () => {
  it("narrows by the month DOL RECEIVED the case, with the same title clause", async () => {
    await searchCases({ field: "employer", text: "amazon", title: "software", from: "2025-01", to: "2025-03" });
    const [sql, args] = rows.mock.calls[0]!;
    expect(sql).toMatch(/FROM perm_cases INDEXED BY idx_pc_emp_dec/);
    expect(sql).toMatch(/employer_slug >= \? AND employer_slug < \? AND job_title LIKE \? ESCAPE '\\' AND received_date >= \? AND received_date < \?/);
    expect(args).toEqual(["amazon", "amazoo", "%software%", "2025-01-01", "2025-04-01", 50]);
  });

  it("keeps the status and state filters in front of the narrowing ones", async () => {
    await searchCases({ field: "attorney", text: "fragomen", status: "denied", state: "CA", title: "nurse" });
    const [sql] = rows.mock.calls[0]!;
    expect(sql).toMatch(/attorney_slug >= \? AND attorney_slug < \? AND status = \? AND state = \? AND job_title LIKE \?/);
  });

  it("orders totally, so the same search cannot return different rows", async () => {
    // `decision_date` alone has many ties, and the two plans measured against
    // production returned the same 50 dates with a different pair of case
    // numbers in the last two slots.
    await searchCases({ field: "employer", text: "amazon" });
    expect(rows.mock.calls[0]![0]).toMatch(/ORDER BY decision_date DESC, case_number DESC LIMIT \?/);
  });

  it("names the lead index, so an equality filter cannot steal the plan", async () => {
    // MEASURED, not stylistic. With `status = ?` present and no hint, SQLite
    // planned `SEARCH perm_cases USING INDEX idx_pc_status_dec (status=?)` -
    // every certified case in the corpus, then discard the other employers.
    // `state` and `fiscal_year` stole it the same way. Turso forbids ANALYZE,
    // so there are no statistics to tell the planner otherwise.
    await searchCases({ field: "employer", text: "amazon", status: "certified" });
    expect(rows.mock.calls[0]![0]).toMatch(/FROM perm_cases INDEXED BY idx_pc_emp_dec WHERE/);
    await searchCases({ field: "attorney", text: "fragomen", status: "certified" });
    expect(rows.mock.calls[1]![0]).toMatch(/FROM perm_cases INDEXED BY idx_pc_att_dec WHERE/);
  });
});
