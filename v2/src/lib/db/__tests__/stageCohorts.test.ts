import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const one = vi.fn();
const rows = vi.fn();
vi.mock("../client", () => ({ one, rows }));

const { foldStageCohorts, parseStageCohortsDoc, getStageCohorts } = await import("../rfi");

type Cell = { month: string; status: string; n: number };

const doc = (cells: Cell[], over: Record<string, unknown> = {}) =>
  JSON.stringify({
    asOf: "2026-09-03",
    source: "flag.dol.gov",
    total: cells.reduce((a, c) => a + c.n, 0),
    rows: cells,
    ...over,
  });

const CELLS: Cell[] = [
  { month: "2025-10", status: "ANALYST REVIEW", n: 900 },
  { month: "2025-10", status: "CERTIFIED", n: 100 },
  { month: "2025-11", status: "RFI ISSUED", n: 7 },
  { month: "2025-11", status: "CERTIFIED", n: 493 },
  { month: "2025-12", status: "CERTIFIED", n: 250 },
];

beforeEach(() => {
  vi.resetAllMocks();
  one.mockResolvedValue(null);
  rows.mockResolvedValue([]);
});

describe("foldStageCohorts", () => {
  it("counts EVERY status into filed, and only the wanted ones into stages", () => {
    // `filed` is the denominator the stage counts are read against, so a month
    // with 900 pending and 100 certified filed 1,000, not 900.
    const out = foldStageCohorts(CELLS, ["ANALYST REVIEW", "RFI ISSUED"]);
    expect(out).toEqual([
      { month: "2025-10", filed: 1000, stages: { "ANALYST REVIEW": 900 } },
      { month: "2025-11", filed: 500, stages: { "RFI ISSUED": 7 } },
    ]);
  });

  it("drops a month with nothing at any wanted stage", () => {
    // 2025-12 is certified-only: thirty empty columns bury the ones with shape.
    expect(foldStageCohorts(CELLS, ["RFI ISSUED"]).map((m) => m.month)).toEqual(["2025-11"]);
  });

  it("orders by month even when the cells arrive shuffled", () => {
    const shuffled = [...CELLS].reverse();
    expect(foldStageCohorts(shuffled, ["ANALYST REVIEW", "RFI ISSUED"]).map((m) => m.month))
      .toEqual(["2025-10", "2025-11"]);
  });
});

describe("parseStageCohortsDoc", () => {
  const NOW = 1_760_000_000_000;

  it("accepts a doc that reconciles", () => {
    expect(parseStageCohortsDoc(doc(CELLS), NOW, NOW)).toEqual(CELLS);
  });

  it("REJECTS a doc whose cells do not sum to its own total", () => {
    // The writer counts `total` with a separate query, so a mismatch means the
    // two saw different tables. Half a matrix folds into smaller plausible
    // numbers on eleven pages and nothing downstream could tell.
    expect(parseStageCohortsDoc(doc(CELLS, { total: 1751 }), NOW, NOW)).toBeNull();
  });

  it("rejects a doc older than eight days", () => {
    const nineDays = 9 * 24 * 60 * 60 * 1000;
    expect(parseStageCohortsDoc(doc(CELLS), NOW - nineDays, NOW)).toBeNull();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(parseStageCohortsDoc(doc(CELLS), NOW - sevenDays, NOW)).not.toBeNull();
  });

  it("rejects malformed json, a missing field, and a bad cell", () => {
    expect(parseStageCohortsDoc("{not json", NOW, NOW)).toBeNull();
    expect(parseStageCohortsDoc(JSON.stringify({ asOf: "x", rows: [] }), NOW, NOW)).toBeNull();
    expect(
      parseStageCohortsDoc(
        JSON.stringify({ asOf: "x", total: 1, rows: [{ month: "2025-10", n: 1 }] }),
        NOW,
        NOW,
      ),
    ).toBeNull();
  });
});

describe("getStageCohorts", () => {
  it("reads the doc and never touches the table", async () => {
    one.mockResolvedValue({ json: doc(CELLS), computed_at: Date.now() });
    const out = await getStageCohorts(["ANALYST REVIEW"]);
    expect(out).toEqual([{ month: "2025-10", filed: 1000, stages: { "ANALYST REVIEW": 900 } }]);
    // The whole point: no full scan of perm_case_status.
    expect(rows).not.toHaveBeenCalled();
  });

  it("falls back to the live scan when the doc is missing", async () => {
    one.mockResolvedValue(null);
    rows.mockResolvedValue(CELLS.map((c) => ({ month: c.month, status: c.status, n: c.n })));
    const out = await getStageCohorts(["RFI ISSUED"]);
    expect(rows).toHaveBeenCalledTimes(1);
    expect(out).toEqual([{ month: "2025-11", filed: 500, stages: { "RFI ISSUED": 7 } }]);
  });

  it("falls back, loudly, when the doc does not reconcile", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    one.mockResolvedValue({ json: doc(CELLS, { total: 99 }), computed_at: Date.now() });
    rows.mockResolvedValue(CELLS.map((c) => ({ month: c.month, status: c.status, n: c.n })));
    await getStageCohorts(["RFI ISSUED"]);
    expect(rows).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("stage_cohorts doc rejected"));
    warn.mockRestore();
  });

  it("gives the doc path and the live path the same answer", async () => {
    // They share one fold precisely so they cannot diverge; this pins it.
    one.mockResolvedValue({ json: doc(CELLS), computed_at: Date.now() });
    const viaDoc = await getStageCohorts(["ANALYST REVIEW", "RFI ISSUED"]);
    vi.resetAllMocks();
    one.mockResolvedValue(null);
    rows.mockResolvedValue(CELLS.map((c) => ({ month: c.month, status: c.status, n: c.n })));
    const viaLive = await getStageCohorts(["ANALYST REVIEW", "RFI ISSUED"]);
    expect(viaDoc).toEqual(viaLive);
  });

  it("returns nothing for an empty status list without reading anything", async () => {
    expect(await getStageCohorts([])).toEqual([]);
    expect(one).not.toHaveBeenCalled();
    expect(rows).not.toHaveBeenCalled();
  });
});
