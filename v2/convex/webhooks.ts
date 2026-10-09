/**
 * Webhook endpoints and watches: made, listed, changed and removed, from
 * Settings (signed in) and from the API (a key with the webhooks scope).
 *
 * AN ACCOUNT'S WEBHOOKS. Endpoints are where events go; each subscribes to
 * event types (convex/lib/webhookSign.ts WEBHOOK_EVENTS). Watches say which
 * case numbers and employers the account's case.status_changed and
 * employer.moved events are about; the feed events (a new bulletin, the
 * queue's month, DOL's processing times) need no watch. The plan sets how
 * many endpoints and watches (convex/lib/apiPlans.ts), through the one
 * paywall decision, `entitlement`.
 *
 * A SECRET IS SHOWN ONCE. An endpoint is made in an ACTION, because queries
 * and mutations can't use cryptographic randomness; the action builds the
 * signing secret, encrypts it (convex/lib/crypto.ts) and returns it once.
 * Nothing reads it back except the delivery action that signs with it.
 *
 * THE API'S DOOR. The site's /v1/webhooks and /v1/watches routes check the
 * key and its scope, then call the `api*` functions here with the key's
 * SHA-256, the same proof of possession `apiKeys.verify` takes. Each one
 * checks the hash again (revoked, expired, rotated past its day, sandbox,
 * scope), so a direct caller gets no further than the site would let it.
 */
import { ConvexError, v } from "convex/values";

import {
  action,
  internalMutation,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { extractUserIdFromAction, getCurrentUserIdOrNull, isEmailVerified } from "./lib/auth";
import { API_KEY_HASH_RE, randomBase62 } from "./lib/apiKeyFormat";
import { NO_WEBHOOKS_MESSAGE, entitlement, hasScope } from "./lib/apiPlans";
import { encryptToken } from "./lib/crypto";
import { checkAndRecordRateLimit } from "./lib/rateLimit";
import { easternDay, MS_PER_HOUR } from "./lib/time";
import { enqueueEvent } from "./lib/webhookQueue";
import { buildWebhookSecret, checkWebhookUrl, normaliseEvents, secretHint } from "./lib/webhookSign";
import { SLUG_RE as EMPLOYER_SLUG_RE, employerNameFor } from "./employerAlerts";
import { normaliseFlagCaseNumber } from "../src/lib/flagCaseNumber";

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));
/** Test events and resends a person may ask for in an hour: each one is a request to their server. */
export const MANUAL_SENDS_PER_HOUR = 20;
/** Resumes an owner may make in an hour: each releases up to 2,000 held deliveries at once. */
export const RESUMES_PER_HOUR = 10;

type Failure = { ok: false; message: string };
const failure = v.object({ ok: v.literal(false), message: v.string() });

