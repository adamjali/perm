import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_PLANS } from "@convex/lib/apiPlans";

const authenticate = vi.fn();
const usageFor = vi.fn();
const liveLookupsUsed = vi.fn();
vi.mock("@/lib/api/auth", () => ({ authenticate: (...a: unknown[]) => authenticate(...a) }));
vi.mock("@/lib/api/live", () => ({ liveLookupsUsed: (...a: unknown[]) => liveLookupsUsed(...a) }));
vi.mock("@/lib/api/usage", async (orig) => ({
  ...(await orig<typeof import("@/lib/api/usage")>()),
  usageFor: (...a: unknown[]) => usageFor(...a),
}));

import { GET } from "../route";

const caller = {
  kind: "key" as const,
  keyId: "KEY00001",
  account: "acct_a",
  plan: API_PLANS.plus,
  accountPlan: "free" as const,
  paywall: false,
  scopes: ["read", "export"],
  sandbox: false,
  expiresAt: null,
};
const req = () => new Request("https://permtracker.app/v1/me", { headers: { authorization: "Bearer x" } });

beforeEach(() => {
  authenticate.mockReset().mockResolvedValue({ ok: true, caller });
  usageFor.mockReset().mockResolvedValue({ today: 12, month: 340 });
  liveLookupsUsed.mockReset().mockResolvedValue({ account: 3, all: 90 });
});

describe("GET /v1/me", () => {
  it("names the plan that applies, the account's own plan and whether the paywall is on", async () => {
    const body = (await (await GET(req())).json()).data;
    expect(body.plan).toMatchObject({ id: "plus", exportRows: 1_000, liveLookupsPerDay: 200, webhookWatches: 100 });
    expect(body.accountPlan).toEqual({ id: "free", name: "Free" });
    expect(body.paywall.enforced).toBe(false);
    expect(body.paywall.note).toMatch(/free for now/);
  });

  it("reports calls and live lookups used, and what's left", async () => {
    const body = (await (await GET(req())).json()).data;
    expect(body.usage).toMatchObject({ today: 12, thisMonth: 340, liveLookupsToday: 3, liveLookupsRemainingToday: 197 });
    expect(body.key).toEqual({ id: "KEY00001", sandbox: false, scopes: ["read", "export"], expiresAt: null });
  });

  it("reads nothing for a sandbox key, whose calls are never counted", async () => {
    authenticate.mockResolvedValue({ ok: true, caller: { ...caller, sandbox: true } });
    const body = (await (await GET(req())).json()).data;
    expect(body.usage).toMatchObject({ today: 0, liveLookupsToday: 0, note: "Sandbox keys aren't counted." });
    expect(usageFor).not.toHaveBeenCalled();
    expect(liveLookupsUsed).not.toHaveBeenCalled();
  });

  it("refuses a call with no key", async () => {
    authenticate.mockResolvedValue({ ok: true, caller: { kind: "anonymous" } });
    expect((await GET(req())).status).toBe(401);
  });
});
