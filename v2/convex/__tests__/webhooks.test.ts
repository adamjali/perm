import { Webhook } from "svix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";

// Host names resolve without the network: "private.example.com" points at the
// cloud metadata address, everything else at a public one.
// "broken.example.com" answers nothing usable, the shape of a lookup that
// fails below our own error handling.
vi.mock("node:dns/promises", () => ({
  lookup: async (host: string) =>
    host === "private.example.com"
      ? [{ address: "169.254.169.254", family: 4 }]
      : host === "broken.example.com"
        ? undefined
        : [{ address: "93.184.216.34", family: 4 }],
}));
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { hashApiKey } from "../lib/apiKeyFormat";
import { RETRY_WINDOW_MS } from "../lib/webhookSign";
import { KEEP_DAYS, pauseEmailText } from "../webhookDelivery";
import { RESUMES_PER_HOUR } from "../webhooks";

type T = ReturnType<typeof createTestContext>;

const TEST_KEY = "b".repeat(64);

async function makeUser(t: T, email: string): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email });
    await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: email, emailVerified: email });
    return userId;
  });
}
const as = (t: T, userId: Id<"users">) => t.withIdentity({ subject: userId });

async function endpoint(t: T, userId: Id<"users">, events = ["case.status_changed"], url = "https://hooks.example.com/perm") {
  const r = await as(t, userId).action(api.webhooks.createEndpoint, { url, events });
  if (!r.ok) throw new Error(r.message);
  return r;
}

/** Every outbound request the tests make, answered by `answer`. */
let sent: { url: string; init: RequestInit }[] = [];
let answer: () => Response = () => new Response("ok", { status: 200 });

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("OAUTH_ENCRYPTION_KEY", TEST_KEY);
  sent = [];
  answer = () => new Response("ok", { status: 200 });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    sent.push({ url: String(url), init });
    return answer();
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("making an endpoint", () => {
  it("shows its secret once and stores it encrypted", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await endpoint(t, userId);
    expect(made.secret).toMatch(/^whsec_/);
    const rows = await t.run((ctx) => ctx.db.query("webhookEndpoints").collect());
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain(made.secret.slice(6));
    expect(rows[0]!.secretHint).toBe(made.secret.slice(-4));
    const mine = await as(t, userId).query(api.webhooks.mine, {});
    expect(mine?.endpoints[0]).toMatchObject({ url: "https://hooks.example.com/perm", events: ["case.status_changed"] });
  });

  it("refuses an address that isn't public https, and an endpoint with no events", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    expect((await as(t, userId).action(api.webhooks.createEndpoint, { url: "http://x.example.com", events: ["queue.moved"] })).ok).toBe(false);
    expect((await as(t, userId).action(api.webhooks.createEndpoint, { url: "https://x.example.com", events: ["nope"] })).ok).toBe(false);
  });

  it("holds an account to its plan's endpoints: five while the paywall is off, none on Free once it's on", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    for (let i = 0; i < 5; i++) await endpoint(t, userId, ["queue.moved"], `https://h${i}.example.com/x`);
    expect((await as(t, userId).action(api.webhooks.createEndpoint, { url: "https://h9.example.com/x", events: ["queue.moved"] })).ok).toBe(false);

    vi.stubEnv("PAYWALL_ENFORCED", "1");
    const t2 = createTestContext();
    const other = await makeUser(t2, "free@example.com");
    const first = await as(t2, other).action(api.webhooks.createEndpoint, { url: "https://a.example.com/x", events: ["queue.moved"] });
    expect(first).toEqual({ ok: false, message: "Webhooks come with the Plus plan." });
    const watch = await as(t2, other).action(api.webhooks.addWatch, { kind: "case", target: "G-100-26045-123456" });
    expect(watch).toEqual({ ok: false, message: "Webhooks come with the Plus plan." });
    expect(await t2.run((ctx) => ctx.db.query("webhookEndpoints").collect())).toHaveLength(0);
  });

  it("stops delivering to a Free account's endpoints once the paywall is on", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId, ["queue.moved"]);
    vi.stubEnv("PAYWALL_ENFORCED", "1");
    const r = await t.mutation(internal.webhookSweeps.processingTimesPublished, { permAsOf: "2026-10-01", analystMonth: "2025-12" });
    expect(r).toEqual({ updated: false, moved: false });
    await t.mutation(internal.webhookSweeps.processingTimesPublished, { permAsOf: "2026-10-08", analystMonth: "2026-01" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(sent).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("webhookDeliveries").collect())).toHaveLength(0);
  });
});

