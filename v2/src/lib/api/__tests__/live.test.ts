import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const bump = vi.fn();
const one = vi.fn();
const discover = vi.fn();
const flagDiscover = vi.fn();
const readCase = vi.fn();
vi.mock("@/lib/turso/embedLookup", () => ({ bumpDocCount: (...a: unknown[]) => bump(...a) }));
vi.mock("@/lib/turso/client", () => ({ one: (...a: unknown[]) => one(...a) }));
vi.mock("@/lib/turso/caseDiscovery", () => ({ discoverCaseOutcome: (...a: unknown[]) => discover(...a) }));
vi.mock("@/lib/turso/pwdCases", () => ({ pwd: { discoverOutcome: (...a: unknown[]) => flagDiscover(...a) } }));
vi.mock("@/lib/turso/lcaCases", () => ({ lca: { discoverOutcome: (...a: unknown[]) => flagDiscover(...a) } }));
vi.mock("@/lib/turso/seasonalCases", () => ({ seasonal: { discoverOutcome: (...a: unknown[]) => flagDiscover(...a) } }));
vi.mock("../reads", () => ({ readCase: (...a: unknown[]) => readCase(...a) }));

const { API_LIVE_DAILY_CAP, chargeLiveLookup, liveLookupsUsed, readCaseLive } = await import("../live");
const { API_PLANS } = await import("@convex/lib/apiPlans");

const ACCT = "acct_ABCDEFGHIJKLMNOPQRST";
const NOW = new Date("2026-10-09T14:00:00Z");
const plus = API_PLANS.plus;
const meta = { source: "DOL", asOf: "2026-10-09", url: "https://permtracker.app/x" };
const found = { ok: true, data: { caseNumber: "G-100-26270-123456", status: "ANALYST REVIEW" }, meta };
const missing = { ok: false, status: 404, code: "not_found", message: "No record of this case yet." };

beforeEach(() => {
  bump.mockReset().mockResolvedValue(1);
  one.mockReset();
  discover.mockReset();
  flagDiscover.mockReset();
  readCase.mockReset();
});

describe("the live-lookup ceilings", () => {
  it("charges the account first, then every account together, in one row a UTC day", async () => {
    expect(await chargeLiveLookup(ACCT, plus, NOW)).toEqual({ ok: true });
    expect(bump.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ["api_live_2026-10-09", ACCT],
      ["api_live_2026-10-09", "all"],
    ]);
  });

  it("refuses past the API-wide ceiling", async () => {
    bump.mockResolvedValueOnce(5).mockResolvedValueOnce(API_LIVE_DAILY_CAP + 1);
    expect(await chargeLiveLookup(ACCT, plus, NOW)).toEqual({ ok: false, which: "all" });
  });

  it("refuses past the plan's daily lookups without spending the shared ceiling", async () => {
    bump.mockResolvedValueOnce(plus.liveLookupsPerDay + 1);
    expect(await chargeLiveLookup(ACCT, plus, NOW)).toEqual({ ok: false, which: "account" });
    expect(bump.mock.calls.map((c) => c[1])).toEqual([ACCT]);
  });

  it("refuses a plan without live lookups before counting anything", async () => {
    expect(await chargeLiveLookup(ACCT, API_PLANS.free, NOW)).toEqual({ ok: false, which: "plan" });
    expect(bump).not.toHaveBeenCalled();
  });

  it("asks DOL nothing when the counter can't be written", async () => {
    bump.mockRejectedValue(new Error("db down"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await chargeLiveLookup(ACCT, plus, NOW)).toEqual({ ok: false, which: "error" });
    err.mockRestore();
  });

  it("refuses an account id that could collide with the total", async () => {
    expect(await chargeLiveLookup("all", plus, NOW)).toEqual({ ok: false, which: "error" });
  });

  it("reads today's use back", async () => {
    one.mockResolvedValue({ mine: "7", everyone: 130 });
    expect(await liveLookupsUsed(ACCT, NOW)).toEqual({ account: 7, all: 130 });
  });
});

describe("a live case lookup", () => {
  it("answers a case we hold from our record and charges nothing", async () => {
    readCase.mockResolvedValue(found);
    const r = await readCaseLive("G-100-26270-123456", { account: ACCT, plan: plus }, NOW);
    expect(r).toMatchObject({ ok: true, data: { askedDolLive: false } });
    expect(bump).not.toHaveBeenCalled();
    expect(discover).not.toHaveBeenCalled();
  });

  it("asks DOL for a case we don't hold, then answers from the record it made", async () => {
    readCase.mockResolvedValueOnce(missing).mockResolvedValueOnce(found);
    discover.mockResolvedValue({ found: { status: "ANALYST REVIEW" }, miss: null });
    const r = await readCaseLive("G-100-26270-123456", { account: ACCT, plan: plus }, NOW);
    expect(r).toMatchObject({ ok: true, data: { askedDolLive: true } });
    expect(discover).toHaveBeenCalledWith("G-100-26270-123456", expect.any(Function), NOW);
  });

  it("asks the right program for a wage request", async () => {
    readCase.mockResolvedValueOnce(missing).mockResolvedValueOnce(found);
    flagDiscover.mockResolvedValue({ row: { status: "IN PROCESS" }, miss: null });
    await readCaseLive("P-100-26270-123456", { account: ACCT, plan: plus }, NOW);
    expect(flagDiscover).toHaveBeenCalled();
    expect(discover).not.toHaveBeenCalled();
  });

  it("says DOL holds no such case when DOL answered without it", async () => {
    readCase.mockResolvedValue(missing);
    discover.mockResolvedValue({ found: null, miss: "none" });
    const r = await readCaseLive("G-100-26270-123456", { account: ACCT, plan: plus }, NOW);
    expect(r).toMatchObject({ ok: false, status: 404 });
    expect(r.ok ? "" : r.message).toMatch(/DOL answered just now/);
  });

  it("never calls a slow DOL a missing case", async () => {
    readCase.mockResolvedValue(missing);
    discover.mockResolvedValue({ found: null, miss: "unavailable" });
    const r = await readCaseLive("G-100-26270-123456", { account: ACCT, plan: plus }, NOW);
    expect(r).toMatchObject({ ok: false, status: 503, code: "dol_unavailable" });
    expect(r.ok ? "" : r.message).toMatch(/didn't answer/);
  });

  it("names the limit and its reset in Eastern time when the account's lookups are spent", async () => {
    readCase.mockResolvedValue(missing);
    bump.mockResolvedValueOnce(plus.liveLookupsPerDay + 1);
    const r = await readCaseLive("G-100-26270-123456", { account: ACCT, plan: plus }, NOW);
    expect(r).toMatchObject({ ok: false, status: 429, code: "live_daily_limit" });
    expect(r.ok ? "" : r.message).toMatch(/200 live DOL lookups/);
    expect(r.ok ? "" : r.message).toMatch(/8 PM Eastern/);
    expect(r.ok ? 0 : r.retryAfter).toBeGreaterThan(0);
    expect(discover).not.toHaveBeenCalled();
  });

  it("doesn't ask DOL about something that isn't a case number", async () => {
    readCase.mockResolvedValue({ ok: false, status: 400, code: "bad_request", message: "That isn't a case number." });
    const r = await readCaseLive("hello", { account: ACCT, plan: plus }, NOW);
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(bump).not.toHaveBeenCalled();
  });
});
