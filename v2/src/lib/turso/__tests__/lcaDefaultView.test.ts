import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * The precomputed doc behind `/lca-wages` and `/tools/compare-my-offer`.
 *
 * WHY IT EXISTS. The LCA history backfill took `lca_cases` from 437,496 rows
 * to 1.96M, and the four queries those two pages run at build time became
 * unaffordable. Measured against production 2026-09-13:
 *
 *     filter options   blew the 90s build deadline outright
 *     byState          33.6 s   (the read layer's own deadline is 20 s)
 *     histogram         5.2 s
 *     stats             4.8 s
 *
 * The deploy of ded503e5 failed with
 * `Failed to build /lca-wages ... took more than 180 seconds`.
 *
 * THE FALLBACK IS THE POINT. Every reader still has its live query, so a
 * missing doc is a slow page rather than an empty one - which is also why a
 * doc that is present but WRONG is the dangerous case, and why the width
 * check below is not optional.
 */

const docMock = vi.fn();
const rowsMock = vi.fn();
const oneMock = vi.fn();

// `doc` comes from publicData; `rows`/`one` come from client. Mocking the
// wrong module leaves the real client in the path, which then throws for a
// missing TURSO_DATABASE_URL - a failure that looks like a broken test and is
// actually a mock pointed at the wrong entry point.
vi.mock("../publicData", async () => {
  const actual = await vi.importActual<typeof import("../publicData")>("../publicData");
  return { ...actual, doc: (...a: unknown[]) => docMock(...a) };
});

vi.mock("../client", () => ({
  rows: (...a: unknown[]) => rowsMock(...a),
  one: (...a: unknown[]) => oneMock(...a),
}));

const STATS = { n: 1_836_301, avg: 132_000, p5: 62_000, p25: 95_000, p50: 122_000, p75: 158_000, p95: 245_000 };
const HISTOGRAM = [{ from: 60_000, count: 12 }, { from: 70_000, count: 31 }];
const BY_STATE = [{ state: "CA", n: 400_000, avg: 160_000, p5: 70_000, p25: 110_000, p50: 145_000, p75: 190_000, p95: 290_000 }];

const FULL_DOC = {
  minCases: 30,
  binWidth: 10_000,
  occupations: [{ value: "15-1252", label: "Software Developers", n: 500_000 }],
  states: [{ value: "CA", label: "CA", n: 400_000 }],
  fiscalYears: ["2026", "2025"],
  stats: STATS,
  histogram: HISTOGRAM,
  byState: BY_STATE,
};

const DEFAULT = { status: "certified" as const };

beforeEach(() => {
  vi.clearAllMocks();
  // clearAllMocks clears CALLS, not IMPLEMENTATIONS, and CI shuffles test
  // order - so every test arranges its own return value rather than
  // inheriting one.
  rowsMock.mockResolvedValue([]);
  oneMock.mockResolvedValue({ n: 0 });
});

describe("the default view is served from the doc", () => {
  it("reads stats from the doc without touching the database", async () => {
    docMock.mockResolvedValue(FULL_DOC);
    const { getLcaWageStats } = await import("../lcaWages");
    expect(await getLcaWageStats(DEFAULT)).toEqual(STATS);
    expect(oneMock).not.toHaveBeenCalled();
  });

  it("reads the histogram from the doc at the doc's own width", async () => {
    docMock.mockResolvedValue(FULL_DOC);
    const { getLcaWageHistogram } = await import("../lcaWages");
    expect(await getLcaWageHistogram(DEFAULT, 10_000)).toEqual(HISTOGRAM);
    expect(rowsMock).not.toHaveBeenCalled();
  });

  it("reads byState from the doc", async () => {
    docMock.mockResolvedValue(FULL_DOC);
    const { getLcaWageByState } = await import("../lcaWages");
    expect(await getLcaWageByState(DEFAULT, 30)).toEqual(BY_STATE);
    expect(rowsMock).not.toHaveBeenCalled();
  });

  it("serves byState from the doc for a per-STATE selection too", async () => {
    // getLcaWageByState drops the state from its own WHERE, so a state
    // selection has the same by-state answer as the default view - that is
    // what makes the panel a comparison. If this fell through, every state
    // page would run the 33.6 s query.
    docMock.mockResolvedValue(FULL_DOC);
    const { getLcaWageByState } = await import("../lcaWages");
    expect(await getLcaWageByState({ ...DEFAULT, state: "CA" }, 30)).toEqual(BY_STATE);
    expect(rowsMock).not.toHaveBeenCalled();
  });
});

describe("it falls back rather than serving the wrong answer", () => {
  it("A WIDTH MISMATCH FALLS BACK — the bins would be the wrong shape", async () => {
    // binWidth() is ours to change. A doc built at 10,000 cannot answer a
    // request for 5,000 bins, and serving it would redraw the histogram at
    // half scale with nothing erroring.
    docMock.mockResolvedValue(FULL_DOC);
    rowsMock.mockResolvedValue([{ bin: 5_000, n: 3 }]);
    const { getLcaWageHistogram } = await import("../lcaWages");
    expect(await getLcaWageHistogram(DEFAULT, 5_000)).toEqual([{ from: 5_000, count: 3 }]);
    expect(rowsMock).toHaveBeenCalled();
  });

  it("a minCases mismatch falls back for byState", async () => {
    docMock.mockResolvedValue({ ...FULL_DOC, minCases: 50 });
    rowsMock.mockResolvedValue([]);
    const { getLcaWageByState } = await import("../lcaWages");
    await getLcaWageByState(DEFAULT, 30);
    expect(rowsMock).toHaveBeenCalled();
  });

  it("a missing doc falls back to the live query", async () => {
    docMock.mockResolvedValue(null);
    oneMock.mockResolvedValue({ n: 7, avg: 1, p5: 1, p25: 1, p50: 1, p75: 1, p95: 1 });
    const { getLcaWageStats } = await import("../lcaWages");
    expect((await getLcaWageStats(DEFAULT)).n).toBe(7);
    expect(oneMock).toHaveBeenCalled();
  });

  it("a doc with no stats falls back", async () => {
    docMock.mockResolvedValue({ ...FULL_DOC, stats: undefined });
    oneMock.mockResolvedValue({ n: 9, avg: 1, p5: 1, p25: 1, p50: 1, p75: 1, p95: 1 });
    const { getLcaWageStats } = await import("../lcaWages");
    expect((await getLcaWageStats(DEFAULT)).n).toBe(9);
  });

  it("a doc with an empty byState falls back", async () => {
    docMock.mockResolvedValue({ ...FULL_DOC, byState: [] });
    rowsMock.mockResolvedValue([]);
    const { getLcaWageByState } = await import("../lcaWages");
    await getLcaWageByState(DEFAULT, 30);
    expect(rowsMock).toHaveBeenCalled();
  });
});

describe("EVERY narrowed selection goes live — the doc describes one view only", () => {
  it.each([
    ["an occupation", { socCode: "15-1252" }],
    ["a state", { state: "CA" }],
    ["a fiscal year", { fiscalYear: "2025" }],
    ["a denied status", { status: "denied" as const }],
    ["a withdrawn status", { status: "withdrawn" as const }],
  ])("%s is served live, never from the doc", async (_label, extra) => {
    docMock.mockResolvedValue(FULL_DOC);
    oneMock.mockResolvedValue({ n: 3, avg: 1, p5: 1, p25: 1, p50: 1, p75: 1, p95: 1 });
    const { getLcaWageStats } = await import("../lcaWages");
    expect((await getLcaWageStats({ ...DEFAULT, ...extra })).n).toBe(3);
    expect(oneMock).toHaveBeenCalled();
  });

  it("isDefaultLcaFilter accepts only the whole certified corpus", async () => {
    const { isDefaultLcaFilter } = await import("../lcaWages");
    expect(isDefaultLcaFilter({ status: "certified" })).toBe(true);
    expect(isDefaultLcaFilter({ status: "certified", state: null, socCode: null })).toBe(true);
    expect(isDefaultLcaFilter({ status: "all" })).toBe(false);
    expect(isDefaultLcaFilter({ status: "certified", state: "CA" })).toBe(false);
    expect(isDefaultLcaFilter({ status: "certified", socCode: "15-1252" })).toBe(false);
    expect(isDefaultLcaFilter({ status: "certified", fiscalYear: "2025" })).toBe(false);
  });
});

describe("the doc is read once per render, not once per reader", () => {
  it("three default-view reads share one doc() call", async () => {
    docMock.mockResolvedValue(FULL_DOC);
    const m = await import("../lcaWages");
    await Promise.all([
      m.getLcaWageStats(DEFAULT),
      m.getLcaWageHistogram(DEFAULT, 10_000),
      m.getLcaWageByState(DEFAULT, 30),
      m.getLcaWageFilterOptions(30),
    ]);
    // `doc()` is React-cached per request in production; this asserts the
    // readers all ask for the SAME key, which is what makes that caching
    // collapse four asks into one round trip.
    const keys = new Set(docMock.mock.calls.map((c) => c[0]));
    expect(keys).toEqual(new Set(["lca_filter_options"]));
  });
});
