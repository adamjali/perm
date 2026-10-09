import { describe, expect, it } from "vitest";

import {
  API_PLANS,
  API_SCOPES,
  DEFAULT_SCOPES,
  GRANTABLE_SCOPES,
  apiPlan,
  entitlement,
  hasScope,
  normaliseScopes,
  paywallEnforced,
} from "./apiPlans";

describe("the paywall switch", () => {
  it("is off unless the deployment says on", () => {
    expect(paywallEnforced(undefined)).toBe(false);
    expect(paywallEnforced("")).toBe(false);
    expect(paywallEnforced("0")).toBe(false);
    expect(paywallEnforced("false")).toBe(false);
    expect(paywallEnforced("off")).toBe(false);
    expect(paywallEnforced("1")).toBe(true);
    expect(paywallEnforced("true")).toBe(true);
    expect(paywallEnforced(" ON ")).toBe(true);
  });

  it("gives every account Plus while it's off, and says which plan the account is on", () => {
    const e = entitlement("free", false);
    expect(e.plan).toBe(API_PLANS.plus);
    expect(e.accountPlan).toBe("free");
    expect(e.paywall).toBe(false);
  });

  it("lets the account's own plan decide once it's on", () => {
    expect(entitlement("free", true).plan).toBe(API_PLANS.free);
    expect(entitlement("plus", true).plan).toBe(API_PLANS.plus);
    expect(entitlement(undefined, true).plan).toBe(API_PLANS.free);
    expect(entitlement("plus", true).paywall).toBe(true);
  });

  it("reads an unknown stored plan as Free", () => {
    expect(apiPlan("enterprise").id).toBe("free");
    expect(entitlement("enterprise", true).accountPlan).toBe("free");
  });
});

describe("what each plan allows", () => {
  it("keeps Free at today's limits", () => {
    expect(API_PLANS.free).toMatchObject({ keys: 1, perMinute: 10, perDay: 300, perMonth: 3_000 });
    expect(API_PLANS.free.exportRows).toBe(0);
    expect(API_PLANS.free.liveLookupsPerDay).toBe(0);
  });

  it("gives Plus the plan's Plus row", () => {
    expect(API_PLANS.plus).toMatchObject({
      keys: 3,
      perMinute: 30,
      perMonth: 30_000,
      exportRows: 1_000,
      liveLookupsPerDay: 200,
      webhookWatches: 100,
    });
  });

  it("lets every plan hold sandbox keys, and keeps webhooks, exports and live lookups for Plus", () => {
    for (const p of Object.values(API_PLANS)) expect(p.sandboxKeys).toBeGreaterThan(0);
    expect(API_PLANS.free).toMatchObject({ exportRows: 0, liveLookupsPerDay: 0, webhookEndpoints: 0, webhookWatches: 0 });
    expect(API_PLANS.plus.webhookEndpoints).toBeGreaterThan(0);
  });
});

describe("scopes", () => {
  it("never grants writing cases: it's reserved", () => {
    expect(API_SCOPES).toContain("cases_write");
    expect(GRANTABLE_SCOPES).not.toContain("cases_write");
    expect(normaliseScopes(["read", "cases_write"])).toEqual(["read"]);
  });

  it("drops unknown and repeated scopes, and keeps the canonical order", () => {
    expect(normaliseScopes(["webhooks", "nope", "read", "read"])).toEqual(["read", "webhooks"]);
  });

  it("always includes reading public records", () => {
    expect(normaliseScopes(["export"])).toEqual(["read", "export"]);
    expect(normaliseScopes([])).toEqual(["read"]);
  });

  it("treats a key made before scopes as holding the default set", () => {
    expect(hasScope(undefined, "export")).toBe(true);
    expect(hasScope(undefined, "cases_read")).toBe(false);
    expect(DEFAULT_SCOPES).toEqual(["read", "export", "live_lookup", "webhooks"]);
  });

  it("answers from the key's own list", () => {
    expect(hasScope(["read"], "export")).toBe(false);
    expect(hasScope(["read", "export"], "export")).toBe(true);
    expect(hasScope(["read", "cases_write"], "cases_write")).toBe(false);
  });
});
