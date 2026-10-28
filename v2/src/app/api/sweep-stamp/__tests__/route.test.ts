import { beforeEach, describe, expect, it, vi } from "vitest";

/** The stamp an open page polls: the sweep's finish time, cached a minute at the edge. */

const getSweepCoverage = vi.fn();
vi.mock("@/lib/db/sweepCoverage", () => ({ getSweepCoverage }));

const { GET } = await import("../route");

describe("GET /api/sweep-stamp", () => {
  beforeEach(() => {
    getSweepCoverage.mockReset();
  });

  it("answers the sweep's finish time, cached a minute", async () => {
    getSweepCoverage.mockResolvedValue({ checkedAt: 1793130031205 });
    const res = await GET();
    expect(await res.json()).toEqual({ checkedAt: 1793130031205 });
    expect(res.headers.get("cache-control")).toContain("s-maxage=60");
  });

  it("answers null when no recent sweep is on record or the read fails", async () => {
    getSweepCoverage.mockResolvedValue(null);
    expect(await (await GET()).json()).toEqual({ checkedAt: null });
    getSweepCoverage.mockImplementation(async () => {
      throw new Error("deadline");
    });
    expect(await (await GET()).json()).toEqual({ checkedAt: null });
  });
});