describe("watches", () => {
  it("watches a case once, by its normalised number", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const a = await as(t, userId).action(api.webhooks.addWatch, { kind: "case", target: " g-100-26045-123456 " });
    const b = await as(t, userId).action(api.webhooks.addWatch, { kind: "case", target: "G-100-26045-123456" });
    expect(a).toMatchObject({ ok: true, already: false });
    expect(b).toMatchObject({ ok: true, already: true });
    const mine = await as(t, userId).query(api.webhooks.mine, {});
    expect(mine?.watches.map((w) => w.target)).toEqual(["G-100-26045-123456"]);
  });

  it("refuses something that isn't a case number", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    expect((await as(t, userId).action(api.webhooks.addWatch, { kind: "case", target: "hello" })).ok).toBe(false);
    expect((await as(t, userId).action(api.webhooks.addWatch, { kind: "both", target: "x" })).ok).toBe(false);
  });

  it("leaves a Free account's watches off the 5-minute list once the paywall is on", async () => {
    vi.stubEnv("PAYWALL_ENFORCED", "1");
    const t = createTestContext();
    await t.run(async (ctx) => {
      const free = await ctx.db.insert("users", { email: "free@example.com" });
      const plus = await ctx.db.insert("users", { email: "plus@example.com" });
      await ctx.db.insert("apiAccounts", { userId: free, account: "acct_free", plan: "free", createdAt: 0 });
      await ctx.db.insert("apiAccounts", { userId: plus, account: "acct_plus", plan: "plus", createdAt: 0 });
      await ctx.db.insert("webhookWatches", { userId: free, account: "acct_free", kind: "case", target: "G-100-26045-111111", createdAt: 0 });
      await ctx.db.insert("webhookWatches", { userId: plus, account: "acct_plus", kind: "case", target: "G-100-26045-222222", createdAt: 0 });
    });
    // The list the server's 5-minute check reads (GET /watched-cases).
    const list = await t.query(internal.watchedCases.watchedCaseNumbers, {});
    expect(list.caseNumbers).toEqual(["G-100-26045-222222"]);
  });

  it("lands on the server's 5-minute list", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await as(t, userId).action(api.webhooks.addWatch, { kind: "case", target: "G-100-26045-123456" });
    const list = await t.query(internal.watchedCases.watchedCaseNumbers, {});
    expect(list.caseNumbers).toContain("G-100-26045-123456");
  });
});

async function watchedChange(t: T, userId: Id<"users">) {
  await as(t, userId).action(api.webhooks.addWatch, { kind: "case", target: "G-100-26045-123456" });
  const w = (await t.run((ctx) => ctx.db.query("webhookWatches").first()))!;
  await t.mutation(internal.webhookSweeps.recordCaseWatches, { checked: [w._id], seeds: [{ id: w._id, status: "ANALYST REVIEW" }], changes: [] });
  return await t.mutation(internal.webhookSweeps.recordCaseWatches, {
    checked: [w._id],
    seeds: [],
    changes: [{ id: w._id, from: "ANALYST REVIEW", to: "CERTIFIED", isFinal: true, program: "perm" }],
  });
}

