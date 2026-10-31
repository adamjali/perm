import { beforeEach, describe, expect, it, vi } from "vitest";

import { bulletinsOf } from "@/lib/bulletinLineHistory";

/** One visa bulletin line for the age-out calculator: checked inputs, a named miss, and a failed read said as one. */

const getVisaBulletinSeries = vi.fn();
const getFamilyBulletinSeries = vi.fn();
vi.mock("@/lib/db/publicData", () => ({ getVisaBulletinSeries, getFamilyBulletinSeries }));

const { GET } = await import("../route");
const get = (q: string) => GET(new Request(`https://permtracker.app/api/bulletin-line?${q}`));

const series = [
  { bulletinMonth: "2026-11", finalAction: { EB2: { india: "01JAN14" } }, datesForFiling: { EB2: { india: "15JUL14" } }, archivedAt: "", sourceUrl: "" },
  { bulletinMonth: "2026-10", finalAction: { EB2: { india: "15DEC13" } }, datesForFiling: {}, archivedAt: "", sourceUrl: "" },
];

describe("GET /api/bulletin-line", () => {
  beforeEach(() => {
    getVisaBulletinSeries.mockReset();
    getFamilyBulletinSeries.mockReset();
  });

  it("refuses a bad set, category or country with 400 and reads nothing", async () => {
    expect((await get("set=both&category=EB2&country=india")).status).toBe(400);
    expect((await get("category=EB-2&country=india")).status).toBe(400);
    expect((await get("category=EB2&country=canada")).status).toBe(400);
    expect(getVisaBulletinSeries).not.toHaveBeenCalled();
  });

  it("answers one line, oldest month first, a month without a cell kept as null", async () => {
    getVisaBulletinSeries.mockResolvedValue(series);
    const res = await get("category=eb2&country=INDIA");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.line.months).toEqual([
      { month: "2026-10", finalAction: "15DEC13", datesForFiling: null },
      { month: "2026-11", finalAction: "01JAN14", datesForFiling: "15JUL14" },
    ]);
    expect(res.headers.get("cache-control")).toMatch(/s-maxage=3600/);
    // And back into the calculators' shape, cell for cell.
    expect(bulletinsOf(body.line)[1]).toEqual({
      bulletinMonth: "2026-11",
      finalAction: { EB2: { india: "01JAN14" } },
      datesForFiling: { EB2: { india: "15JUL14" } },
    });
  });

  it("reads the family charts for set=family", async () => {
    getFamilyBulletinSeries.mockResolvedValue([{ bulletinMonth: "2026-11", finalAction: { F2A: { mexico: "01FEB24" } }, datesForFiling: {}, archivedAt: "", sourceUrl: "" }]);
    const res = await get("set=family&category=F2A&country=mexico");
    expect(res.status).toBe(200);
    expect(getVisaBulletinSeries).not.toHaveBeenCalled();
  });

  it("names the categories it holds when asked for one it doesn't", async () => {
    getVisaBulletinSeries.mockResolvedValue(series);
    const res = await get("category=EB9&country=india");
    expect(res.status).toBe(404);
    expect((await res.json()).message).toMatch(/holds EB2/);
  });

  it("says a failed read, never an empty line", async () => {
    getVisaBulletinSeries.mockRejectedValue(new Error("SQLITE_BUSY"));
    const res = await get("category=EB2&country=india");
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
