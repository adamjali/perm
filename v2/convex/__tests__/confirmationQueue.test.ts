/**
 * A full confirmation pool QUEUES the request instead of turning the person
 * away (convex/confirmationQueue.ts, Sep 29 2026).
 *
 * On Sep 28 2026 seventeen people asked for alerts after the day's 15 case
 * confirmations were spent and were told "try again later", with nothing
 * kept, while the Resend account had sent 57 of its 100. These pin the
 * replacement: the request waits in a bounded queue, the reply says so in
 * the same words for every address, nothing is stamped that a retry could
 * trip over, and the drain sends only while Resend's own count for the day
 * leaves room.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTestContext, setupSchedulerTests } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { BUDGETS, type BudgetName } from "../lib/alertBudgets";
import {
  CLAIM_LEASE_MS,
  DRAIN_CEILING,
  EXPIRE_MS,
  MAX_ATTEMPTS,
  PER_RUN,
  QUEUED_LINK_REPLY,
  QUEUED_REPLY,
  QUEUE_MAX,
  RECEIVED_MARGIN,
  countSentToday,
  drainRoom,
  parseResendTime,
  replayArgs,
  utcDayStart,
} from "../confirmationQueue";

type T = ReturnType<typeof createTestContext>;

async function fillPool(t: T, pool: BudgetName) {
  const b = BUDGETS[pool];
  await t.run(async (ctx) => {
    for (let i = 0; i < b.limit; i++) {
      await ctx.db.insert("rateLimits", { key: `${b.key}:all`, timestamp: Date.now(), identifier: "all", action: b.key });
    }
  });
}

const queued = (t: T) => t.run((ctx) => ctx.db.query("confirmationQueue").collect());
const refusals = (t: T) => t.run((ctx) => ctx.db.query("budgetRefusals").collect());
const scheduled = (t: T, name: string) =>
  t.run(async (ctx) => (await ctx.db.system.query("_scheduled_functions").collect()).filter((j) => j.name.includes(name)));

describe("a full pool queues the request", () => {
  setupSchedulerTests();

  it("case alerts: the queued reply, no alert row, one queue row, counted as queued", async () => {
    const t = createTestContext();
    await fillPool(t, "caseConfirm");

    const r = await t.mutation(internal.caseAlerts.subscribe, {
      email: "Waiting@Example.com",
      caseNumber: "G-100-25324-425560",
      news: true,
      ip: "203.0.113.9",
    });
    expect(r).toEqual({ ok: true, message: QUEUED_REPLY, queued: true });

    // No row, so no `lastConfirmationSentAt` for a retry to trip over.
    const rows = await t.run((ctx) => ctx.db.query("caseStatusAlerts").collect());
    expect(rows).toHaveLength(0);

    const q = await queued(t);
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ kind: "case", pool: "caseConfirm", email: "waiting@example.com" });
    // The caller's IP is not kept.
    expect(JSON.parse(q[0]!.payload)).toEqual({
      email: "Waiting@Example.com",
      caseNumber: "G-100-25324-425560",
      news: true,
    });

    const ref = await refusals(t);
    expect(ref).toHaveLength(1);
    expect(ref[0]).toMatchObject({ pool: "caseConfirm", count: 0, queued: 1 });
    expect(await scheduled(t, "confirmationQueue:drain")).toHaveLength(1);
  });

  it("the same address again keeps one row with the newest request, and one admin email a day", async () => {
    const t = createTestContext();
    await fillPool(t, "caseConfirm");
    await t.mutation(internal.caseAlerts.subscribe, { email: "a@example.com", caseNumber: "G-100-25324-425560" });
    const again = await t.mutation(internal.caseAlerts.subscribe, { email: "a@example.com", caseNumber: "G-100-25324-425561" });
    // Not swallowed by a cooldown stamp: the same honest reply.
    expect(again).toEqual({ ok: true, message: QUEUED_REPLY, queued: true });
    const q = await queued(t);
    expect(q).toHaveLength(1);
    expect(JSON.parse(q[0]!.payload).caseNumber).toBe("G-100-25324-425561");

    await t.mutation(internal.caseAlerts.subscribe, { email: "b@example.com", caseNumber: "G-100-25324-425562" });
    expect(await queued(t)).toHaveLength(2);
    expect(await scheduled(t, "sendAdminNotificationEmail")).toHaveLength(1);
  });

  it("every confirmation kind queues the same way", async () => {
    const t = createTestContext();
    for (const p of ["caseConfirm", "queueConfirm", "bulletinConfirm", "prefsLink"] as const) await fillPool(t, p);

    const results = [
      await t.mutation(internal.employerAlerts.subscribe, { email: "e@example.com", slug: "acme-llc", employerName: "ACME LLC" }),
      await t.mutation(internal.queueAlerts.subscribe, { email: "q@example.com", filingMonth: "2026-01" }),
      await t.mutation(internal.bulletinAlerts.subscribe, { email: "b@example.com", category: "EB2", country: "india" }),
      await t.mutation(internal.emailPrefs.requestLink, { email: "p@example.com" }),
    ];
    expect(results.map((r) => r.message)).toEqual([QUEUED_REPLY, QUEUED_REPLY, QUEUED_REPLY, QUEUED_LINK_REPLY]);
    expect(results.every((r) => r.ok)).toBe(true);
    expect((await queued(t)).map((r) => r.kind).sort()).toEqual(["bulletin", "employer", "prefs", "queue"]);
    expect(await t.run((ctx) => ctx.db.query("employerAlerts").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("dolQueueAlerts").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("bulletinAlerts").collect())).toHaveLength(0);
  });

  it("a full queue refuses, and counts the person as turned away", async () => {
    const t = createTestContext();
    await fillPool(t, "caseConfirm");
    await t.run(async (ctx) => {
      for (let i = 0; i < QUEUE_MAX; i++) {
        await ctx.db.insert("confirmationQueue", {
          kind: "case",
          pool: "caseConfirm",
          email: `f${i}@example.com`,
          payload: "{}",
          queuedAt: Date.now(),
        });
      }
    });
    const r = await t.mutation(internal.caseAlerts.subscribe, { email: "late@example.com", caseNumber: "G-100-25324-425560" });
    expect(r.ok).toBe(false);
    expect(r.throttled).toBe(true);
    expect(await queued(t)).toHaveLength(QUEUE_MAX);
    expect((await refusals(t))[0]).toMatchObject({ pool: "caseConfirm", count: 1 });
    expect(await scheduled(t, "sendAdminNotificationEmail")).toHaveLength(1);
  });
});

describe("a replay from the queue", () => {
  setupSchedulerTests();

  it("stages the subscription and schedules the email without spending the pool", async () => {
    const t = createTestContext();
    await fillPool(t, "caseConfirm");
    const r = await t.mutation(internal.caseAlerts.subscribe, {
      email: "a@example.com",
      caseNumber: "G-100-25324-425560",
      fromQueue: true,
    });
    expect(r).toEqual({ ok: true, message: "Check your inbox to confirm." });
    const rows = await t.run((ctx) => ctx.db.query("caseStatusAlerts").collect());
    expect(rows[0]).toMatchObject({ email: "a@example.com", pendingCaseNumber: "G-100-25324-425560" });
    expect(await scheduled(t, "caseAlerts:sendConfirmation")).toHaveLength(1);
    const spent = await t.run((ctx) =>
      ctx.db
        .query("rateLimits")
        .withIndex("by_key_and_timestamp", (q) => q.eq("key", `${BUDGETS.caseConfirm.key}:all`))
        .collect(),
    );
    expect(spent).toHaveLength(BUDGETS.caseConfirm.limit);
  });

  it("still honours the per-address cooldown after another confirmation went out", async () => {
    const t = createTestContext();
    await t.mutation(internal.caseAlerts.subscribe, { email: "a@example.com", caseNumber: "G-100-25324-425560" });
    await t.mutation(internal.caseAlerts.subscribe, { email: "a@example.com", caseNumber: "G-100-25324-425561", fromQueue: true });
    expect(await scheduled(t, "caseAlerts:sendConfirmation")).toHaveLength(1);
  });

  it("a queued preference link isn't swallowed by the cooldown its own first call recorded", async () => {
    const t = createTestContext();
    await fillPool(t, "prefsLink");
    const first = await t.mutation(internal.emailPrefs.requestLink, { email: "p@example.com" });
    expect(first.message).toBe(QUEUED_LINK_REPLY);
    await t.mutation(internal.emailPrefs.requestLink, { email: "p@example.com", fromQueue: true });
    expect(await scheduled(t, "emailPrefs:sendLink")).toHaveLength(1);
  });
});

describe("claim and settle", () => {
  setupSchedulerTests();

  async function seed(t: T, n: number, ageMs = 0) {
    await t.run(async (ctx) => {
      for (let i = 0; i < n; i++) {
        await ctx.db.insert("confirmationQueue", {
          kind: "case",
          pool: "caseConfirm",
          email: `s${i}@example.com`,
          payload: "{}",
          queuedAt: Date.now() - ageMs - (n - i),
        });
      }
    });
  }

  it("takes the oldest first, up to the limit, and not a row another drain holds", async () => {
    const t = createTestContext();
    await seed(t, 5);
    const a = await t.mutation(internal.confirmationQueue.claim, { limit: 3 });
    expect(a).toHaveLength(3);
    const b = await t.mutation(internal.confirmationQueue.claim, { limit: 3 });
    expect(b).toHaveLength(2);
    expect(new Set([...a, ...b].map((r) => r.id)).size).toBe(5);
    // A lease runs out, and the row can be taken again.
    vi.advanceTimersByTime(CLAIM_LEASE_MS + 1);
    expect(await t.mutation(internal.confirmationQueue.claim, { limit: 10 })).toHaveLength(5);
  });

  it("drops a request past three days and counts it as turned away", async () => {
    const t = createTestContext();
    await seed(t, 2, EXPIRE_MS + 1000);
    await seed(t, 1);
    const got = await t.mutation(internal.confirmationQueue.claim, { limit: 10 });
    expect(got).toHaveLength(1);
    expect(await queued(t)).toHaveLength(1);
    expect((await refusals(t))[0]).toMatchObject({ pool: "caseConfirm", count: 2 });
  });

  it("a finished replay removes the row; a failed one frees it, then gives up", async () => {
    const t = createTestContext();
    await seed(t, 2);
    const [one, two] = await t.mutation(internal.confirmationQueue.claim, { limit: 2 });
    await t.mutation(internal.confirmationQueue.settle, { id: one!.id, done: true });
    await t.mutation(internal.confirmationQueue.settle, { id: two!.id, done: false });
    const left = await queued(t);
    expect(left).toHaveLength(1);
    expect(left[0]!.claimedAt).toBeUndefined();

    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await t.mutation(internal.confirmationQueue.claim, { limit: 1 });
      await t.mutation(internal.confirmationQueue.settle, { id: two!.id, done: false });
    }
    expect(await queued(t)).toHaveLength(0);
    expect((await refusals(t))[0]).toMatchObject({ count: 1 });
  });
});

describe("drain against Resend's own count", () => {
  setupSchedulerTests();
  const realKey = process.env.AUTH_RESEND_KEY;
  afterEach(() => {
    vi.unstubAllGlobals();
    if (realKey === undefined) delete process.env.AUTH_RESEND_KEY;
    else process.env.AUTH_RESEND_KEY = realKey;
  });

  function stubSentToday(n: number) {
    const now = Date.now();
    const data = Array.from({ length: n }, (_, i) => ({
      id: `e${i}`,
      created_at: new Date(Math.max(utcDayStart(now), now - (i + 1) * 1000)).toISOString().replace("T", " ").replace("Z", "+00"),
    }));
    // One from yesterday ends the count.
    data.push({ id: "old", created_at: new Date(utcDayStart(now) - 1000).toISOString().replace("T", " ").replace("Z", "+00") });
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ object: "list", has_more: false, data }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  async function queueCases(t: T, n: number) {
    await fillPool(t, "caseConfirm");
    for (let i = 0; i < n; i++) {
      await t.mutation(internal.caseAlerts.subscribe, { email: `c${i}@example.com`, caseNumber: `G-100-25324-4255${60 + i}` });
    }
  }

  it("sends what the day's room allows and leaves the rest queued", async () => {
    process.env.AUTH_RESEND_KEY = "re_test_key";
    const t = createTestContext();
    await queueCases(t, 4);
    // 72 sent today: room is 80 - 5 - 72 = 3.
    stubSentToday(72);
    const res = await t.action(internal.confirmationQueue.drain, {});
    expect(res).toEqual({ sent: 3, room: 3 });
    expect(await queued(t)).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("caseStatusAlerts").collect())).toHaveLength(3);
  });

  it("sends nothing once the day is at the line, and nothing when Resend can't be read", async () => {
    process.env.AUTH_RESEND_KEY = "re_test_key";
    const t = createTestContext();
    await queueCases(t, 2);
    stubSentToday(DRAIN_CEILING - RECEIVED_MARGIN);
    expect(await t.action(internal.confirmationQueue.drain, {})).toEqual({ sent: 0, room: 0 });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    expect(await t.action(internal.confirmationQueue.drain, {})).toEqual({ sent: 0, room: null });
    expect(await queued(t)).toHaveLength(2);
  });

  it("an empty queue never asks Resend", async () => {
    process.env.AUTH_RESEND_KEY = "re_test_key";
    const t = createTestContext();
    const fetchMock = stubSentToday(0);
    expect(await t.action(internal.confirmationQueue.drain, {})).toEqual({ sent: 0, room: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("pure helpers", () => {
  it("reads Resend's timestamps", () => {
    expect(parseResendTime("2026-09-28 09:16:00.832000+00")).toBe(Date.UTC(2026, 8, 28, 9, 16, 0, 832));
    expect(parseResendTime("2026-09-28 09:16:00+00:00")).toBe(Date.UTC(2026, 8, 28, 9, 16, 0));
    expect(Number.isNaN(parseResendTime("yesterday"))).toBe(true);
  });

  it("the day starts at midnight UTC, which is 8 PM Eastern in summer", () => {
    const now = Date.UTC(2026, 8, 29, 18, 30);
    expect(utcDayStart(now)).toBe(Date.UTC(2026, 8, 29));
    expect(utcDayStart(Date.UTC(2026, 8, 30, 0, 1))).toBe(Date.UTC(2026, 8, 30));
  });

  it("room is the ceiling less the received margin less today's sends, at most one run's worth", () => {
    expect(drainRoom(0)).toBe(PER_RUN);
    expect(drainRoom(DRAIN_CEILING - RECEIVED_MARGIN - 2)).toBe(2);
    expect(drainRoom(DRAIN_CEILING)).toBe(0);
    expect(drainRoom(500)).toBe(0);
  });

  it("counts today's sends across pages and stops at yesterday", async () => {
    const now = Date.UTC(2026, 8, 29, 18, 0);
    const at = (h: number) => new Date(Date.UTC(2026, 8, 29, h)).toISOString().replace("T", " ").replace("Z", "+00");
    const pages = [
      { data: [{ id: "a", created_at: at(17) }, { id: "b", created_at: at(9) }], has_more: true },
      { data: [{ id: "c", created_at: at(1) }, { id: "d", created_at: "2026-09-28 23:59:00+00" }], has_more: true },
    ];
    const afters: (string | undefined)[] = [];
    const n = await countSentToday(async (after) => {
      afters.push(after);
      return pages[afters.length - 1] ?? null;
    }, now);
    expect(n).toBe(3);
    expect(afters).toEqual([undefined, "b"]);
    expect(await countSentToday(async () => null, now)).toBeNull();
  });

  it("keeps neither the IP nor the replay flag", () => {
    expect(replayArgs({ email: "a@example.com", ip: "1.2.3.4", fromQueue: true, news: false })).toEqual({
      email: "a@example.com",
      news: false,
    });
  });
});