describe("a watched case changes", () => {
  it("queues one event, delivered signed the Standard Webhooks way", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await endpoint(t, userId);
    expect(await watchedChange(t, userId)).toEqual({ events: 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(sent).toHaveLength(1);
    const { url, init } = sent[0]!;
    expect(url).toBe("https://hooks.example.com/perm");
    const headers = init.headers as Record<string, string>;
    const body = String(init.body);
    expect(headers["webhook-id"]).toMatch(/^msg_/);
    // The delivered signature, checked by an independent Standard Webhooks
    // library against the secret the owner was shown.
    expect(() => new Webhook(made.secret).verify(body, headers)).not.toThrow();
    expect(() => new Webhook(made.secret).verify(`${body} `, headers)).toThrow();
    expect(JSON.parse(body)).toMatchObject({
      type: "case.status_changed",
      data: { caseNumber: "G-100-26045-123456", from: "ANALYST REVIEW", to: "CERTIFIED", isFinal: true },
    });
    const d = (await t.run((ctx) => ctx.db.query("webhookDeliveries").collect()))[0]!;
    expect(d).toMatchObject({ status: "delivered", attempts: 1, lastStatusCode: 200 });
  });

  it("queues nothing for an endpoint that didn't subscribe to the event", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId, ["queue.moved"]);
    expect(await watchedChange(t, userId)).toEqual({ events: 0 });
    expect(await t.run((ctx) => ctx.db.query("webhookDeliveries").collect())).toEqual([]);
  });

  it("never tells the change twice when two sweeps race", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    await watchedChange(t, userId);
    const w = (await t.run((ctx) => ctx.db.query("webhookWatches").first()))!;
    const again = await t.mutation(internal.webhookSweeps.recordCaseWatches, {
      checked: [],
      seeds: [],
      changes: [{ id: w._id, from: "ANALYST REVIEW", to: "CERTIFIED", isFinal: true, program: "perm" }],
    });
    expect(again).toEqual({ events: 0 });
  });
});

describe("failures, retries and pausing", () => {
  it("retries a failed delivery later instead of dropping it", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    answer = () => new Response("nope", { status: 500 });
    await watchedChange(t, userId);
    await t.action(internal.webhookDelivery.deliverDue, {});
    const d = (await t.run((ctx) => ctx.db.query("webhookDeliveries").collect()))[0]!;
    expect(d).toMatchObject({ status: "pending", attempts: 1, lastStatusCode: 500 });
    expect(d.nextAttemptAt).toBeGreaterThan(Date.now());
  });

  it("doesn't follow a redirect", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    answer = () => new Response(null, { status: 302, headers: { location: "https://elsewhere.example.com" } });
    await watchedChange(t, userId);
    await t.action(internal.webhookDelivery.deliverDue, {});
    expect((sent[0]!.init as RequestInit).redirect).toBe("manual");
    const d = (await t.run((ctx) => ctx.db.query("webhookDeliveries").collect()))[0]!;
    expect(d.lastError).toMatch(/redirect/);
  });

  it("pauses the endpoint after 24 hours, holds what's waiting, and emails its owner once", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    await watchedChange(t, userId);
    const d = (await t.run((ctx) => ctx.db.query("webhookDeliveries").first()))!;
    await t.run((ctx) => ctx.db.patch(d._id, { attempts: 7, firstAttemptAt: Date.now() - RETRY_WINDOW_MS }));
    // A second event waits behind it.
    const e = (await t.run((ctx) => ctx.db.query("webhookEndpoints").first()))!;
    await t.run((ctx) =>
      ctx.db.insert("webhookDeliveries", {
        endpointId: e._id,
        eventId: d.eventId,
        account: d.account,
        type: d.type,
        status: "pending",
        attempts: 0,
        nextAttemptAt: Date.now() + 3_600_000,
        createdAt: Date.now(),
      }),
    );
    await t.mutation(internal.webhookDelivery.recordResult, { deliveryId: d._id, attempt: 7, ok: false, statusCode: 503, now: Date.now() });

    const after = await t.run((ctx) => ctx.db.query("webhookDeliveries").collect());
    expect(after.map((x) => x.status).sort()).toEqual(["failed", "held"]);
    const paused = (await t.run((ctx) => ctx.db.get(e._id)))!;
    expect(paused.pausedAt).toBeDefined();

    const first = await t.mutation(internal.webhookDelivery.claimPauseNotice, { endpointId: e._id });
    expect(first).toMatchObject({ email: "dev@example.com", url: "https://hooks.example.com/perm" });
    expect(await t.mutation(internal.webhookDelivery.claimPauseNotice, { endpointId: e._id })).toBeNull();
  });

  it("releases what was held when its owner resumes the endpoint", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    const e = (await t.run((ctx) => ctx.db.query("webhookEndpoints").first()))!;
    await t.run((ctx) => ctx.db.patch(e._id, { pausedAt: Date.now(), pauseReason: "x" }));
    await watchedChange(t, userId);
    expect((await t.run((ctx) => ctx.db.query("webhookDeliveries").first()))!.status).toBe("held");
    const r = await as(t, userId).mutation(api.webhooks.resumeEndpoint, { endpointId: e._id });
    expect(r).toEqual({ released: 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.query("webhookDeliveries").first()))!.status).toBe("delivered");
  });

  it("lets an owner resume an endpoint only so often", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const made = await endpoint(t, userId);
    for (let i = 0; i < RESUMES_PER_HOUR; i++) {
      await as(t, userId).mutation(api.webhooks.resumeEndpoint, { endpointId: made.id });
    }
    await expect(as(t, userId).mutation(api.webhooks.resumeEndpoint, { endpointId: made.id })).rejects.toThrow(/resumes this hour/);
  });

  it("won't let one person resume or delete another's endpoint", async () => {
    const t = createTestContext();
    const a = await makeUser(t, "a@example.com");
    const b = await makeUser(t, "b@example.com");
    const made = await endpoint(t, a);
    await expect(as(t, b).mutation(api.webhooks.resumeEndpoint, { endpointId: made.id })).rejects.toThrow();
    await expect(as(t, b).mutation(api.webhooks.deleteEndpoint, { endpointId: made.id })).rejects.toThrow();
  });
});

