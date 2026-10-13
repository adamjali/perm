/**
 * Mail anyone can set off stops at PUBLIC_CEILING (70 of Resend's 100), so
 * the 15 above it stay free for alerts (owner's call Oct 10 2026, lowered Oct 13). The
 * confirmation queue's side is in confirmationQueue.test.ts; this holds the
 * contact form, which goes to the owner through the free mail Worker and, when
 * that can't take it, through Resend with priority "public" (Oct 12 2026).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { PUBLIC_CEILING, utcDay } from "../lib/emailLimits";

type T = ReturnType<typeof createTestContext>;

function stubResend() {
  const sends = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.hostname !== "api.resend.com") throw new Error(`unexpected fetch ${url.href}`);
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
    vi.stubEnv("SECURITY_ALERT_EMAIL", "owner@example.com");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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

  it("with the Worker set up, goes straight to the owner, reply going to the visitor, and is filed as support mail", async () => {
    vi.stubEnv("OWNER_MAIL_URL", "https://mail.example.com/owner");
    vi.stubEnv("OWNER_MAIL_KEY", "key");
    const t = createTestContext();
    const calls = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", calls);
    await countDay(t, PUBLIC_CEILING);
    await t.action(internal.contactForm.forward, { id: await contactMessage(t) });
    expect(calls).toHaveBeenCalledTimes(1);
    const [url, init] = calls.mock.calls[0]!;
    expect(String(url)).toBe("https://mail.example.com/owner");
    expect(JSON.parse(String(init?.body))).toMatchObject({ to: "owner@example.com", replyTo: "visitor@example.com" });
    const filed = await t.run((ctx) => ctx.db.query("supportEmails").collect());
    expect(filed.map((r) => [r.fromEmail, r.toEmail])).toEqual([["visitor@example.com", "support@permtracker.app"]]);
    expect(await t.run((ctx) => ctx.db.query("emailRetries").collect())).toHaveLength(0);
  });
});
