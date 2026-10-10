/**
 * Mail anyone can set off stops at PUBLIC_CEILING (55 of Resend's 100), so
 * the 30 above it stay free for alerts (owner's call, Oct 10 2026). The
 * confirmation queue's side is in confirmationQueue.test.ts; this holds the
 * contact form, which sends through sendOrQueue with priority "public".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { PUBLIC_CEILING, utcDay } from "../lib/emailLimits";

type T = ReturnType<typeof createTestContext>;

function stubResend() {
  const sends = vi.fn(async (input: RequestInfo | URL) => {
    if (!String(input).includes("api.resend.com")) throw new Error(`unexpected fetch ${String(input)}`);
    return new Response(JSON.stringify({ id: "sent-1" }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", sends);
  return sends;
}

async function contactMessage(t: T) {
  return t.run((ctx) =>
    ctx.db.insert("contactMessages", {
      name: "A visitor",
      email: "visitor@example.com",
      message: "Hello",
      ip: "203.0.113.5",
      createdAt: Date.now(),
    }),
  );
}

async function countDay(t: T, reported: number) {
  await t.run((ctx) => ctx.db.insert("emailDays", { day: utcDay(Date.now()), sent: 0, reported }));
}

describe("the alert reserve", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T15:00:00Z"));
    process.env.AUTH_RESEND_KEY = "re_test_key";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("a contact form message sends below the sign-up line", async () => {
    const t = createTestContext();
    const sends = stubResend();
    await countDay(t, PUBLIC_CEILING - 1);
    await t.action(internal.contactForm.forward, { id: await contactMessage(t) });
    expect(sends).toHaveBeenCalledTimes(1);
    expect(await t.run((ctx) => ctx.db.query("emailRetries").collect())).toHaveLength(0);
  });

  it("at the sign-up line it waits for tomorrow instead of using the alerts' room", async () => {
    const t = createTestContext();
    const sends = stubResend();
    await countDay(t, PUBLIC_CEILING);
    await t.action(internal.contactForm.forward, { id: await contactMessage(t) });
    expect(sends).not.toHaveBeenCalled();
    const kept = await t.run((ctx) => ctx.db.query("emailRetries").collect());
    expect(kept.map((r) => r.kind)).toEqual(["contact-form"]);
  });
});
