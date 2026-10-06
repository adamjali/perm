import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Watching your own case from onboarding. The alert can only ever go to the
 * signed-in account's own address, and a verified address is not asked to
 * confirm itself again; an unverified one takes the ordinary double opt-in.
 */

const CASE = "G-100-26010-550166";
const originalFetch = global.fetch;

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret");
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  vi.stubEnv("BLOCKED_EMAILS", "");
  vi.stubEnv("TURSO_DATABASE_URL", "https://example.turso.io");
  vi.stubEnv("TURSO_AUTH_TOKEN", "stub-token");
  // The seeding read and any confirmation send land here: an empty table and
  // an accepted email, so a background function never reaches the network.
  global.fetch = (async (url: unknown) => {
    const href = String(url);
    if (href.includes("/v2/pipeline")) {
      return new Response(
        JSON.stringify({
          results: [{ type: "ok", response: { type: "execute", result: { cols: [], rows: [] } } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ id: "email_1" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

async function account(t: ReturnType<typeof createTestContext>, email: string, verified: boolean) {
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { email });
    await ctx.db.insert("authAccounts", {
      userId: id,
      provider: "password",
      providerAccountId: email,
      ...(verified ? { emailVerified: email } : {}),
    });
    return id as Id<"users">;
  });
  return t.withIdentity({ subject: userId, email });
}

async function rows(t: ReturnType<typeof createTestContext>) {
  return await t.run(async (ctx) => ctx.db.query("caseStatusAlerts").collect());
}

describe("watchMyCase", () => {
  it("watches at once for a verified account, on its own address, with no confirmation email", async () => {
    const t = createTestContext();
    const me = await account(t, "Owner@Example.com", true);
    const res = await me.mutation(api.caseAlerts.watchMyCase, { caseNumber: ` ${CASE.toLowerCase()} ` });
    expect(res).toMatchObject({ ok: true, caseNumber: CASE });
    expect(res.confirmationSent).toBeUndefined();
    const [row] = await rows(t);
    expect(row).toMatchObject({ email: "owner@example.com", caseNumber: CASE, source: "onboarding" });
    expect(row!.confirmedAt).toBeTypeOf("number");
    expect(row!.lastConfirmationSentAt).toBeUndefined();
    expect(row!.pendingCaseNumber).toBeUndefined();
  });

  it("sends the ordinary confirmation when the address was never verified", async () => {
    const t = createTestContext();
    const me = await account(t, "new@example.com", false);
    const res = await me.mutation(api.caseAlerts.watchMyCase, { caseNumber: CASE });
    expect(res).toMatchObject({ ok: true, confirmationSent: true });
    const [row] = await rows(t);
    expect(row!.confirmedAt).toBeUndefined();
    expect(row!.pendingCaseNumber).toBe(CASE);
    expect(row!.lastConfirmationSentAt).toBeTypeOf("number");
  });

  it("puts an address that left back on the list, because the owner asked while signed in", async () => {
    const t = createTestContext();
    const me = await account(t, "back@example.com", true);
    await t.run(async (ctx) => {
      await ctx.db.insert("caseStatusAlerts", {
        email: "back@example.com",
        caseNumber: CASE,
        createdAt: 1,
        confirmedAt: 1,
        unsubscribedAt: 2,
      });
    });
    expect((await me.mutation(api.caseAlerts.watchMyCase, { caseNumber: CASE })).ok).toBe(true);
    const all = await rows(t);
    expect(all).toHaveLength(1);
    expect(all[0]!.unsubscribedAt).toBeUndefined();
    expect(all[0]!.confirmedAt).toBe(1);
  });

  it("refuses something that isn't a case number and writes nothing", async () => {
    const t = createTestContext();
    const me = await account(t, "x@example.com", true);
    const res = await me.mutation(api.caseAlerts.watchMyCase, { caseNumber: "my case please" });
    expect(res.ok).toBe(false);
    expect(await rows(t)).toHaveLength(0);
    const long = await me.mutation(api.caseAlerts.watchMyCase, { caseNumber: "G".repeat(10_000) });
    expect(long.ok).toBe(false);
  });

  it("refuses a caller who isn't signed in", async () => {
    const t = createTestContext();
    await expect(t.mutation(api.caseAlerts.watchMyCase, { caseNumber: CASE })).rejects.toThrow();
  });
});
