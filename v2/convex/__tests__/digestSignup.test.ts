import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { QUEUED_REPLY } from "../confirmationQueue";
import { makeUnsubscribeToken } from "../lib/unsubscribeToken";

/**
 * The weekly digest signed up for on its own (Oct 29 2026): the same double opt-in as the alerts, in the same
 * order. Every reply is the same sentence, and a refusal leaves no row or stamp behind.
 */

const SECRET = "test-secret-for-digest-signup";
const NEUTRAL = "Check your inbox to confirm.";

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  vi.stubEnv("BLOCKED_EMAILS", "");
  // The scheduled send would call Resend; nothing here reads what it sends.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "x" }), { status: 200 })));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const row = (t: ReturnType<typeof createTestContext>, email: string) =>
  t.run(async (ctx) =>
    ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first(),
  );

describe("signing up for the weekly digest alone", () => {
  it("stages the address unconfirmed, stamps it, and answers the neutral sentence", async () => {
    const t = createTestContext();
    const r = await t.mutation(internal.digestSignup.subscribe, { email: " Reader@Example.com " });
    expect(r).toEqual({ ok: true, message: NEUTRAL });
    const saved = await row(t, "reader@example.com");
    expect(saved?.confirmedAt).toBeUndefined();
    expect(saved?.lastConfirmationSentAt).toBeTypeOf("number");
  });

  it("refuses an address that isn't one, and writes nothing", async () => {
    const t = createTestContext();
    const r = await t.mutation(internal.digestSignup.subscribe, { email: "not-an-address" });
    expect(r.ok).toBe(false);
    expect(await row(t, "not-an-address")).toBeNull();
  });

  it("sends nothing again within the cooldown, with the same reply", async () => {
    const t = createTestContext();
    await t.mutation(internal.digestSignup.subscribe, { email: "a@example.com" });
    const first = (await row(t, "a@example.com"))!.lastConfirmationSentAt;
    const again = await t.mutation(internal.digestSignup.subscribe, { email: "a@example.com" });
    expect(again).toEqual({ ok: true, message: NEUTRAL });
    expect((await row(t, "a@example.com"))!.lastConfirmationSentAt).toBe(first);
  });

  it("sends nothing to an address already on the list, with the same reply", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("newsletterSubscribers", { email: "on@example.com", createdAt: 1, confirmedAt: 2 });
    });
    const r = await t.mutation(internal.digestSignup.subscribe, { email: "on@example.com" });
    expect(r).toEqual({ ok: true, message: NEUTRAL });
    expect((await row(t, "on@example.com"))!.lastConfirmationSentAt).toBeUndefined();
  });

  it("queues when its pool is full, leaving no row for the held address", async () => {
    const t = createTestContext();
    let i = 0;
    for (; i < 100; i++) {
      const r = await t.mutation(internal.digestSignup.subscribe, { email: `filler${i}@example.com` });
      if (r.message === QUEUED_REPLY) break;
    }
    if (i === 100) throw new Error("the digest pool never filled");
    const held = await t.mutation(internal.digestSignup.subscribe, { email: "held@example.com" });
    expect(held).toEqual({ ok: true, message: QUEUED_REPLY, queued: true });
    expect(await row(t, "held@example.com")).toBeNull();
  });

  it("confirms with its own link, and only its own", async () => {
    const t = createTestContext();
    await t.mutation(internal.digestSignup.subscribe, { email: "c@example.com" });
    const wrong = await makeUnsubscribeToken("c@example.com", SECRET, "bulletin-confirm");
    expect(await t.mutation(internal.digestSignup.confirmByToken, { token: wrong })).toBeNull();
    const token = await makeUnsubscribeToken("c@example.com", SECRET, "digest-confirm");
    expect(await t.mutation(internal.digestSignup.confirmByToken, { token })).toEqual({ email: "c@example.com" });
    expect((await row(t, "c@example.com"))!.confirmedAt).toBeTypeOf("number");
  });

  it("never brings back an address that turned the digest off, from a replayed link", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("newsletterSubscribers", {
        email: "gone@example.com",
        createdAt: 1,
        confirmedAt: 2,
        unsubscribedAt: 3,
      });
    });
    const token = await makeUnsubscribeToken("gone@example.com", SECRET, "digest-confirm");
    expect(await t.mutation(internal.digestSignup.confirmByToken, { token })).toBeNull();
    expect((await row(t, "gone@example.com"))!.unsubscribedAt).toBe(3);
  });
});
