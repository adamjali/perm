/**
 * The spam filter's database half (convex/inboundFilter.ts): the verdict route
 * the mail Worker asks before it forwards, held mail stored and listed for the
 * admin, "Not spam" sending it on and trusting the sender, "Delete", "Spam" on
 * mail that got through, the 30-day clean-up, and the contact form's own hold.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import { HELD_KEEP_DAYS } from "../lib/spamCheck";
import { MS_PER_DAY } from "../lib/time";

type T = ReturnType<typeof createTestContext>;

const KEY = "test-inbound-key-0123456789";
const ADMIN = "admin@filter-test.com";

const PITCH = {
  from: "outreach@growthlinks.example",
  subject: "Guest posts on high-DR sites",
  text: "We offer do-follow backlinks and guest posts. Message us on WhatsApp.",
};
const PERSON = {
  from: "maria@gmail.com",
  subject: "My case",
  text: "My PERM case has said analyst review since March. Is that normal?",
};

const askVerdict = (t: T, body: unknown, key: string | undefined = KEY) =>
  t.fetch("/inbound-email/verdict", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { "x-inbound-key": key } : {}) },
    body: JSON.stringify(body),
  });

const store = (t: T, body: Record<string, unknown>) =>
  t.fetch("/inbound-email", {
    method: "POST",
    headers: { "content-type": "application/json", "x-inbound-key": KEY },
    body: JSON.stringify({ to: "support@permtracker.app", messageId: `<${Math.random()}@x>`, ...body }),
  });

async function adminAuth(t: T) {
  const id = await t.run(async (ctx) => ctx.db.insert("users", { email: ADMIN }));
  return t.withIdentity({ subject: id, email: ADMIN });
}

const rows = (t: T) => t.run(async (ctx) => ctx.db.query("supportEmails").collect());
const verdicts = (t: T) => t.run(async (ctx) => ctx.db.query("mailSenderVerdicts").collect());

beforeEach(() => {
  vi.stubEnv("INBOUND_EMAIL_SECRET", KEY);
  vi.stubEnv("ADMIN_EMAIL", ADMIN);
  vi.stubEnv("SECURITY_ALERT_EMAIL", "owner@example.com");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("/inbound-email/verdict", () => {
  it("is off without its secret and shut to a wrong key", async () => {
    const t = createTestContext();
    expect((await askVerdict(t, PITCH, "wrong")).status).toBe(401);
    vi.stubEnv("INBOUND_EMAIL_SECRET", "");
    expect((await askVerdict(t, PITCH)).status).toBe(503);
  });

  it("holds a pitch and forwards a person", async () => {
    const t = createTestContext();
    expect(await (await askVerdict(t, PITCH)).json()).toMatchObject({ ok: true, action: "hold" });
    expect(await (await askVerdict(t, PERSON)).json()).toMatchObject({ ok: true, action: "forward", score: 0 });
  });

  it("forwards a reply to a message we answered, whatever it says", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("supportEmails", {
        fromEmail: "outreach@growthlinks.example",
        toEmail: "support@permtracker.app",
        subject: "Earlier",
        messageId: "<earlier@growthlinks.example>",
        resendEmailId: "x",
        status: "replied",
        repliedAt: 1,
        createdAt: 1,
      });
    });
    const res = await askVerdict(t, { ...PITCH, thread: "<earlier@growthlinks.example>" });
    expect(await res.json()).toMatchObject({ action: "forward", reasons: ["answers a message we sent"] });
  });

  it("weighs the AI's opinion it's given", async () => {
    const t = createTestContext();
    const onePitch = { from: "x@y.example", subject: "Web design", text: "We do web design." };
    expect(await (await askVerdict(t, onePitch)).json()).toMatchObject({ action: "forward" });
    expect(await (await askVerdict(t, { ...onePitch, ai: "spam" })).json()).toMatchObject({ action: "hold" });
    // An answer that isn't one of the three is ignored.
    expect(await (await askVerdict(t, { ...onePitch, ai: "definitely" })).json()).toMatchObject({ action: "forward" });
  });
});

describe("held mail", () => {
  it("is stored as held with its reasons, and listed for the admin only", async () => {
    const t = createTestContext();
    await store(t, { ...PITCH, held: true, forwarded: false, spamScore: 6, spamReasons: ["sells links or SEO"] });
    await store(t, { ...PERSON, forwarded: true });
    await store(t, { from: "noreply@medium.com", subject: "Stats", forwarded: true, notice: true });
    const [held] = (await rows(t)).filter((r) => r.status === "held");
    expect(held).toMatchObject({ fromEmail: PITCH.from, spamScore: 6, spamReasons: ["sells links or SEO"] });
    expect(held!.heldAt).toBeTypeOf("number");

    await expect(t.query(api.inboundFilter.forAdmin, {})).rejects.toThrow();
    const admin = await adminAuth(t);
    const list = await admin.query(api.inboundFilter.forAdmin, {});
    expect(list.held.map((r) => r.fromEmail)).toEqual([PITCH.from]);
    // The person's mail is in the recent list; the service's notice isn't.
    expect(list.recent.map((r) => r.fromEmail)).toEqual([PERSON.from]);
  });

  it("Not spam sends it to the owner and lets the sender through from then on", async () => {
    vi.useFakeTimers();
    vi.stubEnv("OWNER_MAIL_URL", "https://mail.example.com/owner");
    vi.stubEnv("OWNER_MAIL_KEY", "key");
    const calls = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", calls);
    const t = createTestContext();
    await store(t, { ...PITCH, held: true, forwarded: false });
    const admin = await adminAuth(t);
    const [held] = (await admin.query(api.inboundFilter.forAdmin, {})).held;
    await admin.mutation(api.inboundFilter.release, { id: held!.id });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const sent = calls.mock.calls.filter(([u]) => String(u) === "https://mail.example.com/owner");
    expect(sent).toHaveLength(1);
    expect(JSON.parse(String(sent[0]![1]?.body))).toMatchObject({
      to: "owner@example.com",
      replyTo: PITCH.from,
      subject: PITCH.subject,
    });
    const [row] = await rows(t);
    expect(row).toMatchObject({ status: "forwarded" });
    expect(row!.releasedAt).toBeTypeOf("number");
    expect(row!.heldAt).toBeUndefined();
    expect((await verdicts(t)).map((v) => [v.key, v.verdict])).toEqual([["@growthlinks.example", "allow"]]);
    expect(await (await askVerdict(t, PITCH)).json()).toMatchObject({ action: "forward" });
  });

  it("Delete removes only held mail", async () => {
    const t = createTestContext();
    await store(t, { ...PITCH, held: true, forwarded: false });
    await store(t, { ...PERSON, forwarded: true });
    const admin = await adminAuth(t);
    for (const r of await rows(t)) await admin.mutation(api.inboundFilter.deleteHeld, { id: r._id });
    expect((await rows(t)).map((r) => r.fromEmail)).toEqual([PERSON.from]);
  });

  it("Spam on mail that got through holds that sender from then on", async () => {
    const t = createTestContext();
    await store(t, { ...PERSON, forwarded: true });
    const admin = await adminAuth(t);
    const [r] = await rows(t);
    await admin.mutation(api.inboundFilter.markSpam, { id: r!._id });
    expect((await verdicts(t)).map((v) => [v.key, v.verdict])).toEqual([["maria@gmail.com", "block"]]);
    expect(await (await askVerdict(t, PERSON)).json()).toMatchObject({ action: "hold" });
    // Another Gmail sender is not caught by it.
    expect(await (await askVerdict(t, { ...PERSON, from: "someone.else@gmail.com" })).json()).toMatchObject({
      action: "forward",
    });
  });

  it("is deleted 30 days after it was held, and nothing else is", async () => {
    const t = createTestContext();
    const now = Date.now();
    await t.run(async (ctx) => {
      const base = { toEmail: "support@permtracker.app", subject: "s", resendEmailId: "x", createdAt: 1 };
      await ctx.db.insert("supportEmails", { ...base, fromEmail: "old@x.example", messageId: "<1>", status: "held", heldAt: now - (HELD_KEEP_DAYS + 1) * MS_PER_DAY });
      await ctx.db.insert("supportEmails", { ...base, fromEmail: "new@x.example", messageId: "<2>", status: "held", heldAt: now - MS_PER_DAY });
      await ctx.db.insert("supportEmails", { ...base, fromEmail: "kept@x.example", messageId: "<3>", status: "forwarded" });
    });
    expect(await t.mutation(internal.inboundFilter.pruneHeld, {})).toBe(1);
    expect((await rows(t)).map((r) => r.fromEmail).sort()).toEqual(["kept@x.example", "new@x.example"]);
  });
});

describe("the contact form", () => {
  it("holds a pitch sent without the human check, and sends nothing", async () => {
    const t = createTestContext();
    const calls = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", calls);
    const id = await t.run(async (ctx) =>
      ctx.db.insert("contactMessages", {
        name: "SEO team",
        email: "outreach@growthlinks.example",
        message: "We offer guest posts and backlinks on high-DR sites.",
        ip: "203.0.113.5",
        createdAt: Date.now(),
        checkSignals: [{ weight: 2, why: "sent without the form's check that it's a person" }],
      }),
    );
    await t.action(internal.contactForm.forward, { id });
    const [row] = await rows(t);
    expect(row).toMatchObject({ status: "held", fromEmail: "outreach@growthlinks.example" });
    expect(row!.spamReasons).toContain("sent without the form's check that it's a person");
    expect(calls).not.toHaveBeenCalled();
  });

  it("refuses a Turnstile token that doesn't pass", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 })),
    );
    const t = createTestContext();
    const res = await t.fetch("/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "A Person", email: "person@example.com", message: "A question about my case.", turnstile: "bad" }),
    });
    expect(res.status).toBe(400);
    expect(await t.run(async (ctx) => ctx.db.query("contactMessages").collect())).toHaveLength(0);
  });
});