describe("delivering safely", () => {
  async function pending(t: T, userId: Id<"users">, extra: Record<string, number> = {}) {
    await watchedChange(t, userId);
    const d = (await t.run((ctx) => ctx.db.query("webhookDeliveries").first()))!;
    if (Object.keys(extra).length) await t.run((ctx) => ctx.db.patch(d._id, extra));
    return d;
  }

  it("never reads the answer's body", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    let pulled = 0;
    let cancelled = false;
    // A body that would be endless in real life; here it ends after ten chunks
    // so the old behaviour (reading it all) fails the test instead of the run.
    answer = () =>
      new Response(
        new ReadableStream({
          pull(c) {
            pulled++;
            if (pulled > 10) c.close();
            else c.enqueue(new TextEncoder().encode("x".repeat(1024)));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { status: 200 },
      );
    await pending(t, userId);
    await t.action(internal.webhookDelivery.deliverDue, {});
    expect(pulled).toBeLessThanOrEqual(1);
    expect(cancelled).toBe(true);
    expect((await t.run((ctx) => ctx.db.query("webhookDeliveries").first()))!.status).toBe("delivered");
  });

  it("fails a delivery whose 24 hours ran out without an answer recorded, and sends nothing", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    const d = await pending(t, userId, { attempts: 3, firstAttemptAt: Date.now() - RETRY_WINDOW_MS - 60_000, nextAttemptAt: Date.now() - 1 });
    sent = [];
    await t.action(internal.webhookDelivery.deliverDue, {});
    expect(sent).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(d._id)))!.status).toBe("failed");
    const e = (await t.run((ctx) => ctx.db.query("webhookEndpoints").first()))!;
    expect(e.pausedAt).toBeDefined();
  });

  it("ignores the result of a claim another run has since taken over, and never undoes a delivery", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    const d = await pending(t, userId);
    const now = Date.now();
    const first = await t.mutation(internal.webhookDelivery.claimDue, { now, limit: 10 });
    expect(first.map((c) => c.attempt)).toEqual([1]);
    // The first run's lease runs out; another run claims the same row.
    const second = await t.mutation(internal.webhookDelivery.claimDue, { now: now + 60 * 60_000, limit: 10 });
    expect(second.map((c) => c.attempt)).toEqual([2]);
    await t.mutation(internal.webhookDelivery.recordResult, { deliveryId: d._id, attempt: 1, ok: false, statusCode: 500, now });
    expect((await t.run((ctx) => ctx.db.get(d._id)))!).toMatchObject({ status: "pending", attempts: 2 });
    await t.mutation(internal.webhookDelivery.recordResult, { deliveryId: d._id, attempt: 2, ok: true, statusCode: 200, now });
    await t.mutation(internal.webhookDelivery.recordResult, { deliveryId: d._id, attempt: 2, ok: false, statusCode: 500, now });
    expect((await t.run((ctx) => ctx.db.get(d._id)))!.status).toBe("delivered");
  });

  it("holds a claim for longer than a whole batch can take", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    await pending(t, userId);
    const now = Date.now();
    await t.mutation(internal.webhookDelivery.claimDue, { now, limit: 10 });
    // 25 sends at 10 seconds each would be 250 seconds; a run five minutes later still can't take it.
    expect(await t.mutation(internal.webhookDelivery.claimDue, { now: now + 5 * 60_000, limit: 10 })).toEqual([]);
  });

  it("won't send to a host name that resolves to a private address", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId, ["case.status_changed"], "https://private.example.com/hook");
    const d = await pending(t, userId);
    sent = [];
    await t.action(internal.webhookDelivery.deliverDue, {});
    expect(sent.filter((x) => x.url.includes("private.example.com"))).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(d._id)))!.lastError).toMatch(/private address/);
  });

  it("lets one host's failed lookup cost only that host's rows one attempt, and sends the rest", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId, ["case.status_changed"], "https://broken.example.com/hook");
    await endpoint(t, userId, ["case.status_changed"], "https://hooks.example.com/perm");
    await watchedChange(t, userId);
    sent = [];
    await t.action(internal.webhookDelivery.deliverDue, {});
    expect(sent.map((x) => x.url)).toEqual(["https://hooks.example.com/perm"]);
    const rows = await t.run(async (ctx) => {
      const out: Record<string, { status: string; attempts: number }> = {};
      for (const d of await ctx.db.query("webhookDeliveries").collect()) {
        const e = (await ctx.db.get(d.endpointId))!;
        out[e.url] = { status: d.status, attempts: d.attempts };
      }
      return out;
    });
    expect(rows["https://hooks.example.com/perm"]).toEqual({ status: "delivered", attempts: 1 });
    expect(rows["https://broken.example.com/hook"]).toEqual({ status: "pending", attempts: 1 });
  });

  it("sends nothing already queued for an account whose plan has no webhooks once the paywall is on", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    const d = await pending(t, userId);
    vi.stubEnv("PAYWALL_ENFORCED", "1");
    sent = [];
    await t.action(internal.webhookDelivery.deliverDue, {});
    expect(sent).toHaveLength(0);
    expect((await t.run((ctx) => ctx.db.get(d._id)))!).toMatchObject({ status: "failed" });
  });

  it("prunes past 30 days, held deliveries and their events included, and stops", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    const old = Date.now() - (KEEP_DAYS + 1) * 86_400_000;
    await t.run(async (ctx) => {
      const e = (await ctx.db.query("webhookEndpoints").first())!;
      for (let i = 0; i < 501; i++) {
        const eventId = await ctx.db.insert("webhookEvents", { type: "queue.moved", key: `old:${i}`, payload: "{}", createdAt: old });
        await ctx.db.insert("webhookDeliveries", {
          endpointId: e._id, eventId, account: e.account, type: "queue.moved", status: "held", attempts: 0, nextAttemptAt: old, createdAt: old,
        });
      }
    });
    await t.mutation(internal.webhookDelivery.prune, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("webhookDeliveries").collect())).toHaveLength(0);
    expect(await t.run((ctx) => ctx.db.query("webhookEvents").collect())).toHaveLength(0);
  });

  it("tells a paused endpoint's owner how long its events wait", () => {
    const text = pauseEmailText("https://hooks.example.com/x", "Deliveries failed for 24 hours.", "https://permtracker.app/settings");
    expect(text).toMatch(new RegExp(`${KEEP_DAYS} days`));
    expect(text).not.toMatch(/not lost/);
  });
});

