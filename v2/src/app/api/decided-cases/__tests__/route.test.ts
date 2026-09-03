import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The guards on the route the decided half of the day feed fetches from.
 *
 * Every case here is one item from the public-endpoint checklist in
 * v2/CLAUDE.md. Two are specific to this route.
 *
 * THE DATE PAIR IS A CACHE KEY AND AN INDEXED LOOKUP AT ONCE, so an unbounded
 * date space lets a crawler mint one edge-cache entry and one database read
 * per value it invents. The floor is arithmetic and touches nothing.
 *
 * A REFUSAL MUST NOT LOOK LIKE AN EMPTY DAY. `getDecidedFeed` refuses a range
 * too wide to serve, and that has to reach the caller as a 400. Returning 200
 * with no rows would make "too expensive" and "DOL decided nothing" the same
 * response, and every monitor would read the first as the second.
 */

const getDecidedFeed = vi.fn();
vi.mock("@/lib/turso/decidedDays", async () => {
  // The pure half is real: `isIsoDate` is one of the guards under test, and a
  // mocked version would make the date validation cases vacuous.
  const pure = await vi.importActual<typeof import("@/lib/dateCoverage")>(
    "@/lib/dateCoverage",
  );
  return { ...pure, getDecidedFeed, DECIDED_ROW_CAP: 1000 };
});

const { GET } = await import("../route");

const today = new Date().toISOString().slice(0, 10);

function get(qs: string): Request {
  return new Request(`https://permtracker.app/api/decided-cases?${qs}`);
}

function feed(over: Record<string, unknown> = {}) {
  return {
    range: { from: "2025-03-12", to: "2025-03-12" },
    cases: [],
    totals: { perm: 0, pwd: 0, lca: 0 },
    capped: false,
    refused: null,
    ...over,
  };
}

beforeEach(() => {
  getDecidedFeed.mockReset();
  getDecidedFeed.mockResolvedValue(feed());
});

describe("date validation", () => {
  it.each([
    ["no dates at all", ""],
    ["a shape that is not ISO", "from=12%2F03%2F2025"],
    ["a date that does not exist", "from=2025-02-30"],
    ["a month that does not exist", "from=2025-13-01"],
  ])("400s on %s", async (_label, qs) => {
    const r = await GET(get(qs));
    expect(r.status).toBe(400);
    expect(getDecidedFeed).not.toHaveBeenCalled();
  });

  it("400s when `to` precedes `from` rather than silently swapping them", async () => {
    const r = await GET(get("from=2025-03-12&to=2025-03-01"));
    expect(r.status).toBe(400);
    expect(getDecidedFeed).not.toHaveBeenCalled();
  });

  it("400s below the floor, which bounds the cache key space", async () => {
    const r = await GET(get("from=1999-01-01&to=1999-01-02"));
    expect(r.status).toBe(400);
    expect(getDecidedFeed).not.toHaveBeenCalled();
  });

  it("400s on a future date", async () => {
    const r = await GET(get("from=2099-01-01"));
    expect(r.status).toBe(400);
    expect(getDecidedFeed).not.toHaveBeenCalled();
  });

  it("treats a missing `to` as a single day", async () => {
    await GET(get("from=2025-03-12"));
    expect(getDecidedFeed).toHaveBeenCalledWith(
      expect.objectContaining({ range: { from: "2025-03-12", to: "2025-03-12" } }),
    );
  });

  it("accepts today, whose honest answer may be nothing yet", async () => {
    const r = await GET(get(`from=${today}`));
    expect(r.status).toBe(200);
  });
});

describe("filters are capped before they reach SQL", () => {
  it("drops an over-long value rather than passing it to a query", async () => {
    await GET(get(`from=2025-03-12&employer=${"a".repeat(500)}`));
    expect(getDecidedFeed.mock.calls[0]?.[0].narrow.employer).toBeUndefined();
  });

  it("drops a non-numeric or negative wage instead of sending NaN", async () => {
    await GET(get("from=2025-03-12&minWage=abc&maxWage=-5"));
    const narrow = getDecidedFeed.mock.calls[0]?.[0].narrow;
    expect([narrow.minWage, narrow.maxWage]).toEqual([undefined, undefined]);
  });

  it("keeps a real wage bound", async () => {
    await GET(get("from=2025-03-12&minWage=150000"));
    expect(getDecidedFeed.mock.calls[0]?.[0].narrow.minWage).toBe(150_000);
  });

  it("ignores a program it does not recognise instead of querying a table", async () => {
    await GET(get("from=2025-03-12&program=perm&program=sqlinjection"));
    expect(getDecidedFeed.mock.calls[0]?.[0].programs).toEqual(["perm"]);
  });

  it("clamps the row cap rather than trusting the caller", async () => {
    await GET(get("from=2025-03-12&limit=999999"));
    expect(getDecidedFeed.mock.calls[0]?.[0].cap).toBe(1000);
  });
});

describe("a refusal is distinguishable from an empty range", () => {
  it("400s when the feed refuses, with the reason in the body", async () => {
    getDecidedFeed.mockResolvedValue(feed({ refused: "too wide" }));
    const r = await GET(get("from=2024-01-01&to=2025-01-01&minWage=1"));
    expect(r.status).toBe(400);
    await expect(r.json()).resolves.toEqual({ error: "too wide" });
  });

  it("200s on a valid range that simply holds nothing", async () => {
    getDecidedFeed.mockResolvedValue(feed({ cases: [] }));
    const r = await GET(get("from=2025-03-12"));
    expect(r.status).toBe(200);
  });
});

describe("cache headers", () => {
  it("caches a settled range hard, because a published file does not change", async () => {
    const r = await GET(get("from=2024-01-02&to=2024-01-03"));
    expect(r.headers.get("Cache-Control")).toContain("s-maxage=86400");
  });

  it("keeps a recent range short, because a new file can extend it", async () => {
    const r = await GET(get(`from=${today}&to=${today}`));
    expect(r.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });
});
