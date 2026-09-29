/**
 * The sending limit on sign-in and reset codes (convex/authMail.ts): 5 an
 * hour per address, then 40 a day site-wide, and a site-wide refusal counted
 * for the admin panel.
 */
import { describe, expect, it } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { AUTH_MAIL_PER_ADDRESS, BUDGETS } from "../lib/alertBudgets";
import { isRateLimitError } from "../../src/lib/auth/auth-errors";
import { AUTH_MAIL_REFUSED, AUTH_MAIL_SITE_BUSY } from "../lib/authMailGate";

const charge = (t: ReturnType<typeof createTestContext>, email: string) =>
  t.mutation(internal.authMail.charge, { email });

describe("authMail.charge", () => {
  it("allows 5 codes an hour to one address, in any casing, then refuses", async () => {
    const t = createTestContext();
    const results: string[] = [];
    for (let i = 0; i < AUTH_MAIL_PER_ADDRESS.limit; i++) {
      results.push(await charge(t, i % 2 ? "Person@Example.com" : "person@example.com "));
    }
    expect(results.every((r) => r === "ok")).toBe(true);
    expect(await charge(t, "person@example.com")).toBe("address");
    // Another address is unaffected.
    expect(await charge(t, "someone.else@example.com")).toBe("ok");
  });

  it("a per-address refusal doesn't spend the site-wide pool", async () => {
    const t = createTestContext();
    for (let i = 0; i < AUTH_MAIL_PER_ADDRESS.limit + 3; i++) await charge(t, "a@example.com");
    const spent = await t.run((ctx) =>
      ctx.db
        .query("rateLimits")
        .withIndex("by_key_and_timestamp", (q) => q.eq("key", `${BUDGETS.authMail.key}:all`))
        .collect(),
    );
    expect(spent).toHaveLength(AUTH_MAIL_PER_ADDRESS.limit);
  });

  it("stops at 40 a day site-wide and counts the refusal", async () => {
    const t = createTestContext();
    let allowed = 0;
    const refusedAs = new Set<string>();
    for (let i = 0; i < BUDGETS.authMail.limit + 5; i++) {
      const verdict = await charge(t, `p${i}@example.com`);
      if (verdict === "ok") allowed++;
      else refusedAs.add(verdict);
    }
    expect(allowed).toBe(BUDGETS.authMail.limit);
    // The site-wide pool says so, instead of blaming the address.
    expect([...refusedAs]).toEqual(["site"]);
    const refusals = await t.run((ctx) => ctx.db.query("budgetRefusals").collect());
    expect(refusals.find((r) => r.pool === "authMail")?.count).toBe(5);
  });

  it("both refusals read as 'too many' on every auth form, and they differ", () => {
    expect(isRateLimitError(AUTH_MAIL_REFUSED)).toBe(true);
    expect(isRateLimitError(AUTH_MAIL_SITE_BUSY)).toBe(true);
    expect(AUTH_MAIL_SITE_BUSY).not.toMatch(/this address/);
  });
});