async function accountOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Doc<"apiAccounts"> | null> {
  return await ctx.db
    .query("apiAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

/**
 * The account behind a key's hash, when the key may manage webhooks right
 * now. Mutations only: it reads the clock, for the key's expiry and the end
 * of a rotation's day.
 */
async function keyAccount(ctx: MutationCtx, keyHash: string): Promise<{ userId: Id<"users">; account: Doc<"apiAccounts"> } | Failure> {
  const denied: Failure = { ok: false, message: "This key can't manage webhooks." };
  if (!API_KEY_HASH_RE.test(keyHash)) return denied;
  const key = await ctx.db
    .query("apiKeys")
    .withIndex("by_hash", (q) => q.eq("keyHash", keyHash))
    .unique();
  const now = Date.now();
  if (!key || key.revokedAt !== undefined) return denied;
  if (key.expiresAt !== undefined && key.expiresAt <= now) return denied;
  if (key.graceUntil !== undefined && key.graceUntil <= now) return denied;
  if (key.sandbox) return { ok: false, message: "Sandbox keys can't change webhooks. Use a live key, or send a test event from Settings." };
  if (!hasScope(key.scopes, "webhooks")) return { ok: false, message: 'This key needs the "webhooks" scope.' };
  const user = await ctx.db.get(key.userId);
  if (!user || user.deletedAt) return denied;
  const account = await accountOf(ctx, key.userId);
  if (!account) return denied;
  return { userId: key.userId, account };
}

/**
 * The API's door is open only to the site's own server, which sends
 * API_SERVER_SECRET (set on this deployment and on the server) with every
 * call. A key's hash alone is not enough: the key's holder could compute it
 * and call these functions directly, skipping /v1's per-minute limit and its
 * call counting. Unset means shut, never open. Compared in time that doesn't
 * depend on where the strings differ.
 */
const DOOR_SHUT: Failure = { ok: false, message: "These functions answer the PERM Tracker API only. Call https://permtracker.app/v1." };
function serverDoorOpen(given: string): boolean {
  const want = process.env.API_SERVER_SECRET ?? "";
  if (want.length < 16 || given.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Shapes returned to Settings and the API                             */
/* ------------------------------------------------------------------ */

const endpointRow = v.object({
  id: v.string(),
  url: v.string(),
  events: v.array(v.string()),
  secretHint: v.string(),
  createdAt: v.number(),
  pausedAt: v.union(v.number(), v.null()),
  pauseReason: v.union(v.string(), v.null()),
  lastDeliveryAt: v.union(v.number(), v.null()),
  lastStatusCode: v.union(v.number(), v.null()),
});
const watchRow = v.object({
  id: v.string(),
  kind: v.union(v.literal("case"), v.literal("employer")),
  target: v.string(),
  createdAt: v.number(),
  lastSeenStatus: v.union(v.string(), v.null()),
});

function toEndpointRow(e: Doc<"webhookEndpoints">) {
  return {
    id: e._id as string,
    url: e.url,
    events: e.events,
    secretHint: e.secretHint,
    createdAt: e.createdAt,
    pausedAt: e.pausedAt ?? null,
    pauseReason: e.pauseReason ?? null,
    lastDeliveryAt: e.lastDeliveryAt ?? null,
    lastStatusCode: e.lastStatusCode ?? null,
  };
}
function toWatchRow(w: Doc<"webhookWatches">) {
  return { id: w._id as string, kind: w.kind, target: w.target, createdAt: w.createdAt, lastSeenStatus: w.lastSeenStatus ?? null };
}

async function endpointsOf(ctx: QueryCtx | MutationCtx, account: string) {
  return await ctx.db
    .query("webhookEndpoints")
    .withIndex("by_account", (q) => q.eq("account", account))
    .take(50);
}
async function watchesOf(ctx: QueryCtx | MutationCtx, account: string) {
  return await ctx.db
    .query("webhookWatches")
    .withIndex("by_account", (q) => q.eq("account", account))
    .take(5000);
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

/** The signed-in person's endpoints, watches and recent deliveries, with the plan's room. Null when signed out. */
export const mine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      endpointsAllowed: v.number(),
      watchesAllowed: v.number(),
      planLabel: v.string(),
      endpoints: v.array(endpointRow),
      watches: v.array(watchRow),
      deliveries: v.array(
        v.object({
          id: v.string(),
          endpointId: v.string(),
          type: v.string(),
          status: v.string(),
          attempts: v.number(),
          lastStatusCode: v.union(v.number(), v.null()),
          lastError: v.union(v.string(), v.null()),
          createdAt: v.number(),
          deliveredAt: v.union(v.number(), v.null()),
          nextAttemptAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;
    const acct = await accountOf(ctx, userId);
    const { plan } = entitlement(acct?.plan);
    const base = { endpointsAllowed: plan.webhookEndpoints, watchesAllowed: plan.webhookWatches, planLabel: plan.label };
    if (!acct) return { ...base, endpoints: [], watches: [], deliveries: [] };
    const [endpoints, watches, deliveries] = await Promise.all([
      endpointsOf(ctx, acct.account),
      watchesOf(ctx, acct.account),
      ctx.db
        .query("webhookDeliveries")
        .withIndex("by_account", (q) => q.eq("account", acct.account))
        .order("desc")
        .take(30),
    ]);
    return {
      ...base,
      endpoints: endpoints.map(toEndpointRow),
      watches: watches.sort((a, b) => b.createdAt - a.createdAt).map(toWatchRow),
      deliveries: deliveries.map((d) => ({
        id: d._id as string,
        endpointId: d.endpointId as string,
        type: d.type,
        status: d.status,
        attempts: d.attempts,
        lastStatusCode: d.lastStatusCode ?? null,
        lastError: d.lastError ?? null,
        createdAt: d.createdAt,
        deliveredAt: d.deliveredAt ?? null,
        nextAttemptAt: d.nextAttemptAt,
      })),
    };
  },
});

const created = v.object({ ok: v.literal(true), id: v.string(), secret: v.string() });
type Created = { ok: true; id: string; secret: string } | Failure;

async function buildEndpoint(
  ctx: ActionCtx,
  owner: { userId: Id<"users"> } | { keyHash: string },
  url: string,
  events: string[],
): Promise<Created> {
  const checked = checkWebhookUrl(url);
  if (!checked.ok) return checked;
  const wanted = normaliseEvents(events);
  if (wanted.length === 0) return { ok: false, message: "Choose at least one event for the endpoint." };
  const secret = buildWebhookSecret(randomBytes);
  const result: { ok: true; id: string } | Failure = await ctx.runMutation(internal.webhooks.insertEndpoint, {
    ...owner,
    url: checked.url,
    events: wanted,
    secretEnc: await encryptToken(secret),
    secretHint: secretHint(secret),
    newAccount: `acct_${randomBase62(20, randomBytes)}`,
  });
  if (!result.ok) return result;
  return { ok: true, id: result.id, secret };
}

/** Make an endpoint. The returned `secret` is the only time it's shown. */
export const createEndpoint = action({
  args: { url: v.string(), events: v.array(v.string()) },
  returns: v.union(created, failure),
  handler: async (ctx, args): Promise<Created> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, message: "Sign in to add a webhook." };
    if (args.events.length > 20) return { ok: false, message: "That's more events than exist." };
    return await buildEndpoint(ctx, { userId: extractUserIdFromAction(identity.subject) }, args.url.slice(0, 4096), args.events);
  },
});

export const insertEndpoint = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    keyHash: v.optional(v.string()),
    url: v.string(),
    events: v.array(v.string()),
    secretEnc: v.string(),
    secretHint: v.string(),
    newAccount: v.string(),
  },
  returns: v.union(v.object({ ok: v.literal(true), id: v.string() }), failure),
  handler: async (ctx, args): Promise<{ ok: true; id: string } | Failure> => {
    let userId: Id<"users">;
    let acct: Doc<"apiAccounts"> | null;
    if (args.keyHash !== undefined) {
      const k = await keyAccount(ctx, args.keyHash);
      if ("ok" in k) return k;
      userId = k.userId;
      acct = k.account;
    } else if (args.userId !== undefined) {
      userId = args.userId;
      const user = await ctx.db.get(userId);
      if (!user || user.deletedAt) return { ok: false, message: "This account is being deleted." };
      if (!(await isEmailVerified(ctx, userId))) {
        return { ok: false, message: "Confirm your email address first: sign out and back in with the code we send." };
      }
      acct = await accountOf(ctx, userId);
    } else {
      throw new Error("insertEndpoint needs a user or a key");
    }
    const { plan } = entitlement(acct?.plan);
    if (plan.webhookEndpoints === 0) return { ok: false, message: NO_WEBHOOKS_MESSAGE };
    if (acct) {
      const have = await endpointsOf(ctx, acct.account);
      if (have.length >= plan.webhookEndpoints) {
        return { ok: false, message: `The ${plan.label} plan has ${plan.webhookEndpoints} webhook endpoints. Delete one to add another.` };
      }
      if (have.some((e) => e.url === args.url)) return { ok: false, message: "That address is already an endpoint. Change its events instead." };
    } else {
      const id = await ctx.db.insert("apiAccounts", { userId, account: args.newAccount, plan: "free", createdAt: Date.now() });
      acct = await ctx.db.get(id);
    }
    const id = await ctx.db.insert("webhookEndpoints", {
      userId,
      account: acct!.account,
      url: args.url,
      events: normaliseEvents(args.events),
      secretEnc: args.secretEnc,
      secretHint: args.secretHint,
      createdAt: Date.now(),
    });
    return { ok: true, id };
  },
});

