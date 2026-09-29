/**
 * The day's email count and the retry queue (convex/emailLedger.ts, Sep 29 2026).
 *
 * Adam: "for any and all email failures like resend or anything so never just
 * refuse and lost". These pin that a failed send is kept, retried on a backoff
 * (a quota refusal after the UTC day turns), given up on only after two weeks
 * or at a full queue, and that each of those is counted and told to the admin
 * once a day.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestContext, setupSchedulerTests } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import {
  LIST_CEILING,
  RETRY_EXPIRE_MS,
  RETRY_MAX_PAYLOAD,
  RETRY_MAX_ROWS,
  msToNextUtcDay,
  utcDay,
} from "../lib/emailLimits";

type T = ReturnType<typeof createTestContext>;

const day = (t: T) =>
  t.run((ctx) =>
    ctx.db
      .query("emailDays")
      .withIndex("by_day", (q) => q.eq("day", utcDay(Date.now())))
      .unique(),
  );
const retries = (t: T) => t.run((ctx) => ctx.db.query("emailRetries").withIndex("by_queuedAt").take(2000));
const adminEmails = (t: T) =>
  t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect()).filter((j) => j.name.includes("sendAdminNotificationEmail")),
  );

const payload = (to = "a@example.com") => JSON.stringify({ from: "x@permtracker.app", to, subject: "s", html: "<p>h</p>" });

describe("the day's count", () => {
  setupSchedulerTests();

  it("counts each send and keeps the highest count Resend reports", async () => {
    const t = createTestContext();
    await t.mutation(internal.emailLedger.recordSend, {});
    await t.mutation(internal.emailLedger.recordSend, { quota: 40 });
    await t.mutation(internal.emailLedger.recordSend, { quota: 12 });
    expect(await day(t)).toMatchObject({ sent: 3, reported: 40 });
    expect(await t.query(internal.emailLedger.accountUsed, {})).toBe(40);

    await t.mutation(internal.emailLedger.noteReported, { count: 55 });
    await t.mutation(internal.emailLedger.noteReported, { count: 9 });
    expect(await t.query(internal.emailLedger.accountUsed, {})).toBe(55);
  });
});

describe("the retry queue", () => {
  setupSchedulerTests();

  it("keeps a failed send, retries it in 5 minutes, and emails the admin once a day", async () => {
    const t = createTestContext();
    const now = Date.now();
    const a = await t.mutation(internal.emailLedger.enqueueRetry, {
      kind: "alert",
      to: "a@example.com",
      payload: payload(),
      error: "application_error: down",
      quota: false,
    });
    expect(a).toEqual({ ok: true });
    await t.mutation(internal.emailLedger.enqueueRetry, {
      kind: "alert",
      to: "b@example.com",
      payload: payload("b@example.com"),
      error: "application_error: down",
      quota: false,
    });
    const rows = await retries(t);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.nextAttemptAt - now).toBeGreaterThanOrEqual(5 * 60 * 1000 - 1000);
    expect(rows[0]!.nextAttemptAt - now).toBeLessThan(6 * 60 * 1000);
    expect((await day(t))?.retried).toBe(2);
    expect(await adminEmails(t)).toHaveLength(1);
  });

  it("a quota refusal waits for Resend's day to turn", async () => {
    const t = createTestContext();
    const now = Date.now();
    await t.mutation(internal.emailLedger.enqueueRetry, {
      kind: "digest",
      to: "a@example.com",
      payload: payload(),
      error: "daily_quota_exceeded: You have exceeded your daily email sending quota.",
      quota: true,
    });
    const [row] = await retries(t);
    expect(row!.nextAttemptAt).toBeGreaterThanOrEqual(now + msToNextUtcDay(now));
  });

  it("claims only what is due, and a failure backs off while a hard refusal is given up", async () => {
    const t = createTestContext();
    await t.mutation(internal.emailLedger.enqueueRetry, { kind: "a", to: "a@x.com", payload: payload(), error: "e", quota: false });
    expect(await t.mutation(internal.emailLedger.claimRetries, { limit: 5 })).toHaveLength(0);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(await t.query(internal.emailLedger.hasDueRetry, {})).toBe(true);
    const [claimed] = await t.mutation(internal.emailLedger.claimRetries, { limit: 5 });
    expect(claimed).toBeDefined();
    // A second drain can't take the same row while the first holds it.
    expect(await t.mutation(internal.emailLedger.claimRetries, { limit: 5 })).toHaveLength(0);

    await t.mutation(internal.emailLedger.settleRetry, {
      id: claimed!.id,
      ok: false,
      error: { name: "application_error", message: "still down" },
    });
    const [again] = await retries(t);
    expect(again!.claimedAt).toBeUndefined();
    expect(again!.nextAttemptAt - Date.now()).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1);
    const [second] = await t.mutation(internal.emailLedger.claimRetries, { limit: 5 });
    await t.mutation(internal.emailLedger.settleRetry, {
      id: second!.id,
      ok: false,
      error: { name: "validation_error", message: "bad address" },
    });
    expect(await retries(t)).toHaveLength(0);
    expect((await day(t))?.lost).toBe(1);
  });

  it("a retry that sends is removed and counted in the day", async () => {
    const t = createTestContext();
    await t.mutation(internal.emailLedger.enqueueRetry, { kind: "a", to: "a@x.com", payload: payload(), error: "e", quota: false });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    const [row] = await t.mutation(internal.emailLedger.claimRetries, { limit: 1 });
    await t.mutation(internal.emailLedger.settleRetry, { id: row!.id, ok: true, quota: 61 });
    expect(await retries(t)).toHaveLength(0);
    expect(await day(t)).toMatchObject({ sent: 1, reported: 61 });
  });

  it("gives up after two weeks and says so", async () => {
    const t = createTestContext();
    await t.mutation(internal.emailLedger.enqueueRetry, { kind: "a", to: "a@x.com", payload: payload(), error: "e", quota: false });
    vi.advanceTimersByTime(RETRY_EXPIRE_MS + 60_000);
    expect(await t.mutation(internal.emailLedger.claimRetries, { limit: 5 })).toHaveLength(0);
    expect(await retries(t)).toHaveLength(0);
    expect((await day(t))?.lost).toBe(1);
  });

  it("refuses what it can't keep: an oversized email, or a full queue", async () => {
    const t = createTestContext();
    const big = await t.mutation(internal.emailLedger.enqueueRetry, {
      kind: "support-forward",
      to: "a@x.com",
      payload: "x".repeat(RETRY_MAX_PAYLOAD + 1),
      error: "e",
      quota: false,
    });
    expect(big.ok).toBe(false);

    await t.run(async (ctx) => {
      for (let i = 0; i < RETRY_MAX_ROWS; i++) {
        await ctx.db.insert("emailRetries", {
          kind: "a",
          to: `f${i}@x.com`,
          payload: "{}",
          queuedAt: Date.now(),
          nextAttemptAt: Date.now() + 60_000,
          attempts: 0,
          lastError: "e",
        });
      }
    });
    const full = await t.mutation(internal.emailLedger.enqueueRetry, { kind: "a", to: "late@x.com", payload: payload(), error: "e", quota: false });
    expect(full).toEqual({ ok: false, reason: "retry queue full" });
    expect((await day(t))?.lost).toBe(2);
  });
});

describe("the drain sends due retries first", () => {
  setupSchedulerTests();
  const realKey = process.env.AUTH_RESEND_KEY;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (realKey === undefined) delete process.env.AUTH_RESEND_KEY;
    else process.env.AUTH_RESEND_KEY = realKey;
  });

  it("sends a due retry through Resend and records it", async () => {
    process.env.AUTH_RESEND_KEY = "re_test_key";
    const t = createTestContext();
    await t.mutation(internal.emailLedger.enqueueRetry, { kind: "alert", to: "a@x.com", payload: payload(), error: "e", quota: false });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    const sends: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "POST") {
          sends.push(String(url));
          return new Response(JSON.stringify({ id: "sent-1" }), {
            status: 200,
            headers: { "content-type": "application/json", "x-resend-daily-quota": "11" },
          });
        }
        return new Response(JSON.stringify({ object: "list", has_more: false, data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );
    const res = await t.action(internal.confirmationQueue.drain, {});
    expect(res.retried).toBe(1);
    expect(sends).toHaveLength(1);
    expect(await retries(t)).toHaveLength(0);
    expect((await day(t))?.sent).toBe(1);
  });

  it("waits when the day is at the list ceiling", async () => {
    process.env.AUTH_RESEND_KEY = "re_test_key";
    const t = createTestContext();
    await t.mutation(internal.emailLedger.enqueueRetry, { kind: "alert", to: "a@x.com", payload: payload(), error: "e", quota: false });
    await t.mutation(internal.emailLedger.noteReported, { count: LIST_CEILING });
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ object: "list", has_more: false, data: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    expect(await t.action(internal.confirmationQueue.drain, {})).toEqual({ sent: 0, retried: 0, room: 0 });
    expect(await retries(t)).toHaveLength(1);
  });
});
