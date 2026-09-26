import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The salary explorer route's city and industry narrowings.
 *
 * Neither column is indexed on `perm_cases`, so each is accepted only on top
 * of a slice an index serves: a city inside a state, an industry inside a
 * state or an occupation. Alone, either would walk the whole table on every
 * uncached request, and that must be a 400, never a slow 200.
 */

const getWageStats = vi.fn();
const getWageHistogram = vi.fn();
const getWageByState = vi.fn();
vi.mock("@/lib/turso/publicData", () => ({ getWageStats, getWageHistogram, getWageByState }));

const { GET } = await import("../route");

const call = (qs: string) => GET(new Request(`https://permtracker.app/api/perm-wages?${qs}`));

beforeEach(() => {
  getWageStats.mockReset();
  getWageHistogram.mockReset();
  getWageByState.mockReset();
  // Below the median floor, so the route answers from the stats alone.
  getWageStats.mockResolvedValue({ n: 3, avg: null, p5: null, p25: null, p50: null, p75: null, p95: null });
});

describe("GET /api/perm-wages city and industry", () => {
  it("refuses a city without a state, and reads nothing", async () => {
    const r = await call("city=Seattle");
    expect(r.status).toBe(400);
    expect((await r.json()).error).toMatch(/city filter needs a state/);
    expect(getWageStats).not.toHaveBeenCalled();
  });

  it("refuses an industry with neither a state nor an occupation", async () => {
    const r = await call("sector=51");
    expect(r.status).toBe(400);
    expect(getWageStats).not.toHaveBeenCalled();
  });

  it("refuses a sector it doesn't know, and a city longer than any DOL prints", async () => {
    expect((await call("state=WA&sector=99")).status).toBe(400);
    expect((await call(`state=WA&city=${"x".repeat(61)}`)).status).toBe(400);
    expect(getWageStats).not.toHaveBeenCalled();
  });

  it("passes a city inside its state, spaces collapsed", async () => {
    const r = await call("state=WA&city=%20Seattle%20%20");
    expect(r.status).toBe(200);
    expect(getWageStats).toHaveBeenCalledWith(expect.objectContaining({ state: "WA", city: "Seattle" }));
  });

  it("passes every code of a sector that spans several", async () => {
    const r = await call("soc=15-1252&sector=31");
    expect(r.status).toBe(200);
    expect(getWageStats).toHaveBeenCalledWith(
      expect.objectContaining({ socCode: "15-1252", sectorCodes: ["31", "32", "33"] }),
    );
  });
});
