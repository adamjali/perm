import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The saved board: /today and the planner read the copy the sweep's refresh saves, and run the
 * reads live only when it's missing or older than the newest sweep.
 */

const rows = vi.fn();
const exec = vi.fn();
const doc = vi.fn();
const coverage = vi.fn();
vi.mock("../client", () => ({ rows: (...a: unknown[]) => rows(...a), exec: (...a: unknown[]) => exec(...a) }));
vi.mock("../publicData", () => ({ doc: (k: string) => doc(k) }));
vi.mock("../sweepCoverage", () => ({ getSweepCoverage: () => coverage() }));
vi.mock("../decisionPace", () => ({ OBSERVED_SOURCE: "sweep-observed" }));
vi.mock("../rfi", () => ({ DIRECT_EVENT_SOURCE: "dol-direct" }));

const SAVED_PERM = { day: "2026-10-26", span: { n: 544, middle: "2026-01-19", from: "2026-01-09", to: "2026-01-29" }, flow: { filed: 1, decided: 2, change: -1, trend: "shrinking", from: "2026-09-27", to: "2026-10-26" }, movesDay: [], movesWeek: [], weekBefore: null, monthBefore: null };

beforeEach(() => {
  vi.resetModules();
  rows.mockReset().mockResolvedValue([]);
  exec.mockReset().mockResolvedValue(1);
  doc.mockReset();
  coverage.mockReset().mockResolvedValue({ checkedAt: 1_000 });
});

const load = async () => import("../board");

describe("the saved board", () => {
  it("reads the copy saved after the newest sweep, and runs no live read", async () => {
    doc.mockResolvedValue({ perm: SAVED_PERM, pwd: null, computedAt: 2_000 });
    const { getPermBoard, getPwdBoard } = await load();
    expect(await getPermBoard()).toEqual(SAVED_PERM);
    expect(rows).not.toHaveBeenCalled();
    // The saved wage-request half is empty, so that one half is read live.
    expect(await getPwdBoard()).toBeNull();
  });

  it("reads a half again live when its saved copy has no span", async () => {
    doc.mockResolvedValue({ perm: { ...SAVED_PERM, span: null }, pwd: null, computedAt: 2_000 });
    const { getPermBoard } = await load();
    await getPermBoard();
    expect(rows).toHaveBeenCalled();
  });

  it("reads live when the saved copy is older than the newest sweep", async () => {
    doc.mockResolvedValue({ perm: SAVED_PERM, pwd: null, computedAt: 500 });
    const { getPermBoard } = await load();
    expect(await getPermBoard()).toBeNull();
    expect(rows).toHaveBeenCalled();
  });

  it("reads live when nothing is saved", async () => {
    doc.mockResolvedValue(null);
    const { getPermBoard } = await load();
    await getPermBoard();
    expect(rows).toHaveBeenCalled();
  });

  it("saves both halves under one key with its time", async () => {
    const { writeBoardDoc, BOARD_DOC } = await load();
    const saved = await writeBoardDoc();
    expect(exec).toHaveBeenCalledWith(expect.stringContaining("INSERT OR REPLACE INTO perm_docs"), [
      BOARD_DOC,
      JSON.stringify({ perm: null, pwd: null }),
      saved.computedAt,
    ]);
  });
});

describe("the reading day", () => {
  // Noon Eastern on each day, so every stamp lands on its own DOL day.
  const FRI = Date.parse("2026-10-30T16:00:00Z");
  const SAT = Date.parse("2026-10-31T16:00:00Z");

  it("is DOL's last full working day, so a Saturday's few stragglers don't blank the wage-request span", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T13:00:00Z"));
    try {
      doc.mockResolvedValue(null);
      rows.mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT e.changed_at AS t")) return [{ t: FRI, n: 60 }, { t: SAT, n: 3 }];
        if (sql.includes("SELECT s.filing_date AS f")) return Array.from({ length: 60 }, () => ({ f: "2026-07-20" }));
        if (sql.includes("COUNT(*)")) return [{ n: 100 }];
        return [];
      });
      const { getPwdBoard } = await load();
      const board = await getPwdBoard();
      expect(board?.day).toBe("2026-10-30");
      expect(board?.span).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("is DOL's last full working day on the PERM side too", async () => {
    doc.mockResolvedValue(null);
    rows.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM daily_decisions"))
        return [
          { date: "2026-10-31", total: 4 },
          { date: "2026-10-30", total: 600 },
        ];
      if (sql.includes("SELECT s.filing_date AS f")) return Array.from({ length: 60 }, () => ({ f: "2026-01-19" }));
      return [];
    });
    const { getPermBoard } = await load();
    expect((await getPermBoard())?.day).toBe("2026-10-30");
  });
});
