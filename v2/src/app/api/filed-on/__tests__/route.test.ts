import { beforeEach, describe, expect, it, vi } from "vitest";

/** One program's filings for one day: bounded days, known programs, never an empty day on a failed read. */

const getFiledOnProgram = vi.fn();
vi.mock("@/lib/db/filingDay", () => ({ getFiledOnProgram }));
vi.mock("@convex/lib/time", async (orig) => ({ ...(await orig<object>()), easternDay: () => "2026-11-05" }));

const { GET } = await import("../route");
const get = (q: string) => GET(new Request(`https://permtracker.app/api/filed-on?${q}`));

describe("GET /api/filed-on", () => {
  beforeEach(() => {
    getFiledOnProgram.mockReset();
  });

  it("refuses a malformed day or an unknown program with 400, reading nothing", async () => {
    expect((await get("day=2026-11-5&program=lca")).status).toBe(400);
    expect((await get("day=2026-11-04&program=h1b")).status).toBe(400);
    expect(getFiledOnProgram).not.toHaveBeenCalled();
  });

  it("answers 404 for a day before the first listed one or after today, reading nothing", async () => {
    expect((await get("day=2019-09-30&program=perm")).status).toBe(404);
    expect((await get("day=2026-11-06&program=perm")).status).toBe(404);
    expect(getFiledOnProgram).not.toHaveBeenCalled();
  });

  it("answers the day's cases, kept an hour, with empty fields left out", async () => {
    getFiledOnProgram.mockResolvedValue({
      cases: [{ caseNumber: "I-200-26308-341052", status: "IN PROCESS", employer: "Acme", employerSlug: null, jobTitle: "Engineer", final: false, source: "live", wage: null }],
      capped: false,
    });
    const res = await get("day=2026-11-04&program=lca");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
    const text = await res.text();
    expect(text).not.toContain("null");
    expect(JSON.parse(text)).toMatchObject({ day: "2026-11-04", program: "lca", capped: false, cases: [{ caseNumber: "I-200-26308-341052", source: "live" }] });
    expect(getFiledOnProgram).toHaveBeenCalledWith("2026-11-04", "lca");
  });

  it("answers 503 when the read fails, never an empty day", async () => {
    getFiledOnProgram.mockRejectedValue(new Error("db down"));
    const res = await get("day=2026-11-04&program=perm");
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/couldn't be read/);
  });
});
