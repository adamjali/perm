import { beforeEach, describe, expect, it, vi } from "vitest";

/** A period of the daily counts: bounded periods, a missing document said so, a failed read never an empty period. */

const getFilingsByDay = vi.fn();
vi.mock("@/lib/db/filingsByDay", () => ({ getFilingsByDay }));

const { GET } = await import("../route");
const get = (q: string) => GET(new Request(`https://permtracker.app/api/filings-by-day?${q}`));
const day = (d: string, filed: number) => ({ day: d, filed, waiting: 0, fileOnly: filed, mismatch: 0 });
const doc = {
  asOf: "2026-11-05",
  computedAt: 1,
  from: "2019-10-01",
  programs: {
    perm: { days: [day("2019-10-01", 5), day("2021-03-02", 313), day("2021-03-03", 300)], liveFrom: "2023-06-01" },
    pwd: { days: [], liveFrom: null },
    lca: { days: [day("2021-03-02", 900)], liveFrom: null },
    seasonal: { days: [], liveFrom: null },
  },
};

describe("GET /api/filings-by-day", () => {
  beforeEach(() => {
    getFilingsByDay.mockReset();
  });

  it("refuses a malformed, reversed or too long period with 400, reading nothing", async () => {
    expect((await get("from=2021-3-1&to=2021-03-31")).status).toBe(400);
    expect((await get("from=2021-03-31&to=2021-03-01")).status).toBe(400);
    expect((await get("from=2019-10-01&to=2026-11-05")).status).toBe(400);
    expect(getFilingsByDay).not.toHaveBeenCalled();
  });

  it("answers every program's days inside the period", async () => {
    getFilingsByDay.mockResolvedValue(doc);
    const res = await get("from=2021-03-01&to=2021-03-02");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.programs.perm.map((d: { day: string }) => d.day)).toEqual(["2021-03-02"]);
    expect(body.programs.lca).toHaveLength(1);
    expect(body.programs.pwd).toEqual([]);
  });

  it("says when the document isn't written yet, and answers 503 on a failed read", async () => {
    getFilingsByDay.mockResolvedValue(null);
    expect((await get("from=2021-03-01&to=2021-03-31")).status).toBe(404);
    getFilingsByDay.mockRejectedValue(new Error("db down"));
    expect((await get("from=2021-03-01&to=2021-03-31")).status).toBe(503);
  });
});
