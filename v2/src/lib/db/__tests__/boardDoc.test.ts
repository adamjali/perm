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

const SAVED_PERM = { day: "2026-10-26", span: null, flow: { filed: 1, decided: 2, change: -1, trend: "shrinking", from: "2026-09-27", to: "2026-10-26" }, movesDay: [], movesWeek: [], weekBefore: null, monthBefore: null };

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
    expect(await getPwdBoard()).toBeNull();
    expect(rows).not.toHaveBeenCalled();
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