async function ownEndpoint(ctx: MutationCtx, endpointId: string): Promise<Doc<"webhookEndpoints">> {
  const userId = await getCurrentUserIdOrNull(ctx);
  if (!userId) throw new ConvexError("Sign in to change a webhook.");
  const id = ctx.db.normalizeId("webhookEndpoints", endpointId);
  const e = id ? await ctx.db.get(id) : null;
  if (!e || e.userId !== userId) throw new ConvexError("That webhook isn't one of yours.");
  return e;
}

/** Sending, resending and resuming need a plan that carries webhooks; deleting never does. */
async function requireWebhookPlan(ctx: MutationCtx, account: string): Promise<void> {
  const acct = await ctx.db
    .query("apiAccounts")
    .withIndex("by_account", (q) => q.eq("account", account))
    .unique();
  if (entitlement(acct?.plan).plan.webhookEndpoints === 0) throw new ConvexError(NO_WEBHOOKS_MESSAGE);
}

async function removeEndpoint(ctx: MutationCtx, e: Doc<"webhookEndpoints">): Promise<void> {
  const deliveries = await ctx.db
    .query("webhookDeliveries")
    .withIndex("by_endpoint", (q) => q.eq("endpointId", e._id))
    .take(1000);
  for (const d of deliveries) await ctx.db.delete(d._id);
  // More than 1,000 left: the delivery run fails each as it meets it (its
  // endpoint is gone), and the 30-day prune removes them.
  await ctx.db.delete(e._id);
}