describe("the watch sweeps", () => {
  /** A public database that answers every read with no rows, or with the employer census. */
  function mirror(stagesJson?: string): () => number {
    let reads = 0;
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://db.example.com");
    vi.stubEnv("TURSO_AUTH_TOKEN", "t");
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (!String(url).endsWith("/v2/pipeline")) return new Response("ok");
      reads++;
      const census = stagesJson !== undefined && String(init.body).includes("perm_docs");
      const result = census
        ? {
            cols: [{ name: "json" }, { name: "computed_at" }],
            rows: [[{ type: "text", value: stagesJson }, { type: "integer", value: String(Date.now()) }]],
          }
        : { cols: [], rows: [] };
      return Response.json({ results: [{ type: "ok", response: { result } }, { type: "ok" }] });
    });
    return () => reads;
  }
  async function manyWatches(t: T, kind: "case" | "employer", n: number) {
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "w@example.com" });
      for (let i = 0; i < n; i++) {
        const target = kind === "case" ? `G-100-26045-${String(100000 + i)}` : `employer-${i}`;
        await ctx.db.insert("webhookWatches", { userId, account: "acct_x", kind, target, createdAt: 0 });
      }
    });
  }

  it("checks every case watch once and stops, however many batches that takes", async () => {
    const t = createTestContext();
    const reads = mirror();
    await manyWatches(t, "case", 301);
    await t.action(internal.webhookSweeps.sweepCaseWatches, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(reads()).toBe(2);
    const rows = await t.run((ctx) => ctx.db.query("webhookWatches").collect());
    expect(rows.filter((w) => w.lastCheckedAt === undefined)).toHaveLength(0);
  });

  it("checks every employer watch once and stops, however many batches that takes", async () => {
    const t = createTestContext();
    const doc = JSON.stringify({ asOf: "2026-10-09", pendingTotal: 0, nationwide: {}, minPending: 0, employers: [] });
    const reads = mirror(doc);
    await manyWatches(t, "employer", 301);
    await t.action(internal.webhookSweeps.sweepEmployerWatches, {});
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(reads()).toBe(2);
    const rows = await t.run((ctx) => ctx.db.query("webhookWatches").collect());
    expect(rows.filter((w) => w.lastCheckedAt === undefined)).toHaveLength(0);
  });
});

