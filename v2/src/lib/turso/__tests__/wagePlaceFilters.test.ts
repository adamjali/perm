import { beforeEach, describe, expect, it, vi } from "vitest";

import { WAGE_SECTORS, placeFilterRefusal, sectorCodes } from "@/lib/wagePlaceFilters";

/**
 * The salary explorer's city and industry narrowings, at the SQL.
 *
 * The defect worth pinning lives in the predicate: a city or a sector that
 * doesn't reach the WHERE clause returns the state's figures under the
 * city's name, and nothing on the page would look wrong.
 */
const rowsMock = vi.fn();
const oneMock = vi.fn();
vi.mock("../client", () => ({
  rows: (...a: unknown[]) => rowsMock(...a),
  one: (...a: unknown[]) => oneMock(...a),
  turso: () => ({}),
  exec: vi.fn(),
}));

const { getWageStats, getWageHistogram } = await import("../publicData");

beforeEach(() => {
  rowsMock.mockReset().mockResolvedValue([]);
  oneMock.mockReset().mockResolvedValue({ n: 0 });
});

describe("wage reads with a city and a sector", () => {
  it("binds the city without case and every code of the sector", async () => {
    await getWageStats({ state: "WA", city: "Seattle", sectorCodes: ["31", "32", "33"] });
    const [sql, args] = oneMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("worksite_city = ? COLLATE NOCASE");
    expect(sql).toContain("substr(naics, 1, 2) IN (?, ?, ?)");
    expect(args).toEqual(["certified", "WA", "Seattle", "31", "32", "33"]);
  });

  it("carries the same narrowing into the histogram", async () => {
    await getWageHistogram({ state: "WA", city: "Seattle" }, 10000);
    const [sql, args] = rowsMock.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("worksite_city = ? COLLATE NOCASE");
    expect(args).toEqual([10000, 10000, "certified", "WA", "Seattle"]);
  });

  it("adds nothing when neither is set", async () => {
    await getWageStats({ state: "WA" });
    const [sql] = oneMock.mock.calls[0] as [string];
    expect(sql).not.toContain("worksite_city");
    expect(sql).not.toContain("naics");
  });
});

describe("the place-filter rule", () => {
  it("needs a state for a city, and a state or an occupation for an industry", () => {
    expect(placeFilterRefusal({ city: "Seattle" })).toMatch(/needs a state/);
    expect(placeFilterRefusal({ city: "Seattle", state: "WA" })).toBeNull();
    expect(placeFilterRefusal({ sector: "51" })).toMatch(/state or an occupation/);
    expect(placeFilterRefusal({ sector: "51", soc: "15-1252" })).toBeNull();
  });

  it("offers one option per sector, spanning its codes", () => {
    expect(sectorCodes("44")).toEqual(["44", "45"]);
    expect(sectorCodes("45")).toBeNull();
    expect(WAGE_SECTORS.filter((s) => s.label === "Manufacturing")).toHaveLength(1);
  });
});
