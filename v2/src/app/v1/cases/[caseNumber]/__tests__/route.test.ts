import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_PLANS } from "@convex/lib/apiPlans";

const authenticate = vi.fn();
const takeMinute = vi.fn();
const checkAllowance = vi.fn();
const countCall = vi.fn();
const readCase = vi.fn();
const readCaseLive = vi.fn();
vi.mock("@/lib/api/auth", () => ({ authenticate: (...a: unknown[]) => authenticate(...a) }));
vi.mock("@/lib/api/usage", () => ({
  takeMinute: (...a: unknown[]) => takeMinute(...a),
  checkAllowance: (...a: unknown[]) => checkAllowance(...a),
  countCall: (...a: unknown[]) => countCall(...a),
}));
vi.mock("@/lib/api/reads", () => ({ readCase: (...a: unknown[]) => readCase(...a) }));
vi.mock("@/lib/api/live", () => ({ readCaseLive: (...a: unknown[]) => readCaseLive(...a) }));

import { GET } from "../route";

const caller = (scopes: string[]) => ({
  kind: "key" as const,
  keyId: "KEY00001",
  account: "acct_a",
  plan: API_PLANS.plus,
  accountPlan: "free" as const,
  paywall: false,
  scopes,
  sandbox: false,
  expiresAt: null,
});
const meta = { source: "DOL", asOf: "2026-10-09", url: "https://permtracker.app/perm-case-status" };
const call = (qs = "") =>
  GET(new Request(`https://permtracker.app/v1/cases/G-100-26045-123456${qs}`, { headers: { authorization: "Bearer x" } }), {
    params: Promise.resolve({ caseNumber: "G-100-26045-123456" }),
  });

beforeEach(() => {
  authenticate.mockReset().mockResolvedValue({ ok: true, caller: caller(["read"]) });
  takeMinute.mockReset().mockReturnValue({ ok: true, remaining: 9, reset: 40 });
  checkAllowance.mockReset().mockResolvedValue({ ok: true, today: 3, month: 30 });
  countCall.mockReset();
  readCase.mockReset().mockResolvedValue({ ok: true, data: { caseNumber: "G-100-26045-123456" }, meta });
  readCaseLive.mockReset().mockResolvedValue({ ok: true, data: { caseNumber: "G-100-26045-123456" }, meta });
});

describe("GET /v1/cases/{caseNumber}", () => {
  it("refuses live=1 without the live_lookup scope, asks DOL nothing and counts nothing", async () => {
    const res = await call("?live=1");
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("missing_scope");
    expect(readCaseLive).not.toHaveBeenCalled();
    expect(countCall).not.toHaveBeenCalled();
  });

  it("refuses a live value that isn't 1 or 0", async () => {
    expect((await call("?live=2")).status).toBe(400);
    expect(readCaseLive).not.toHaveBeenCalled();
  });

  it("asks DOL live with the scope, for the caller's account and plan", async () => {
    authenticate.mockResolvedValue({ ok: true, caller: caller(["read", "live_lookup"]) });
    const res = await call("?live=1");
    expect(res.status).toBe(200);
    expect(readCaseLive).toHaveBeenCalledWith("G-100-26045-123456", { account: "acct_a", plan: API_PLANS.plus });
  });

  it("reads our own records without live=1", async () => {
    await call();
    expect(readCase).toHaveBeenCalledWith("G-100-26045-123456");
    expect(readCaseLive).not.toHaveBeenCalled();
  });
});