describe("the feeds", () => {
  it("sets the bulletin's baseline quietly, then tells subscribers of a newer month once", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId, ["bulletin.published"]);
    expect(await t.mutation(internal.webhookSweeps.bulletinSeen, { month: "2026-10" })).toEqual({ published: false });
    expect(await t.mutation(internal.webhookSweeps.bulletinSeen, { month: "2026-10" })).toEqual({ published: false });
    expect(await t.mutation(internal.webhookSweeps.bulletinSeen, { month: "2026-11" })).toEqual({ published: true });
    expect(await t.mutation(internal.webhookSweeps.bulletinSeen, { month: "2026-11" })).toEqual({ published: false });
    const events = await t.run((ctx) => ctx.db.query("webhookEvents").collect());
    expect(events.map((e) => e.type)).toEqual(["bulletin.published"]);
  });

  it("tells the queue moved only when DOL's analyst-review month changes", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId, ["queue.moved", "processing_times.updated"]);
    expect(await t.mutation(internal.webhookSweeps.processingTimesPublished, { permAsOf: "2026-09-22", analystMonth: "2025-12" })).toEqual({
      updated: true,
      moved: false,
    });
    expect(await t.mutation(internal.webhookSweeps.processingTimesPublished, { permAsOf: "2026-10-06", analystMonth: "2026-01" })).toEqual({
      updated: true,
      moved: true,
    });
    const moved = (await t.run((ctx) => ctx.db.query("webhookEvents").collect())).find((e) => e.type === "queue.moved")!;
    expect(JSON.parse(moved.payload).data).toMatchObject({ from: "2025-12", to: "2026-01" });
  });
});