export const deleteEndpoint = mutation({
  args: { endpointId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await removeEndpoint(ctx, await ownEndpoint(ctx, args.endpointId));
    return null;
  },
});

export const setEvents = mutation({
  args: { endpointId: v.string(), events: v.array(v.string()) },
  returns: v.union(v.object({ ok: v.literal(true) }), failure),
  handler: async (ctx, args) => {
    const e = await ownEndpoint(ctx, args.endpointId);
    const events = normaliseEvents(args.events.slice(0, 20));
    if (events.length === 0) return { ok: false as const, message: "Choose at least one event, or delete the endpoint." };
    await ctx.db.patch(e._id, { events });
    return { ok: true as const };
  },
});

/** Resume a paused endpoint and send what waited for it. */
export const resumeEndpoint = mutation({
  args: { endpointId: v.string() },
  returns: v.object({ released: v.number() }),
  handler: async (ctx, args) => {
    const e = await ownEndpoint(ctx, args.endpointId);
    await requireWebhookPlan(ctx, e.account);
    const r = await checkAndRecordRateLimit(ctx, e.userId, "webhook-resume", { limit: RESUMES_PER_HOUR, windowMs: MS_PER_HOUR });
    if (!r.allowed) {
      const minutes = Math.max(1, Math.ceil(r.resetInMs / 60_000));
      throw new ConvexError(`That's ${RESUMES_PER_HOUR} resumes this hour. Try again in ${minutes} minutes.`);
    }
    await ctx.db.patch(e._id, { pausedAt: undefined, pauseReason: undefined, pauseNotifiedAt: undefined });
    const now = Date.now();
    let released = 0;
    const held = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_endpoint", (q) => q.eq("endpointId", e._id))
      .take(2000);
    for (const d of held) {
      if (d.status !== "held") continue;
      await ctx.db.patch(d._id, { status: "pending", attempts: 0, firstAttemptAt: undefined, nextAttemptAt: now, leaseUntil: undefined });
      released++;
    }
    await ctx.scheduler.runAfter(0, internal.webhookDelivery.deliverDue, {});
    return { released };
  },
});

