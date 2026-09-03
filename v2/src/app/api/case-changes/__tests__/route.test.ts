import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The guards on the route the change feed fetches from.
 *
 * Every case here is one item from the public-endpoint checklist in
 * v2/CLAUDE.md, and the window check is the one that is specific to this
 * route: the date is a cache key AND an indexed lookup, so an unbounded date
 * space lets a crawler mint one edge-cache entry and one database read per
 * value it invents. Bounding it is arithmetic and touches nothing.
 *
 * The cache header is asserted too, because it is not decoration here: a
 * settled day is immutable and a whole-day fetch is only affordable at one
 * Turso read per day per cache entry. Losing `s-maxage` would turn every
 * visitor into a database read and reproduce the August cost incident on a
 * smaller scale.
 */

const getChangeDay = vi.fn();
vi.mock("@/lib/turso/changes", () => ({
  getChangeDay,
  DAY_ROW_CAP: 5000,
}));

const { GET } = await import("../route");

const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

function get(qs: string): Request {
  return new Request(`https://permtracker.app/api/case-changes?${qs}`);
}

beforeEach(() => {
  getChangeDay.mockReset();
  getChangeDay.mockResolvedValue({
    date: today,
    changes: [],
    total: 0,
    byProgram: { perm: 0, pwd: 0, lca: 0 },
    transitions: [],
    expiriesExcluded: 0,
    bulkExcluded: 0,
  });
});

describe("GET /api/case-changes", () => {
  it("refuses anything that is not exactly YYYY-MM-DD, before reading anything", async () => {
    for (const bad of ["", "2026-9-3", "2026/09/03", "yesterday", "2026-09-03'", "../../etc"]) {
      const res = await GET(get(`date=${encodeURIComponent(bad)}`));
      expect([bad, res.status]).toEqual([bad, 400]);
    }
    expect(getChangeDay).not.toHaveBeenCalled();
  });

  it("refuses a date outside the window the record can cover", async () => {
    // A shape-valid date is still a cache key and an indexed lookup. 400 rather
    // than an empty 200, so a typo does not mint an entry.
    const future = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    expect((await GET(get(`date=${future}`))).status).toBe(400);
    expect((await GET(get("date=1970-01-02"))).status).toBe(400);
    expect(getChangeDay).not.toHaveBeenCalled();
  });

  it("distinguishes a bad date from a day that simply holds nothing", async () => {
    // Every typo reading as the same failure is how a real outage hides.
    getChangeDay.mockResolvedValue(null);
    const res = await GET(get(`date=${yesterday}`));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ day: null });
  });

  it("clamps the row limit rather than trusting the caller", async () => {
    await GET(get(`date=${yesterday}&limit=100000`));
    expect(getChangeDay).toHaveBeenCalledWith(yesterday, 5000);

    getChangeDay.mockClear();
    await GET(get(`date=${yesterday}&limit=-4`));
    expect(getChangeDay).toHaveBeenCalledWith(yesterday, 1);

    getChangeDay.mockClear();
    await GET(get(`date=${yesterday}&limit=banana`));
    expect(getChangeDay).toHaveBeenCalledWith(yesterday, 100);
  });

  it("caches a settled day hard and today's briefly", async () => {
    const settled = await GET(get(`date=${yesterday}`));
    expect(settled.headers.get("Cache-Control")).toContain("s-maxage=86400");

    // A past day cannot gain events. Today's can, so it may not be frozen for
    // a day: the sweep runs twice.
    const live = await GET(get(`date=${today}`));
    expect(live.headers.get("Cache-Control")).toContain("s-maxage=600");
  });
});
