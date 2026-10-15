import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.fn();
vi.mock("../client", () => ({ rows: (...a: unknown[]) => rows(...a) }));

import { getProcessingTimesArchive } from "../openData";

const snap = (perm: string, pwd: string) => JSON.stringify({ permAsOf: perm, pwdAsOf: pwd, permQueues: [], permAverageDays: [], pwdQueues: [], pwdPermBacklog: [], sourceUrl: "x" });

beforeEach(() => rows.mockReset());

describe("getProcessingTimesArchive", () => {
  it("reads every (PERM date, wage date) reading, so a wage-only move keeps both", async () => {
    rows.mockResolvedValueOnce([
      { json: snap("2026-09-22", "2026-08-31"), fetched_at: 1 },
      { json: snap("2026-09-22", "2026-09-30"), fetched_at: 2 },
    ]);
    const r = await getProcessingTimesArchive();
    expect(String(rows.mock.calls[0]![0])).toContain("processing_time_readings");
    expect(r.map((x) => x.pwdAsOf)).toEqual(["2026-08-31", "2026-09-30"]);
  });

  it("falls back to one row per PERM date before the readings table exists", async () => {
    rows.mockRejectedValueOnce(new Error("no such table")).mockResolvedValueOnce([{ json: snap("2026-09-22", "2026-09-30"), fetched_at: 2 }]);
    const r = await getProcessingTimesArchive();
    expect(String(rows.mock.calls[1]![0])).toContain("FROM processing_times ");
    expect(r).toHaveLength(1);
  });
});