describe("the API's door", () => {
  const SERVER = "server-secret-for-tests";
  beforeEach(() => vi.stubEnv("API_SERVER_SECRET", SERVER));

  async function keyFor(t: T, userId: Id<"users">, opts: { scopes?: string[]; sandbox?: boolean } = {}) {
    const made = await as(t, userId).action(api.apiKeys.create, { name: "k", ...opts });
    if (!made.ok) throw new Error(made.message);
    return await hashApiKey(made.key);
  }

  it("adds and removes watches for a key with the webhooks scope", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const keyHash = await keyFor(t, userId);
    const door = { keyHash, serverSecret: SERVER };
    expect(await t.action(api.webhooks.apiAddWatch, { ...door, kind: "case", target: "G-100-26045-123456" })).toMatchObject({ ok: true });
    const listed = await t.mutation(api.webhooks.apiList, door);
    expect(listed.ok && listed.watches.map((w) => w.target)).toEqual(["G-100-26045-123456"]);
    // Removed under the same rule that stored it: case and spaces don't matter.
    expect(await t.mutation(api.webhooks.apiRemoveWatch, { ...door, kind: "case", target: " g-100-26045 -123456" })).toEqual({
      ok: true,
      removed: true,
    });
  });

  it("refuses a key without the scope, a sandbox key, and a hash nobody holds", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const readOnly = await keyFor(t, userId, { scopes: ["read"] });
    expect(await t.mutation(api.webhooks.apiList, { keyHash: readOnly, serverSecret: SERVER })).toMatchObject({
      ok: false,
      message: 'This key needs the "webhooks" scope.',
    });
    const sandbox = await keyFor(t, userId, { sandbox: true });
    expect(await t.mutation(api.webhooks.apiList, { keyHash: sandbox, serverSecret: SERVER })).toMatchObject({
      ok: false,
      message: expect.stringMatching(/Sandbox/),
    });
    expect(await t.mutation(api.webhooks.apiList, { keyHash: "0".repeat(64), serverSecret: SERVER })).toMatchObject({ ok: false });
  });

  it("refuses a good key that comes without the server's secret, so /v1's limits can't be skipped", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const keyHash = await keyFor(t, userId);
    const refused = { ok: false, message: expect.stringMatching(/PERM Tracker API/) };
    expect(await t.mutation(api.webhooks.apiList, { keyHash, serverSecret: "guess" })).toMatchObject(refused);
    expect(await t.mutation(api.webhooks.apiDeleteEndpoint, { keyHash, serverSecret: "", endpointId: "x" })).toMatchObject(refused);
    expect(await t.mutation(api.webhooks.apiRemoveWatch, { keyHash, serverSecret: "guess", kind: "case", target: "x" })).toMatchObject(refused);
    expect(await t.action(api.webhooks.apiAddWatch, { keyHash, serverSecret: "guess", kind: "case", target: "G-100-26045-123456" })).toMatchObject(refused);
    expect(await t.action(api.webhooks.apiCreateEndpoint, { keyHash, serverSecret: "guess", url: "https://a.example.com/x", events: ["queue.moved"] })).toMatchObject(refused);
    // Unset on the deployment means shut, never open.
    vi.stubEnv("API_SERVER_SECRET", "");
    expect(await t.mutation(api.webhooks.apiList, { keyHash, serverSecret: "" })).toMatchObject(refused);
  });

  it("checks the key before reading anything to resolve a watch", async () => {
    const t = createTestContext();
    vi.stubEnv("TURSO_DATABASE_URL", "libsql://db.example.com");
    vi.stubEnv("TURSO_AUTH_TOKEN", "t");
    sent = [];
    const r = await t.action(api.webhooks.apiAddWatch, { keyHash: "f".repeat(64), serverSecret: SERVER, kind: "employer", target: "google-llc" });
    expect(r).toMatchObject({ ok: false });
    expect(sent).toHaveLength(0);
  });

  it("makes an endpoint through the API and won't delete another account's", async () => {
    const t = createTestContext();
    const a = await makeUser(t, "a@example.com");
    const b = await makeUser(t, "b@example.com");
    const ka = await keyFor(t, a);
    const kb = await keyFor(t, b);
    const made = await t.action(api.webhooks.apiCreateEndpoint, {
      keyHash: ka,
      serverSecret: SERVER,
      url: "https://a.example.com/x",
      events: ["queue.moved"],
    });
    if (!made.ok) throw new Error(made.message);
    expect(await t.mutation(api.webhooks.apiDeleteEndpoint, { keyHash: kb, serverSecret: SERVER, endpointId: made.id })).toMatchObject({ ok: false });
    expect(await t.mutation(api.webhooks.apiDeleteEndpoint, { keyHash: ka, serverSecret: SERVER, endpointId: made.id })).toEqual({ ok: true });
  });
});

describe("deleting the account", () => {
  it("removes its endpoints, watches and delivery log", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    await endpoint(t, userId);
    await watchedChange(t, userId);
    await t.run(async (ctx) => {
      const { purgeAllUserData } = await import("../lib/deletion");
      await purgeAllUserData(ctx, userId);
    });
    for (const table of ["webhookEndpoints", "webhookWatches", "webhookDeliveries"] as const) {
      expect(await t.run((ctx) => ctx.db.query(table).collect())).toEqual([]);
    }
  });
});