async function chargeManualSend(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const r = await checkAndRecordRateLimit(ctx, userId, "webhook-manual-send", { limit: MANUAL_SENDS_PER_HOUR, windowMs: MS_PER_HOUR });
  if (!r.allowed) {
    const minutes = Math.max(1, Math.ceil(r.resetInMs / 60_000));
    throw new ConvexError(`That's ${MANUAL_SENDS_PER_HOUR} test events and resends this hour. Try again in ${minutes} minutes.`);
  }
}

/** Send one test event ("ping") to an endpoint now. */
export const sendTest = mutation({
  args: { endpointId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const e = await ownEndpoint(ctx, args.endpointId);
    await requireWebhookPlan(ctx, e.account);
    await chargeManualSend(ctx, e.userId);
    await enqueueEvent(ctx, {
      type: "ping",
      key: `ping:${e._id}:${Date.now()}`,
      data: { message: "A test event from PERM Tracker. If its signature checks out, your endpoint is ready." },
      onlyEndpoint: e._id,
    });
    return null;
  },
});

/** Send one delivery's event to its endpoint again, as a fresh delivery. */
export const resend = mutation({
  args: { deliveryId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) throw new ConvexError("Sign in to resend a webhook.");
    const id = ctx.db.normalizeId("webhookDeliveries", args.deliveryId);
    const d = id ? await ctx.db.get(id) : null;
    const e = d ? await ctx.db.get(d.endpointId) : null;
    if (!d || !e || e.userId !== userId) throw new ConvexError("That delivery isn't one of yours.");
    if (!(await ctx.db.get(d.eventId))) throw new ConvexError("That event is past the 30 days the log keeps.");
    await requireWebhookPlan(ctx, e.account);
    await chargeManualSend(ctx, userId);
    const now = Date.now();
    await ctx.db.insert("webhookDeliveries", {
      endpointId: e._id,
      eventId: d.eventId,
      account: d.account,
      type: d.type,
      status: e.pausedAt !== undefined ? "held" : "pending",
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.webhookDelivery.deliverDue, {});
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Watches                                                             */
/* ------------------------------------------------------------------ */

type WatchTarget = { kind: "case"; target: string } | { kind: "employer"; target: string; name: string };

/** Check a watch's target: a case number DOL's shape allows, or an employer page we hold. */
async function resolveTarget(kind: string, raw: string): Promise<WatchTarget | Failure> {
  const text = raw.trim().slice(0, 130);
  if (kind === "case") {
    const ref = normaliseFlagCaseNumber(text.slice(0, 40));
    if (!ref) return { ok: false, message: "That isn't a case number. PERM numbers look like G-100-26045-123456." };
    return { kind: "case", target: ref.caseNumber };
  }
  if (kind === "employer") {
    const slug = text.toLowerCase();
    if (!EMPLOYER_SLUG_RE.test(slug)) return { ok: false, message: "That isn't an employer page's name. It's the end of its address, like google-llc." };
    const name = await employerNameFor(slug);
    if (!name) return { ok: false, message: "We have no employer page by that name. Search /v1/employers to find the right one." };
    return { kind: "employer", target: slug, name };
  }
  return { ok: false, message: 'A watch is on a "case" or an "employer".' };
}

export const insertWatch = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    keyHash: v.optional(v.string()),
    kind: v.union(v.literal("case"), v.literal("employer")),
    target: v.string(),
    newAccount: v.string(),
  },
  returns: v.union(v.object({ ok: v.literal(true), id: v.string(), already: v.boolean() }), failure),
  handler: async (ctx, args) => {
    let userId: Id<"users">;
    let acct: Doc<"apiAccounts"> | null;
    if (args.keyHash !== undefined) {
      const k = await keyAccount(ctx, args.keyHash);
      if ("ok" in k) return k;
      userId = k.userId;
      acct = k.account;
    } else if (args.userId !== undefined) {
      userId = args.userId;
      const user = await ctx.db.get(userId);
      if (!user || user.deletedAt) return { ok: false as const, message: "This account is being deleted." };
      if (!(await isEmailVerified(ctx, userId))) {
        return { ok: false as const, message: "Confirm your email address first: sign out and back in with the code we send." };
      }
      acct = await accountOf(ctx, userId);
    } else {
      throw new Error("insertWatch needs a user or a key");
    }
    if (entitlement(acct?.plan).plan.webhookWatches === 0) return { ok: false as const, message: NO_WEBHOOKS_MESSAGE };
    if (!acct) {
      const id = await ctx.db.insert("apiAccounts", { userId, account: args.newAccount, plan: "free", createdAt: Date.now() });
      acct = await ctx.db.get(id);
    }
    const account = acct!.account;
    const existing = await ctx.db
      .query("webhookWatches")
      .withIndex("by_account_kind_target", (q) => q.eq("account", account).eq("kind", args.kind).eq("target", args.target))
      .first();
    if (existing) return { ok: true as const, id: existing._id as string, already: true };
    const { plan } = entitlement(acct!.plan);
    const count = (await watchesOf(ctx, account)).length;
    if (count >= plan.webhookWatches) {
      return { ok: false as const, message: `The ${plan.label} plan watches ${plan.webhookWatches} cases and employers. Remove a watch to add another.` };
    }
    const id = await ctx.db.insert("webhookWatches", {
      userId,
      account,
      kind: args.kind,
      target: args.target,
      createdAt: Date.now(),
      // An employer's moves before today aren't news to a new watch.
      ...(args.kind === "employer" ? { followingFrom: easternDay(Date.now()) } : {}),
    });
    return { ok: true as const, id: id as string, already: false };
  },
});

