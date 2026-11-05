import { beforeEach, describe, expect, it, vi } from "vitest";

/** One year of State's refusal table for /visa-refusals' year picker: a checked year, a named miss, a failed read said as one. */

const refusalSummary = vi.fn();
const refusalsYear = vi.fn();
vi.mock("@/lib/db/visaRefusals", () => ({ refusalSummary, refusalsYear }));

const { GET } = await import("../route");
const get = (q: string) => GET(new Request(`https://permtracker.app/api/visa-refusals?${q}`));

const summary = {
  years: [2022, 2023, 2024],
  newest: 2024,
  totals: { "2023": { iv_found: 263212, iv_overcome: 221198, niv_found: 3125820, niv_overcome: 758450 } },
  knownGaps: {},
  changedOn: "2026-11-05",
};
const ground = { fy: 2023, line: 1, code: "203(c)", ground: "Failure to fulfill", ivFound: 1411, ivOvercome: 53, nivFound: null, nivOvercome: null };

describe("GET /api/visa-refusals", () => {
  beforeEach(() => {
    refusalSummary.mockReset();
    refusalsYear.mockReset();
  });

  it("refuses a missing or malformed year with 400 and reads nothing", async () => {
    for (const q of ["", "fy=", "fy=24", "fy=abcd"]) expect((await get(q)).status, q).toBe(400);
    expect(refusalSummary).not.toHaveBeenCalled();
  });

  it("answers one year's grounds with State's totals", async () => {
    refusalSummary.mockResolvedValue(summary);
    refusalsYear.mockResolvedValue([ground]);
    const res = await get("fy=2023");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toMatch(/s-maxage/);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, fy: 2023, totals: summary.totals["2023"], knownGaps: [] });
    expect(body.grounds).toEqual([ground]);
  });

  it("names the years held when asked for one it doesn't hold", async () => {
    refusalSummary.mockResolvedValue(summary);
    const res = await get("fy=2001");
    expect(res.status).toBe(404);
    expect((await res.json()).message).toContain("FY2022 to FY2024");
    expect(refusalsYear).not.toHaveBeenCalled();
  });

  it("says a failed read is one, never an empty year", async () => {
    refusalSummary.mockRejectedValue(new Error("fetch failed"));
    const res = await get("fy=2024");
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
