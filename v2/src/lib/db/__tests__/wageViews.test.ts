import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Precomputed wage selections (wageViews.ts, scripts/build_wage_views.py).
 *
 * The readers must (a) serve a precomputed view with ONE primary-key read and
 * no aggregate, (b) fall back to the live query when there is no view, and
 * (c) never serve bins at a width other than the one the caller asked for.
 * The key normalisation is what makes a view describe the same rows the live
 * query would read, so it is pinned too.
 */

const oneMock = vi.fn();
const rowsMock = vi.fn();

vi.mock("../client", () => ({
  one: (...a: unknown[]) => oneMock(...a),
  rows: (...a: unknown[]) => rowsMock(...a),
}));

const STATS = { n: 120_000, avg: 140_000, p5: 80_000, p25: 110_000, p50: 135_000, p75: 165_000, p95: 220_000 };
const VIEW = {
  stats: STATS,
  binWidth: 10_000,
  histogram: [[80_000, 5], [90_000, 9]],
  minCases: 30,
  byState: [{ state: "CA", ...STATS }],
};

const isViewRead = (sql: unknown) => String(sql).includes("FROM wage_views");

beforeEach(() => {
  vi.clearAllMocks();
  oneMock.mockResolvedValue(null);
  rowsMock.mockResolvedValue([]);
});

describe("wageViewKey", () => {
  it("normalises each part the way the live query normalises its argument", async () => {
    const { wageViewKey } = await import("../wageViews");
    expect(wageViewKey("perm", { socCode: " 15-1252.00 ", state: "CA", fiscalYear: "2026" }))
      .toBe("perm|certified|15-1252|CA|2026");
    expect(wageViewKey("lca", { status: "all", state: "tx", fiscalYear: 2025 }))
      .toBe("lca|all||TX|2025");
    expect(wageViewKey("lca", { status: "denied" })).toBe("lca|denied|||");
  });
});

describe("the PERM readers", () => {
  it("serve stats, bins and the by-state table from a view", async () => {
    oneMock.mockImplementation(async (sql: string) =>
      isViewRead(sql) ? { json: JSON.stringify(VIEW) } : null,
    );
    const { getWageStats, getWageHistogram, getWageByState } = await import("../publicData");
    const f = { socCode: "15-1252", status: "certified" as const };
    expect(await getWageStats(f)).toEqual(STATS);
    expect(await getWageHistogram(f, 10_000)).toEqual([
      { from: 80_000, count: 5 },
      { from: 90_000, count: 9 },
    ]);
    expect(await getWageByState(f, 30)).toEqual(VIEW.byState);
    // Nothing but primary-key reads of wage_views.
    expect(rowsMock).not.toHaveBeenCalled();
    for (const [sql] of oneMock.mock.calls) expect(isViewRead(sql)).toBe(true);
  });

  it("run the live query when there is no view", async () => {
    oneMock.mockImplementation(async (sql: string) =>
      isViewRead(sql) ? null : { n: 42, avg: 1, p5: 1, p25: 1, p50: 1, p75: 1, p95: 1 },
    );
    const { getWageStats } = await import("../publicData");
    expect((await getWageStats({ socCode: "11-9041" })).n).toBe(42);
  });

  it("never serve bins at a width other than the one asked for", async () => {
    oneMock.mockImplementation(async (sql: string) =>
      isViewRead(sql) ? { json: JSON.stringify(VIEW) } : null,
    );
    rowsMock.mockResolvedValue([{ bin: 0, n: 7 }]);
    const { getWageHistogram } = await import("../publicData");
    expect(await getWageHistogram({ socCode: "15-1252" }, 5_000)).toEqual([{ from: 0, count: 7 }]);
    expect(rowsMock).toHaveBeenCalledTimes(1);
  });

  it("do not look up a view for a city or industry narrowing", async () => {
    oneMock.mockResolvedValue({ n: 3, avg: 1, p5: 1, p25: 1, p50: 1, p75: 1, p95: 1 });
    const { getWageStats } = await import("../publicData");
    await getWageStats({ state: "CA", city: "San Jose" });
    for (const [sql] of oneMock.mock.calls) expect(isViewRead(sql)).toBe(false);
  });
});

describe("the LCA readers", () => {
  it("serve a view before the older default-view doc and the live query", async () => {
    oneMock.mockImplementation(async (sql: string) =>
      isViewRead(sql) ? { json: JSON.stringify(VIEW) } : null,
    );
    const { getLcaWageStats, getLcaWageByState } = await import("../lcaWages");
    expect(await getLcaWageStats({ status: "all", socCode: "15-1252" })).toEqual(STATS);
    expect(await getLcaWageByState({ status: "all", socCode: "15-1252", state: "WA" }, 30)).toEqual(VIEW.byState);
    expect(rowsMock).not.toHaveBeenCalled();
  });
});