const watched = v.object({ ok: v.literal(true), id: v.string(), already: v.boolean() });
type Watched = { ok: true; id: string; already: boolean } | Failure;

export const addWatch = action({
  args: { kind: v.string(), target: v.string() },
  returns: v.union(watched, failure),
  handler: async (ctx, args): Promise<Watched> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, message: "Sign in to add a watch." };
    const t = await resolveTarget(args.kind, args.target);
    if ("ok" in t) return t;
    const r: Watched = await ctx.runMutation(internal.webhooks.insertWatch, {
      userId: extractUserIdFromAction(identity.subject),
      kind: t.kind,
      target: t.target,
      newAccount: `acct_${randomBase62(20, randomBytes)}`,
    });
    return r;
  },
});

export const removeWatch = mutation({
  args: { watchId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) throw new ConvexError("Sign in to remove a watch.");
    const id = ctx.db.normalizeId("webhookWatches", args.watchId);
    const w = id ? await ctx.db.get(id) : null;
    if (!w || w.userId !== userId) throw new ConvexError("That watch isn't one of yours.");
    await ctx.db.delete(w._id);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* The API's door                                                      */
/* ------------------------------------------------------------------ */

const listed = v.object({ ok: v.literal(true), endpoints: v.array(endpointRow), watches: v.array(watchRow) });

export const apiList = mutation({
  args: { keyHash: v.string(), serverSecret: v.string() },
  returns: v.union(listed, failure),
  handler: async (ctx, args) => {
    if (!serverDoorOpen(args.serverSecret)) return DOOR_SHUT;
    const k = await keyAccount(ctx, args.keyHash);
    if ("ok" in k) return k;
    const [endpoints, watches] = await Promise.all([endpointsOf(ctx, k.account.account), watchesOf(ctx, k.account.account)]);
    return { ok: true as const, endpoints: endpoints.map(toEndpointRow), watches: watches.map(toWatchRow) };
  },
});

export const apiCreateEndpoint = action({
  args: { keyHash: v.string(), serverSecret: v.string(), url: v.string(), events: v.array(v.string()) },
  returns: v.union(created, failure),
  handler: async (ctx, args): Promise<Created> => {
    if (!serverDoorOpen(args.serverSecret)) return DOOR_SHUT;
    if (!API_KEY_HASH_RE.test(args.keyHash)) return { ok: false, message: "This key can't manage webhooks." };
    if (args.events.length > 20) return { ok: false, message: "That's more events than exist." };
    return await buildEndpoint(ctx, { keyHash: args.keyHash }, args.url.slice(0, 4096), args.events);
  },
});

export const apiDeleteEndpoint = mutation({
  args: { keyHash: v.string(), serverSecret: v.string(), endpointId: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), failure),
  handler: async (ctx, args) => {
    if (!serverDoorOpen(args.serverSecret)) return DOOR_SHUT;
    const k = await keyAccount(ctx, args.keyHash);
    if ("ok" in k) return k;
    const id = ctx.db.normalizeId("webhookEndpoints", args.endpointId.slice(0, 64));
    const e = id ? await ctx.db.get(id) : null;
    if (!e || e.account !== k.account.account) return { ok: false as const, message: "No webhook endpoint of yours has that id." };
    await removeEndpoint(ctx, e);
    return { ok: true as const };
  },
});

/** Whether a key may manage webhooks now, before an action spends any read on its request. */
export const keyMayManage = internalMutation({
  args: { keyHash: v.string() },
  returns: v.union(v.object({ ok: v.literal(true) }), failure),
  handler: async (ctx, args) => {
    const k = await keyAccount(ctx, args.keyHash);
    return "ok" in k ? k : { ok: true as const };
  },
});

export const apiAddWatch = action({
  args: { keyHash: v.string(), serverSecret: v.string(), kind: v.string(), target: v.string() },
  returns: v.union(watched, failure),
  handler: async (ctx, args): Promise<Watched> => {
    if (!serverDoorOpen(args.serverSecret)) return DOOR_SHUT;
    if (!API_KEY_HASH_RE.test(args.keyHash)) return { ok: false, message: "This key can't manage webhooks." };
    // The key first: resolving an employer reads the public database, and a
    // hash nobody holds must cost nothing.
    const allowed: { ok: true } | Failure = await ctx.runMutation(internal.webhooks.keyMayManage, { keyHash: args.keyHash });
    if (!allowed.ok) return allowed;
    const t = await resolveTarget(args.kind, args.target);
    if ("ok" in t) return t;
    const r: Watched = await ctx.runMutation(internal.webhooks.insertWatch, {
      keyHash: args.keyHash,
      kind: t.kind,
      target: t.target,
      newAccount: `acct_${randomBase62(20, randomBytes)}`,
    });
    return r;
  },
});

export const apiRemoveWatch = mutation({
  args: { keyHash: v.string(), serverSecret: v.string(), kind: v.string(), target: v.string() },
  returns: v.union(v.object({ ok: v.literal(true), removed: v.boolean() }), failure),
  handler: async (ctx, args) => {
    if (!serverDoorOpen(args.serverSecret)) return DOOR_SHUT;
    const k = await keyAccount(ctx, args.keyHash);
    if ("ok" in k) return k;
    if (args.kind !== "case" && args.kind !== "employer") return { ok: false as const, message: 'A watch is on a "case" or an "employer".' };
    const kind: "case" | "employer" = args.kind;
    // The same rules that stored the watch (resolveTarget), so what was added
    // under one spelling can be removed under another.
    const text = args.target.trim().slice(0, 130);
    const target = kind === "case" ? normaliseFlagCaseNumber(text.slice(0, 40))?.caseNumber : text.toLowerCase();
    if (!target) return { ok: true as const, removed: false };
    const w = await ctx.db
      .query("webhookWatches")
      .withIndex("by_account_kind_target", (q) => q.eq("account", k.account.account).eq("kind", kind).eq("target", target))
      .first();
    if (w) await ctx.db.delete(w._id);
    return { ok: true as const, removed: w !== null };
  },
});
