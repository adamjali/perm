import { Webhook } from "svix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { hashApiKey } from "../lib/apiKeyFormat";
import { RETRY_WINDOW_MS } from "../lib/webhookSign";

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

  it("holds an account to its plan's endpoints: five while the paywall is off, two on Free once it's on", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    for (let i = 0; i < 5; i++) await endpoint(t, userId, ["queue.moved"], `https://h${i}.example.com/x`);
    expect((await as(t, userId).action(api.webhooks.createEndpoint, { url: "https://h9.example.com/x", events: ["queue.moved"] })).ok).toBe(false);

    vi.stubEnv("PAYWALL_ENFORCED", "1");
    const t2 = createTestContext();
    const other = await makeUser(t2, "free@example.com");
    await endpoint(t2, other, ["queue.moved"], "https://a.example.com/x");
    await endpoint(t2, other, ["queue.moved"], "https://b.example.com/x");
    const third = await as(t2, other).action(api.webhooks.createEndpoint, { url: "https://c.example.com/x", events: ["queue.moved"] });
    expect(third).toEqual({ ok: false, message: "The Free plan has 2 webhook endpoints. Delete one to add another." });
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
    await t.mutation(internal.webhookDelivery.recordResult, { deliveryId: d._id, ok: false, statusCode: 503, now: Date.now() });

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

  it("won't let one person resume or delete another's endpoint", async () => {
    const t = createTestContext();
    const a = await makeUser(t, "a@example.com");
    const b = await makeUser(t, "b@example.com");
    const made = await endpoint(t, a);
    await expect(as(t, b).mutation(api.webhooks.resumeEndpoint, { endpointId: made.id })).rejects.toThrow();
    await expect(as(t, b).mutation(api.webhooks.deleteEndpoint, { endpointId: made.id })).rejects.toThrow();
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
  async function keyFor(t: T, userId: Id<"users">, opts: { scopes?: string[]; sandbox?: boolean } = {}) {
    const made = await as(t, userId).action(api.apiKeys.create, { name: "k", ...opts });
    if (!made.ok) throw new Error(made.message);
    return await hashApiKey(made.key);
  }

  it("adds and removes watches for a key with the webhooks scope", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const keyHash = await keyFor(t, userId);
    expect(await t.action(api.webhooks.apiAddWatch, { keyHash, kind: "case", target: "G-100-26045-123456" })).toMatchObject({ ok: true });
    const listed = await t.mutation(api.webhooks.apiList, { keyHash });
    expect(listed.ok && listed.watches.map((w) => w.target)).toEqual(["G-100-26045-123456"]);
    expect(await t.mutation(api.webhooks.apiRemoveWatch, { keyHash, kind: "case", target: "g-100-26045-123456" })).toEqual({
      ok: true,
      removed: true,
    });
  });

  it("refuses a key without the scope, a sandbox key, and a hash nobody holds", async () => {
    const t = createTestContext();
    const userId = await makeUser(t, "dev@example.com");
    const readOnly = await keyFor(t, userId, { scopes: ["read"] });
    expect(await t.mutation(api.webhooks.apiList, { keyHash: readOnly })).toMatchObject({ ok: false, message: 'This key needs the "webhooks" scope.' });
    const sandbox = await keyFor(t, userId, { sandbox: true });
    expect(await t.mutation(api.webhooks.apiList, { keyHash: sandbox })).toMatchObject({ ok: false, message: expect.stringMatching(/Sandbox/) });
    expect(await t.mutation(api.webhooks.apiList, { keyHash: "0".repeat(64) })).toMatchObject({ ok: false });
  });

  it("makes an endpoint through the API and won't delete another account's", async () => {
    const t = createTestContext();
    const a = await makeUser(t, "a@example.com");
    const b = await makeUser(t, "b@example.com");
    const ka = await keyFor(t, a);
    const kb = await keyFor(t, b);
    const made = await t.action(api.webhooks.apiCreateEndpoint, { keyHash: ka, url: "https://a.example.com/x", events: ["queue.moved"] });
    if (!made.ok) throw new Error(made.message);
    expect(await t.mutation(api.webhooks.apiDeleteEndpoint, { keyHash: kb, endpointId: made.id })).toMatchObject({ ok: false });
    expect(await t.mutation(api.webhooks.apiDeleteEndpoint, { keyHash: ka, endpointId: made.id })).toEqual({ ok: true });
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
