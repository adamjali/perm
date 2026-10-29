import { beforeEach, describe, expect, it, vi } from "vitest";

const inState = vi.fn();
vi.mock("@/lib/db/reference", () => ({ wageLevelsInState: (...a: unknown[]) => inState(...a) }));

const { GET } = await import("../route");

const get = (qs: string) => GET(new Request(`https://permtracker.app/api/wage-levels/areas?${qs}`));

describe("GET /api/wage-levels/areas", () => {
  beforeEach(() => {
    inState.mockReset();
  });

  it("refuses a missing or malformed job or state before reading anything", async () => {
    for (const qs of ["", "soc=15-1252", "state=TX", "soc=x&state=TX", "soc=15-1252&state=Texas", "soc=15-1252&state=T1"]) {
      expect((await get(qs)).status, qs).toBe(400);
    }
    expect(inState).not.toHaveBeenCalled();
  });

  it("answers every area of the state for the job, cached a day", async () => {
    inState.mockResolvedValue({ wageYear: 2026, areas: [{ area: "12420", name: "Austin-Round Rock-San Marcos, TX", yearly: [95888, 119642, 143395, 167149], label: null }] });
    const res = await get("soc=15-1252.00&state=tx");
    expect(res.status).toBe(200);
    expect(inState).toHaveBeenCalledWith("15-1252.00", "TX");
    const body = (await res.json()) as { soc: string; state: string; wageYear: number; areas: unknown[] };
    expect(body).toMatchObject({ soc: "15-1252", state: "TX", wageYear: 2026 });
    expect(body.areas).toHaveLength(1);
    expect(res.headers.get("cache-control")).toContain("s-maxage=86400");
  });

  it("says the tables couldn't be read, never an empty state, when the read fails", async () => {
    inState.mockRejectedValue(new Error("database down"));
    const res = await get("soc=15-1252&state=TX");
    expect(res.status).toBe(503);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
