import { beforeEach, describe, expect, it, vi } from "vitest";

/** The day picker's route: bounded dates, honest misses, and a cached answer. */

const getCensusOn = vi.fn();
const getProcessingTimesOn = vi.fn();
vi.mock("@/lib/db/backlog", () => ({ getCensusOn }));
vi.mock("@/lib/db/processingTimes", () => ({
  getProcessingTimesOn,
  analystPositionOf: (s: { permAsOf: string; month: string }) => ({ month: s.month, asOf: s.permAsOf }),
}));
vi.mock("@convex/lib/time", async (orig) => ({ ...(await orig<object>()), easternDay: () => "2026-10-28" }));

const { GET } = await import("../route");
const get = (day: string) => GET(new Request(`https://permtracker.app/api/queue-day?day=${day}`));
const month = { month: "2026-01", total: 10, pending: 8, decided: 2, decidedPct: 20, statuses: [] };

describe("GET /api/queue-day", () => {
  beforeEach(() => {
    getCensusOn.mockReset();
    getProcessingTimesOn.mockReset();
  });

  it("refuses a malformed day with 400 and reads nothing", async () => {
    expect((await get("2026-9-1")).status).toBe(400);
    expect(getCensusOn).not.toHaveBeenCalled();
  });

  it("answers 404 for a day outside the series without a read", async () => {
    expect((await get("2026-08-29")).status).toBe(404);
    expect((await get("2026-10-28")).status).toBe(404);
    expect(getCensusOn).not.toHaveBeenCalled();
  });

  it("answers 404 for a day the table doesn't hold", async () => {
    getCensusOn.mockResolvedValue([]);
    getProcessingTimesOn.mockResolvedValue(null);
    expect((await get("2026-09-15")).status).toBe(404);
  });

  it("answers the day's months and DOL's line by then, cached a day", async () => {
    getCensusOn.mockResolvedValue([month]);
    getProcessingTimesOn.mockResolvedValue({ permAsOf: "2026-09-12", month: "2025-11" });
    const res = await get("2026-09-15");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ day: "2026-09-15", months: [month], dol: { month: "2025-11", asOf: "2026-09-12" } });
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("answers 503 when the read fails, never an empty queue", async () => {
    getCensusOn.mockRejectedValue(new Error("deadline"));
    getProcessingTimesOn.mockResolvedValue(null);
    expect((await get("2026-09-15")).status).toBe(503);
  });
});
