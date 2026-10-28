import { beforeEach, describe, expect, it, vi } from "vitest";

const pwdData = vi.fn();
const permCtx = vi.fn();
const permCase = vi.fn();
const snapshot = vi.fn();
const line = vi.fn();
const pwdDay = vi.fn();

vi.mock("@/lib/db/pwdDayQueue", () => ({ getPwdDayData: () => pwdData() }));
vi.mock("@/lib/db/permEstimate", () => ({
  loadPermEstimateContext: () => permCtx(),
  estimatePermCase: (...a: unknown[]) => permCase(...a),
}));
vi.mock("@/lib/db/greenCardLine", () => ({ getLineSnapshot: () => snapshot() }));
vi.mock("@/lib/greenCardLine", () => ({ estimateLine: (...a: unknown[]) => line(...a) }));
vi.mock("@/lib/perm", () => ({ estimatePwdDay: (...a: unknown[]) => pwdDay(...a) }));
vi.mock("@convex/lib/time", () => ({ easternDay: () => "2026-10-28" }));

const { GET } = await import("../route");
const ask = (qs: string) => GET(new Request(`https://permtracker.app/api/plan?${qs}`));

beforeEach(() => {
  vi.clearAllMocks();
  pwdData.mockResolvedValue({ queue: {}, measuredRange: [] });
  pwdDay.mockReturnValue({ kind: "estimate", date: "2026-11-24", earliest: "2026-11-20", latest: "2026-11-30", requestsAhead: 41000, pace: 760 });
  permCtx.mockResolvedValue({ decisionPace: { pace: { pace: 625 } } });
  permCase.mockReturnValue({
    estimate: { kind: "date", estimatedDate: "2026-12-20", earliestDate: "2026-12-01", latestDate: "2027-01-15" },
    casesAhead: 18000,
  });
  snapshot.mockResolvedValue({});
  line.mockReturnValue({ kind: "estimate", peopleAhead: { low: 20000, mid: 30000, high: 40000 }, supply: { fy: 2024, perYear: 40000 } });
});

describe("GET /api/plan", () => {
  it("dates a filed wage request and a filed PERM with its line, from the case pages' own models", async () => {
    const res = await ask("pwd=2026-07-10&perm=2026-02-10&pd=2026-02-10&cat=EB2&country=worldwide");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      pwd: { low: "2026-11-20", mid: "2026-11-24", high: "2026-11-30", casesAhead: 41000, perDay: 760 },
      perm: { low: "2026-12-01", mid: "2026-12-20", high: "2027-01-15", casesAhead: 18000, perDay: 625 },
      permNote: null,
      line: { peopleAhead: { low: 20000, mid: 30000, high: 40000 }, perYear: 40000, fy: 2024 },
    });
    // The PERM is dated as a case in line, the planner knowing no status.
    expect(permCase).toHaveBeenCalledWith(expect.anything(), { filingDate: "2026-02-10", status: "ANALYST REVIEW" }, "2026-10-28");
    expect(line).toHaveBeenCalledWith({ category: "EB2", country: "worldwide", priorityDate: "2026-02-10" }, {});
  });

  it("answers the line for an old priority date without asking the queues", async () => {
    const body = await (await ask("pd=2014-03-02&cat=EB2&country=india")).json();
    expect(body.line).toEqual({ peopleAhead: { low: 20000, mid: 30000, high: 40000 }, perYear: 40000, fy: 2024 });
    expect(body.perm).toBeNull();
    expect(permCtx).not.toHaveBeenCalled();
    expect(pwdData).not.toHaveBeenCalled();
  });

  it("answers whole counts, never a fraction of a person", async () => {
    pwdDay.mockReturnValue({ kind: "estimate", date: "2026-11-24", earliest: "2026-11-20", latest: "2026-11-30", requestsAhead: 41000.4, pace: 737.3 });
    line.mockReturnValue({ kind: "estimate", peopleAhead: { low: 741560.49, mid: 754651.86, high: 767743.28 }, supply: { fy: 2024, perYear: 3916 } });
    const body = await (await ask("pwd=2026-07-10&pd=2026-02-10&cat=EB2&country=india")).json();
    expect(body.pwd).toMatchObject({ casesAhead: 41000, perDay: 737 });
    expect(body.line.peopleAhead).toEqual({ low: 741560, mid: 754652, high: 767743 });
  });

  it("answers no line when the date is current, never a zero wait", async () => {
    line.mockReturnValue({ kind: "current" });
    expect((await (await ask("pd=2026-02-10&cat=EB2&country=worldwide")).json()).line).toBeNull();
  });

  it("passes on the case page's reason when a PERM has no date", async () => {
    permCase.mockReturnValue({ estimate: { kind: "no-date", note: "DOL's queue passed your month" }, casesAhead: null });
    const body = await (await ask("perm=2025-03-10")).json();
    expect(body.perm).toBeNull();
    expect(body.permNote).toBe("DOL's queue passed your month");
    expect(line).not.toHaveBeenCalled();
  });

  it("answers 400 for a bad question and never reads", async () => {
    expect((await ask("perm=2027-01-01")).status).toBe(400);
    expect((await ask("")).status).toBe(400);
    expect(permCtx).not.toHaveBeenCalled();
  });

  it("answers 503 when a read fails, never an empty answer", async () => {
    permCtx.mockRejectedValue(new Error("tunnel cut"));
    const res = await ask("perm=2026-02-10");
    expect(res.status).toBe(503);
  });
});
