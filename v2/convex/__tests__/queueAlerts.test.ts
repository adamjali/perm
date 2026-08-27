/**
 * Queue-alert tests.
 *
 * This file exists because a multi-agent review found that `convex/queueAlerts.ts`
 * had NO tests at all, while the pure DOL parser next to it had 34. That split
 * was the actual defect: the parser is a pure function and was easy to test, so
 * it got tested, and the module that sends real email to real people from an
 * unauthenticated endpoint got none. Every test below covers a bug that was
 * live in that file, not a hypothetical.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { makeUnsubscribeToken } from "../lib/unsubscribeToken";

const SECRET = "test-unsubscribe-secret";
const originalFetch = global.fetch;

/** Stub Resend's HTTP call. Resend never throws; it RETURNS `{ error }`. */
function stubResend(status: number) {
  const calls: string[] = [];
  global.fetch = (async (url: unknown, init?: { body?: string }) => {
    calls.push(String(url));
    const body = init?.body ? JSON.parse(init.body) : {};
    if (status >= 400) {
      return new Response(
        JSON.stringify({ name: "validation_error", message: "stubbed failure" }),
        { status, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ id: `stub-${body.to ?? "x"}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return calls;
}

/**
 * Same stub, but keeps the parsed request bodies.
 *
 * The send SHAPE is not visible from the return value: whether `html` went out
 * alongside `text`, and whether the List-Unsubscribe headers survived, can only
 * be seen in what was actually posted to Resend.
 */
function stubResendCapturing(status = 200) {
  const bodies: Array<Record<string, unknown>> = [];
  /** The send to one address. `global.fetch` is shared and CI shuffles order. */
  const to = (email: string) => {
    const hit = bodies.filter((b) => b.to === email);
    if (hit.length !== 1) {
      throw new Error(
        `expected exactly one send to ${email}, saw ${hit.length} ` +
          `(all recipients: ${bodies.map((b) => String(b.to)).join(", ")})`,
      );
    }
    return hit[0]!;
  };
  global.fetch = (async (_url: unknown, init?: { body?: string }) => {
    const body = init?.body ? JSON.parse(init.body) : {};
    bodies.push(body);
    if (status >= 400) {
      return new Response(
        JSON.stringify({ name: "validation_error", message: "stubbed failure" }),
        { status, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ id: "stub" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { bodies, to };
}

beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", SECRET);
  vi.stubEnv("CONVEX_SITE_URL", "https://example.convex.site");
  vi.stubEnv("AUTH_RESEND_KEY", "re_test_key");
  vi.stubEnv("BLOCKED_EMAILS", "");
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("subscribe input validation", () => {
  it("rejects a long address without running the backtracking regex", async () => {
    const t = createTestContext();
    stubResend(200);

    /*
     * The address pattern backtracks QUADRATICALLY on this shape: measured at
     * 8.2 seconds for 80k characters when the length check ran second.
     *
     * The assertion is a RATIO, not a wall-clock budget, and that is a fix
     * rather than a preference. The budget version failed at 1459ms against a
     * 1000ms limit with four test files running concurrently, having passed at
     * 201ms alone, with nothing about the guard changed. CI shuffles test order
     * and runs with `--retry=2`, so a load-dependent assertion here is a flake
     * waiting for a busy runner. The ratio cancels machine load and module load
     * out of both sides and measures the property itself: cost must not grow
     * with input length.
     */
    const time = async (email: string) => {
      const started = performance.now();
      const res = await t.mutation(internal.queueAlerts.subscribe, {
        email,
        filingMonth: "2025-09",
      });
      return { ms: performance.now() - started, ok: res.ok };
    };

    // Warm up, or the one-off module load lands entirely on the first call.
    await time("warmup@example.com");

    const short = await time("a@" + ".".repeat(200) + "@");
    const long = await time("a@" + ".".repeat(80_000) + "@");

    expect(short.ok).toBe(false);
    expect(long.ok).toBe(false);

    // 400x the input. Unguarded that is ~160,000x the work; guarded both are a
    // length check and the ratio sits near 1.
    const ratio = long.ms / Math.max(short.ms, 0.01);
    expect(
      ratio,
      `400x the input took ${ratio.toFixed(1)}x the time ` +
        `(${short.ms.toFixed(1)}ms then ${long.ms.toFixed(1)}ms)`,
    ).toBeLessThan(10);
    expect(long.ms).toBeLessThan(5_000);
  });

  it("rejects a filing month outside the PERM programme's life", async () => {
    const t = createTestContext();
    for (const filingMonth of ["1999-01", "2099-01", "2025-13", "nonsense"]) {
      const res = await t.mutation(internal.queueAlerts.subscribe, {
        email: "a@example.com",
        filingMonth,
      });
      expect(res.ok).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Abuse limits
// ---------------------------------------------------------------------------

describe("abuse limits", () => {
  it("stops one IP after five attempts even with fresh addresses each time", async () => {
    const t = createTestContext();
    stubResend(200);

    const results = [];
    for (let i = 0; i < 8; i++) {
      results.push(
        await t.mutation(internal.queueAlerts.subscribe, {
          email: `person${i}@example.com`,
          filingMonth: "2025-09",
          ip: "203.0.113.9",
        }),
      );
    }

    // The per-address cooldown cannot catch this: every address is new.
    expect(results.slice(0, 5).every((r) => r.ok)).toBe(true);
    expect(results.slice(5).every((r) => !r.ok)).toBe(true);
  });

  it("keeps separate IPs independent", async () => {
    const t = createTestContext();
    stubResend(200);

    for (let i = 0; i < 5; i++) {
      await t.mutation(internal.queueAlerts.subscribe, {
        email: `a${i}@example.com`,
        filingMonth: "2025-09",
        ip: "203.0.113.1",
      });
    }
    const other = await t.mutation(internal.queueAlerts.subscribe, {
      email: "fresh@example.com",
      filingMonth: "2025-09",
      ip: "203.0.113.2",
    });
    expect(other.ok).toBe(true);
  });

  it("caps confirmations globally, which is the limit an attacker cannot rotate around", async () => {
    const t = createTestContext();
    stubResend(200);

    // Every request from a DIFFERENT IP and a different address, which defeats
    // both the per-address cooldown and the per-IP counter.
    const results = [];
    for (let i = 0; i < 34; i++) {
      results.push(
        await t.mutation(internal.queueAlerts.subscribe, {
          email: `flood${i}@example.com`,
          filingMonth: "2025-09",
          ip: `198.51.100.${i}`,
        }),
      );
    }

    const allowed = results.filter((r) => r.ok).length;
    expect(allowed).toBe(30);
    expect(results[results.length - 1]!.ok).toBe(false);
  });

  it("does not charge the global budget for a request the cooldown absorbed", async () => {
    const t = createTestContext();
    stubResend(200);

    const args = { email: "same@example.com", filingMonth: "2025-09", ip: "203.0.113.5" };
    await t.mutation(internal.queueAlerts.subscribe, args);
    // Second request inside the cooldown: replies neutrally and sends nothing,
    // so it must not consume a slot in the send budget.
    await t.mutation(internal.queueAlerts.subscribe, args);

    const rows = await t.run(async (ctx) => ctx.db.query("rateLimits").collect());
    const globalCharges = rows.filter((r) => r.action === "queue_subscribe_global");
    expect(globalCharges).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// The confirm state machine
// ---------------------------------------------------------------------------

describe("confirm", () => {
  async function subscribed(t: ReturnType<typeof createTestContext>, email: string, month: string) {
    stubResend(200);
    await t.mutation(internal.queueAlerts.subscribe, { email, filingMonth: month });
    return await makeUnsubscribeToken(email, SECRET, "queue-confirm");
  }

  it("confirms a new subscriber", async () => {
    const t = createTestContext();
    const token = await subscribed(t, "new@example.com", "2025-09");
    const res = await t.mutation(internal.queueAlerts.confirmByToken, { token });
    expect(res?.filingMonth).toBe("2025-09");

    const row = await t.run(async (ctx) =>
      ctx.db.query("dolQueueAlerts").withIndex("by_email", (q) => q.eq("email", "new@example.com")).first(),
    );
    expect(row?.confirmedAt).toBeDefined();
  });

  it("does NOT resend when the same month is re-submitted", async () => {
    const t = createTestContext();
    const email = "repeat@example.com";
    const token = await subscribed(t, email, "2025-09");
    await t.mutation(internal.queueAlerts.confirmByToken, { token });

    // Pretend the alert already went out.
    const id = await t.run(async (ctx) => {
      const r = await ctx.db.query("dolQueueAlerts").withIndex("by_email", (q) => q.eq("email", email)).first();
      await ctx.db.patch(r!._id, { notifiedAt: Date.now(), lastConfirmationSentAt: undefined });
      return r!._id;
    });

    // Same person signs up again with the SAME month and confirms. This used
    // to clear notifiedAt (the guard was a truthiness check on a field that is
    // always set), putting them back in the sweep for a second "one alert ever".
    await t.mutation(internal.queueAlerts.subscribe, { email, filingMonth: "2025-09" });
    await t.mutation(internal.queueAlerts.confirmByToken, { token });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.notifiedAt).toBeDefined();
  });

  it("DOES reset the send when the month genuinely changes", async () => {
    const t = createTestContext();
    const email = "moved@example.com";
    const token = await subscribed(t, email, "2025-09");
    await t.mutation(internal.queueAlerts.confirmByToken, { token });

    const id = await t.run(async (ctx) => {
      const r = await ctx.db.query("dolQueueAlerts").withIndex("by_email", (q) => q.eq("email", email)).first();
      await ctx.db.patch(r!._id, { notifiedAt: Date.now(), lastConfirmationSentAt: undefined });
      return r!._id;
    });

    await t.mutation(internal.queueAlerts.subscribe, { email, filingMonth: "2026-01" });
    await t.mutation(internal.queueAlerts.confirmByToken, { token });

    const row = await t.run(async (ctx) => ctx.db.get(id));
    expect(row?.filingMonth).toBe("2026-01");
    expect(row?.notifiedAt).toBeUndefined();
  });

  it("does not resurrect someone who unsubscribed, however often the link is replayed", async () => {
    const t = createTestContext();
    const email = "gone@example.com";
    const confirmToken = await subscribed(t, email, "2025-09");
    await t.mutation(internal.queueAlerts.confirmByToken, { token: confirmToken });

    const unsubToken = await makeUnsubscribeToken(email, SECRET, "queue-unsubscribe");
    expect(await t.mutation(internal.queueAlerts.unsubscribeByToken, { token: unsubToken })).toBe(true);

    // A confirm link never expires and lives in their inbox forever, so a mail
    // scanner or a stray click can replay it at any point. It must not undo a
    // legally-meaningful opt-out.
    const replay = await t.mutation(internal.queueAlerts.confirmByToken, { token: confirmToken });
    expect(replay).toBeNull();

    const row = await t.run(async (ctx) =>
      ctx.db.query("dolQueueAlerts").withIndex("by_email", (q) => q.eq("email", email)).first(),
    );
    expect(row?.unsubscribedAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Sweep selection
// ---------------------------------------------------------------------------

describe("dueForAlert", () => {
  async function seed(t: ReturnType<typeof createTestContext>) {
    await t.run(async (ctx) => {
      const base = { createdAt: Date.now() };
      await ctx.db.insert("dolQueueAlerts", { ...base, email: "due@x.com", filingMonth: "2025-01", confirmedAt: 1 });
      await ctx.db.insert("dolQueueAlerts", { ...base, email: "unconfirmed@x.com", filingMonth: "2025-01" });
      await ctx.db.insert("dolQueueAlerts", { ...base, email: "done@x.com", filingMonth: "2025-01", confirmedAt: 1, notifiedAt: 2 });
      await ctx.db.insert("dolQueueAlerts", { ...base, email: "out@x.com", filingMonth: "2025-01", confirmedAt: 1, unsubscribedAt: 3 });
      await ctx.db.insert("dolQueueAlerts", { ...base, email: "future@x.com", filingMonth: "2030-01", confirmedAt: 1 });
    });
  }

  it("selects only confirmed, un-notified, un-unsubscribed rows at or before the frontier", async () => {
    const t = createTestContext();
    await seed(t);
    const due = await t.query(internal.queueAlerts.dueForAlert, { frontier: "2025-09", limit: 50 });
    expect(due.map((d) => d.email)).toEqual(["due@x.com"]);
  });

  it("honours the limit", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      for (let i = 0; i < 10; i++) {
        await ctx.db.insert("dolQueueAlerts", {
          email: `p${i}@x.com`,
          filingMonth: "2025-01",
          confirmedAt: 1,
          createdAt: Date.now(),
        });
      }
    });
    const due = await t.query(internal.queueAlerts.dueForAlert, { frontier: "2025-09", limit: 3 });
    expect(due).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

describe("notifyQueueReached", () => {
  async function seedDue(t: ReturnType<typeof createTestContext>, n: number) {
    await t.run(async (ctx) => {
      for (let i = 0; i < n; i++) {
        await ctx.db.insert("dolQueueAlerts", {
          email: `sub${i}@example.com`,
          filingMonth: "2025-01",
          confirmedAt: 1,
          createdAt: Date.now(),
        });
      }
    });
  }

  it("marks a subscriber notified when the send succeeds", async () => {
    const t = createTestContext();
    await seedDue(t, 2);
    stubResend(200);

    const res = await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    expect(res.sent).toBe(2);
    expect(res.failed).toBe(0);
    const rows = await t.run(async (ctx) => ctx.db.query("dolQueueAlerts").collect());
    expect(rows.every((r) => r.notifiedAt !== undefined)).toBe(true);
  });

  it("does NOT mark notified when Resend reports a failure", async () => {
    const t = createTestContext();
    await seedDue(t, 2);
    // 422 rather than 429 so sendEmailWithRetry does not spend its backoff.
    stubResend(422);

    const res = await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    // The Resend SDK returns `{ error }` instead of throwing, so the previous
    // try/catch never ran and `markNotified` executed on the line after a
    // failed send: the subscriber was stamped as told, `dueForAlert` filtered
    // them out forever, and the one email they signed up for was destroyed.
    expect(res.sent).toBe(0);
    expect(res.failed).toBe(2);

    const rows = await t.run(async (ctx) => ctx.db.query("dolQueueAlerts").collect());
    expect(rows.every((r) => r.notifiedAt === undefined)).toBe(true);
  });

  it("reports that work remains when more are due than one batch sends", async () => {
    const t = createTestContext();
    await seedDue(t, 45);
    stubResend(200);

    const res = await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    expect(res.sent).toBe(40);
    expect(res.remaining).toBe(true);

    // The remainder must be picked up by a scheduled continuation rather than
    // waiting for the next DOL publication, which is roughly a month away.
    const scheduled = await t.run(async (ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(
      scheduled.some((f) => f.name.includes("notifyQueueReached")),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Confirmation send
// ---------------------------------------------------------------------------

describe("sendConfirmation", () => {
  it("clears the cooldown when the send fails so the user can retry", async () => {
    const t = createTestContext();
    stubResend(200);
    await t.mutation(internal.queueAlerts.subscribe, {
      email: "retry@example.com",
      filingMonth: "2025-09",
    });

    stubResend(422);
    await t.action(internal.queueAlerts.sendConfirmation, {
      email: "retry@example.com",
      filingMonth: "2025-09",
    });

    // Stamped before the send (it has to be, it is what throttles a repeat),
    // so it records intent. Left in place after a failure it would tell a real
    // person to check an inbox holding nothing, then silently no-op their
    // retry for ten minutes.
    const row = await t.run(async (ctx) =>
      ctx.db.query("dolQueueAlerts").withIndex("by_email", (q) => q.eq("email", "retry@example.com")).first(),
    );
    expect(row?.lastConfirmationSentAt).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Multipart send shape
//
// Both sends were text-only. Adding `html` is a deliverability improvement as
// well as a design one (multipart outscores text-only, and far outscores
// HTML-only), so the text part staying is as load-bearing as the HTML arriving.
// ---------------------------------------------------------------------------

describe("multipart send shape", () => {
  it("sends the confirmation as html AND text", async () => {
    const t = createTestContext();
    const { to } = stubResendCapturing();

    await t.action(internal.queueAlerts.sendConfirmation, {
      email: "multi@example.com",
      filingMonth: "2025-09",
    });

    const body = to("multi@example.com");
    expect(typeof body.html).toBe("string");
    expect(String(body.html)).toContain("<table");
    expect(typeof body.text).toBe("string");
    expect(String(body.text).length).toBeGreaterThan(100);
  });

  it("sends the alert as html AND text", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("dolQueueAlerts", {
        email: "multi@example.com",
        filingMonth: "2025-01",
        confirmedAt: 1,
        createdAt: Date.now(),
      });
    });
    const { to } = stubResendCapturing();

    await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    const body = to("multi@example.com");
    expect(typeof body.html).toBe("string");
    expect(typeof body.text).toBe("string");
    expect(String(body.text)).toContain("flag.dol.gov/processingtimes");
  });

  it("keeps List-Unsubscribe and List-Unsubscribe-Post on the alert", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("dolQueueAlerts", {
        email: "unsub@example.com",
        filingMonth: "2025-01",
        confirmedAt: 1,
        createdAt: Date.now(),
      });
    });
    const { to } = stubResendCapturing();

    await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    const headers = to("unsub@example.com").headers as Record<string, string>;
    expect(headers["List-Unsubscribe"]).toMatch(/^<https:\/\/.+\/queue-alert\/unsubscribe\?token=.+>$/);
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("renders the months for a reader in both parts", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("dolQueueAlerts", {
        email: "fmt@example.com",
        filingMonth: "2025-01",
        confirmedAt: 1,
        createdAt: Date.now(),
      });
    });
    const { to } = stubResendCapturing();

    await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    const body = to("fmt@example.com");
    expect(String(body.html)).toContain("September 2025");
    expect(String(body.html)).toContain("January 2025");
    expect(String(body.html)).toContain("August 20, 2026");
    // The text part is formatted from the SAME constants as the HTML and the
    // subject. It used to carry DOL's raw "2025-09"; a reader never sees a
    // machine value now, whichever part their client renders.
    expect(String(body.text)).toContain("September 2025");
    expect(String(body.text)).not.toContain("2025-09");
  });

  it("every link in the alert html is absolute and on a host we control or cite", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("dolQueueAlerts", {
        email: "links@example.com",
        filingMonth: "2025-01",
        confirmedAt: 1,
        createdAt: Date.now(),
      });
    });
    const { to } = stubResendCapturing();

    await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    const html = String(to("links@example.com").html);
    const found = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1] as string);
    expect(found.length).toBeGreaterThan(4);
    const allowed = new Set(["permtracker.app", "flag.dol.gov", "example.convex.site"]);
    for (const h of found) {
      expect(h).toMatch(/^https:\/\//);
      expect(allowed, h).toContain(new URL(h).host);
    }
  });
});

// ---------------------------------------------------------------------------
// Formatted figures reach the reader
//
// The subject line is the one string every recipient sees before opening
// anything, and it rendered DOL's raw "2024-09" to all of them.
// ---------------------------------------------------------------------------

describe("no raw YYYY-MM reaches a reader", () => {
  const RAW_MONTH = /\d{4}-\d{2}(?!\d)/;

  it("PROBE: the detector matches a raw month and not a formatted one", () => {
    expect(RAW_MONTH.test("DOL has reached 2025-09 in the PERM queue")).toBe(true);
    expect(RAW_MONTH.test("DOL has reached September 2025 in the PERM queue")).toBe(false);
    // An as-of date is the same defect wearing one more field.
    expect(RAW_MONTH.test("as of 2026-08-20")).toBe(true);
    expect(RAW_MONTH.test("as of August 20, 2026")).toBe(false);
  });

  it("formats the alert subject, and names the figure the stamp shows", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("dolQueueAlerts", {
        email: "subj@example.com",
        filingMonth: "2025-01",
        confirmedAt: 1,
        createdAt: Date.now(),
      });
    });
    const { to } = stubResendCapturing();

    await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    const subject = String(to("subj@example.com").subject);
    expect(subject).toBe("DOL has reached September 2025 in the PERM queue");
    expect(RAW_MONTH.test(subject)).toBe(false);
  });

  it("formats every month and date in the alert text part", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("dolQueueAlerts", {
        email: "txt@example.com",
        filingMonth: "2025-01",
        confirmedAt: 1,
        createdAt: Date.now(),
      });
    });
    const { to } = stubResendCapturing();

    await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    const body = to("txt@example.com");
    expect(RAW_MONTH.test(String(body.text))).toBe(false);
    expect(String(body.text)).toContain("September 2025");
    expect(String(body.text)).toContain("January 2025");
    expect(String(body.text)).toContain("August 20, 2026");
  });

  it("formats the confirmation subject and text", async () => {
    const t = createTestContext();
    const { to } = stubResendCapturing();

    await t.action(internal.queueAlerts.sendConfirmation, {
      email: "cfm@example.com",
      filingMonth: "2025-09",
    });

    const body = to("cfm@example.com");
    expect(RAW_MONTH.test(String(body.subject))).toBe(false);
    expect(RAW_MONTH.test(String(body.text))).toBe(false);
    expect(String(body.text)).toContain("Filing month: September 2025");
  });

  it("keeps the text part's claim in step with the HTML branch", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      await ctx.db.insert("dolQueueAlerts", {
        email: "branch@example.com",
        filingMonth: "2025-01",
        confirmedAt: 1,
        createdAt: Date.now(),
      });
    });
    const { to } = stubResendCapturing();

    await t.action(internal.queueAlerts.notifyQueueReached, {
      frontier: "2025-09",
      asOf: "2026-08-20",
    });

    // Eight months past, so neither part may say the case is being decided.
    const body = to("branch@example.com");
    expect(String(body.text)).not.toContain("adjudicating cases filed");
    expect(String(body.text)).toContain("worked past January 2025");
    expect(String(body.html)).not.toContain("adjudicating cases filed");
  });
});
