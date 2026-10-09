/**
 * API keys: made, listed, rotated, revoked and checked.
 *
 * A key is made in an ACTION because Convex queries and mutations can't use
 * cryptographic randomness. The action builds the key, keeps only its SHA-256
 * and returns the key once; nothing can show it again.
 *
 * The site checks a key with `verify`, by hash, and keeps the answer for 60
 * seconds (src/lib/api/auth.ts), so a revoked key stops working within a
 * minute and Convex sees one query per key per minute, not one per call. A
 * revoke or a rotation also tells the site at once (`pushRevoke`), so the
 * minute is the ceiling, not the usual wait. `verify` is public on purpose:
 * only someone holding the key can compute its hash, and the answer carries
 * no user id, no email and no name.
 *
 * WHAT A KEY CARRIES. Its scopes (convex/lib/apiPlans.ts), an optional
 * expiry, whether it's a sandbox key (pt_test_, fixed sample data), and after
 * a rotation the 24 hours it keeps working. `verify` returns those as stored
 * and the site compares the times with its own clock: a query that read the
 * clock would be cached past the moment a key stopped.
 *
 * Calls are counted in the public-data database (src/lib/api/usage.ts), keyed
 * by the account's random id and the key's public id, never by user.
 */
import { ConvexError, v } from "convex/values";

import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { extractUserIdFromAction, getCurrentUserIdOrNull, isEmailVerified } from "./lib/auth";
import {
  API_KEY_HASH_RE,
  API_KEY_ID_LENGTH,
  buildApiKey,
  hashApiKey,
  parseApiKey,
  randomBase62,
} from "./lib/apiKeyFormat";
import { DEFAULT_SCOPES, entitlement, normaliseScopes } from "./lib/apiPlans";
import { SITE_URL } from "./lib/links";
import { createLogger } from "./lib/logging";
import { MS_PER_DAY, MS_PER_HOUR } from "./lib/time";

const log = createLogger("ApiKeys");

const NAME_MAX = 60;
/** How long a rotated key keeps working, so the new one can be rolled out. */
export const ROTATION_GRACE_MS = 24 * MS_PER_HOUR;
/** The longest lifetime a key can be given, in days. */
export const MAX_KEY_DAYS = 730;

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function accountFor(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Doc<"apiAccounts"> | null> {
  return await ctx.db
    .query("apiAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function keysOf(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Doc<"apiKeys">[]> {
  return await ctx.db
    .query("apiKeys")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
}

/**
 * Keys that take a place on the plan: not revoked, not expired, and not a
 * rotated key in its last 24 hours (a rotation never needs a free place).
 */
export function holdsAPlace(k: Pick<Doc<"apiKeys">, "revokedAt" | "expiresAt" | "graceUntil">, now: number): boolean {
  if (k.revokedAt !== undefined) return false;
  if (k.expiresAt !== undefined && k.expiresAt <= now) return false;
  return k.graceUntil === undefined;
}

const planId = v.union(v.literal("free"), v.literal("plus"));
const planValidator = v.object({
  id: planId,
  label: v.string(),
  keys: v.number(),
  sandboxKeys: v.number(),
  perMinute: v.number(),
  perDay: v.number(),
  perMonth: v.number(),
  exportRows: v.number(),
  liveLookupsPerDay: v.number(),
  webhookEndpoints: v.number(),
  webhookWatches: v.number(),
});
const failure = v.object({ ok: v.literal(false), message: v.string() });
const keyRow = v.object({
  keyId: v.string(),
  name: v.string(),
  createdAt: v.number(),
  scopes: v.array(v.string()),
  sandbox: v.boolean(),
  expiresAt: v.union(v.number(), v.null()),
  graceUntil: v.union(v.number(), v.null()),
  replacedBy: v.union(v.string(), v.null()),
});

/**
 * The signed-in person's plan, limits and keys. Null when signed out. Keys
 * that have expired or finished their rotation are still listed (the page
 * marks them by its own clock), so their owner can see and remove them.
 */
export const mine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      /** The limits and features that apply now (Plus for everyone while the paywall is off). */
      plan: planValidator,
      /** The plan the account itself is on. */
      accountPlan: planId,
      paywall: v.boolean(),
      account: v.union(v.string(), v.null()),
      keys: v.array(keyRow),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;
    const acct = await accountFor(ctx, userId);
    const keys = await keysOf(ctx, userId);
    const ent = entitlement(acct?.plan);
    return {
      plan: ent.plan,
      accountPlan: ent.accountPlan,
      paywall: ent.paywall,
      account: acct?.account ?? null,
      keys: keys
        .filter((k) => k.revokedAt === undefined)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((k) => ({
          keyId: k.keyId,
          name: k.name,
          createdAt: k.createdAt,
          scopes: k.scopes ?? [...DEFAULT_SCOPES],
          sandbox: k.sandbox === true,
          expiresAt: k.expiresAt ?? null,
          graceUntil: k.graceUntil ?? null,
          replacedBy: k.replacedBy ?? null,
        })),
    };
  },
});

const made = v.object({ ok: v.literal(true), key: v.string(), keyId: v.string(), name: v.string(), sandbox: v.boolean() });
type Made = { ok: true; key: string; keyId: string; name: string; sandbox: boolean } | { ok: false; message: string };

/** Make a key. The returned `key` is the only time it exists outside its owner's hands. */
export const create = action({
  args: {
    name: v.string(),
    scopes: v.optional(v.array(v.string())),
    /** Days until it stops working on its own; none means it lasts until revoked. */
    expiresInDays: v.optional(v.number()),
    sandbox: v.optional(v.boolean()),
  },
  returns: v.union(made, failure),
  handler: async (ctx, args): Promise<Made> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, message: "Sign in to make a key." };
    const userId = extractUserIdFromAction(identity.subject);
    const name = args.name.trim().slice(0, NAME_MAX) || "My key";
    if (args.scopes && args.scopes.length > 20) return { ok: false, message: "That's more scopes than exist." };
    const days = args.expiresInDays;
    if (days !== undefined && (!Number.isInteger(days) || days < 1 || days > MAX_KEY_DAYS)) {
      return { ok: false, message: `A key can last 1 to ${MAX_KEY_DAYS} days, or until you revoke it.` };
    }
    const sandbox = args.sandbox === true;

    const key = buildApiKey(randomBytes, sandbox);
    const parsed = parseApiKey(key);
    if (!parsed) throw new Error("built a key that does not parse");
    const keyHash = await hashApiKey(key);
    const result = await ctx.runMutation(internal.apiKeys.insertKey, {
      userId,
      keyHash,
      keyId: parsed.keyId,
      name,
      scopes: normaliseScopes(args.scopes ?? DEFAULT_SCOPES),
      ...(days !== undefined ? { expiresInDays: days } : {}),
      sandbox,
      // Used only when the account has no API account yet.
      newAccount: `acct_${randomBase62(20, randomBytes)}`,
    });
    if (!result.ok) return result;
    return { ok: true, key, keyId: parsed.keyId, name, sandbox };
  },
});

function placeMessage(label: string, n: number, sandbox: boolean): string {
  const what = sandbox ? "sandbox key" : "key";
  return n === 1
    ? `The ${label} plan has one ${what}. Revoke it to make a new one.`
    : `The ${label} plan has ${n} ${what}s. Revoke one to make a new one.`;
}

export const insertKey = internalMutation({
  args: {
    userId: v.id("users"),
    keyHash: v.string(),
    keyId: v.string(),
    name: v.string(),
    scopes: v.optional(v.array(v.string())),
    expiresInDays: v.optional(v.number()),
    sandbox: v.optional(v.boolean()),
    newAccount: v.string(),
    /** A rotation: the key this one replaces, which then keeps working for 24 hours. */
    replaces: v.optional(v.string()),
  },
  returns: v.union(v.object({ ok: v.literal(true) }), failure),
  handler: async (ctx, args): Promise<{ ok: true } | { ok: false; message: string }> => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.deletedAt) return { ok: false, message: "This account is being deleted, so it can't make keys." };
    if (!(await isEmailVerified(ctx, args.userId))) {
      return { ok: false, message: "Confirm your email address first: sign out and back in with the code we send." };
    }
    if (!API_KEY_HASH_RE.test(args.keyHash) || args.keyId.length !== API_KEY_ID_LENGTH) {
      throw new Error("malformed key record");
    }
    const now = Date.now();
    const sandbox = args.sandbox === true;

    let acct = await accountFor(ctx, args.userId);
    const { plan } = entitlement(acct?.plan);
    const keys = await keysOf(ctx, args.userId);

    let old: Doc<"apiKeys"> | null = null;
    if (args.replaces !== undefined) {
      old = keys.find((k) => k.keyId === args.replaces) ?? null;
      if (!old || !holdsAPlace(old, now)) return { ok: false, message: "That key can't be rotated: it's revoked, expired or already rotated." };
      // One rotation in flight at a time, or rotating again and again would
      // hold any number of working keys in one place.
      if (keys.some((k) => k.revokedAt === undefined && k.graceUntil !== undefined && k.graceUntil > now)) {
        return {
          ok: false,
          message: "A key you rotated is still in its 24 hours. Revoke the old key now, or rotate again once it stops.",
        };
      }
    } else {
      const holding = keys.filter((k) => (k.sandbox === true) === sandbox && holdsAPlace(k, now)).length;
      const room = sandbox ? plan.sandboxKeys : plan.keys;
      if (holding >= room) return { ok: false, message: placeMessage(plan.label, room, sandbox) };
    }

    // A clash on 8 random base-62 characters is about one in 200 trillion; the
    // check costs one index read and turns it into "try again" instead of two
    // keys sharing one usage line.
    const clash = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_id", (q) => q.eq("keyId", args.keyId))
      .first();
    if (clash) return { ok: false, message: "Something went wrong making the key. Try again." };

    if (!acct) {
      const id = await ctx.db.insert("apiAccounts", {
        userId: args.userId,
        account: args.newAccount,
        plan: "free",
        createdAt: now,
      });
      acct = await ctx.db.get(id);
    }
    await ctx.db.insert("apiKeys", {
      userId: args.userId,
      account: acct!.account,
      keyHash: args.keyHash,
      keyId: args.keyId,
      name: args.name,
      createdAt: now,
      scopes: normaliseScopes(args.scopes ?? DEFAULT_SCOPES),
      ...(args.expiresInDays !== undefined ? { expiresAt: now + args.expiresInDays * MS_PER_DAY } : {}),
      ...(sandbox ? { sandbox: true } : {}),
    });
    if (old) {
      const graceUntil = now + ROTATION_GRACE_MS;
      await ctx.db.patch(old._id, {
        graceUntil: old.expiresAt !== undefined ? Math.min(graceUntil, old.expiresAt) : graceUntil,
        replacedBy: args.keyId,
      });
      // Tell the site now, so the old key's cached answer carries its end.
      await ctx.scheduler.runAfter(0, internal.apiKeys.pushRevoke, { keyIds: [old.keyId] });
    }
    return { ok: true };
  },
});

/**
 * Rotate a key: a new key with the same name, scopes, lifetime and kind, shown
 * once, while the old one keeps working for 24 hours.
 */
export const rotate = action({
  args: { keyId: v.string() },
  returns: v.union(made, failure),
  handler: async (ctx, args): Promise<Made> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, message: "Sign in to rotate a key." };
    const userId = extractUserIdFromAction(identity.subject);
    const old: { name: string; scopes: string[]; sandbox: boolean; expiresAt: number | null } | null =
      await ctx.runQuery(internal.apiKeys.forRotation, { userId, keyId: args.keyId.slice(0, 20) });
    if (!old) return { ok: false, message: "That key isn't one of yours." };
    // The new key ends when the old one would have, at least a day out, so
    // rotating never extends a key its owner gave an end.
    const daysLeft = old.expiresAt === null ? null : Math.max(1, Math.ceil((old.expiresAt - Date.now()) / MS_PER_DAY));

    const key = buildApiKey(randomBytes, old.sandbox);
    const parsed = parseApiKey(key);
    if (!parsed) throw new Error("built a key that does not parse");
    const result = await ctx.runMutation(internal.apiKeys.insertKey, {
      userId,
      keyHash: await hashApiKey(key),
      keyId: parsed.keyId,
      name: old.name,
      scopes: old.scopes,
      ...(daysLeft !== null ? { expiresInDays: daysLeft } : {}),
      sandbox: old.sandbox,
      newAccount: `acct_${randomBase62(20, randomBytes)}`,
      replaces: args.keyId,
    });
    if (!result.ok) return result;
    return { ok: true, key, keyId: parsed.keyId, name: old.name, sandbox: old.sandbox };
  },
});

/** What a rotation copies from the old key. */
export const forRotation = internalQuery({
  args: { userId: v.id("users"), keyId: v.string() },
  returns: v.union(
    v.null(),
    v.object({ name: v.string(), scopes: v.array(v.string()), sandbox: v.boolean(), expiresAt: v.union(v.number(), v.null()) }),
  ),
  handler: async (ctx, args) => {
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_id", (q) => q.eq("keyId", args.keyId))
      .first();
    if (!key || key.userId !== args.userId) return null;
    return {
      name: key.name,
      scopes: key.scopes ?? [...DEFAULT_SCOPES],
      sandbox: key.sandbox === true,
      expiresAt: key.expiresAt ?? null,
    };
  },
});

/** Revoke one of your own keys. Calls with it stop within a minute, usually at once. */
export const revoke = mutation({
  args: { keyId: v.string() },
  returns: v.object({ revoked: v.boolean() }),
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) throw new ConvexError("Sign in to revoke a key.");
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_id", (q) => q.eq("keyId", args.keyId))
      .first();
    if (!key || key.userId !== userId) throw new ConvexError("That key isn't one of yours.");
    if (key.revokedAt === undefined) {
      await ctx.db.patch(key._id, { revokedAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.apiKeys.pushRevoke, { keyIds: [key.keyId] });
    }
    return { revoked: true };
  },
});

/**
 * Tell the site a key changed, so both copies drop their cached answer at
 * once instead of within the minute. Best effort: when it fails, the cache's
 * minute is still the ceiling. nginx mirrors `/api/revalidate-*` to the
 * second copy, which is why the route carries that prefix.
 */
export const pushRevoke = internalAction({
  args: { keyIds: v.array(v.string()) },
  returns: v.null(),
  handler: async (_ctx, args) => {
    const secret = process.env.REVALIDATE_SECRET;
    if (!secret) {
      log.warn("REVALIDATE_SECRET isn't set; a revoked key stops within the site's minute", { keys: args.keyIds.length });
      return null;
    }
    try {
      const res = await fetch(`${SITE_URL}/api/revalidate-api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-revalidate-secret": secret },
        body: JSON.stringify({ keyIds: args.keyIds.slice(0, 20) }),
      });
      if (!res.ok) log.warn("key refresh refused", { status: res.status });
    } catch (error) {
      log.warn("key refresh failed", { error: error instanceof Error ? error.message : String(error) });
    }
    return null;
  },
});

/**
 * The site's check of a key, by hash. Null for a hash we never issued or a key
 * whose account is being deleted. A live answer carries the times the key
 * stops (its expiry, the end of a rotation's day) for the site to compare.
 */
export const verify = query({
  args: { keyHash: v.string() },
  returns: v.union(
    v.null(),
    v.object({ keyId: v.string(), revoked: v.literal(true) }),
    v.object({
      keyId: v.string(),
      revoked: v.literal(false),
      account: v.string(),
      /** The plan whose limits apply now: Plus for everyone while the paywall is off. */
      plan: planId,
      accountPlan: planId,
      paywall: v.boolean(),
      scopes: v.array(v.string()),
      sandbox: v.boolean(),
      expiresAt: v.union(v.number(), v.null()),
      graceUntil: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx, args) => {
    if (!API_KEY_HASH_RE.test(args.keyHash)) return null;
    const key = await ctx.db
      .query("apiKeys")
      .withIndex("by_hash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    if (!key) return null;
    if (key.revokedAt !== undefined) return { keyId: key.keyId, revoked: true as const };
    const user = await ctx.db.get(key.userId);
    if (!user || user.deletedAt) return null;
    const acct = await accountFor(ctx, key.userId);
    const ent = entitlement(acct?.plan);
    return {
      keyId: key.keyId,
      revoked: false as const,
      account: key.account,
      plan: ent.plan.id,
      accountPlan: ent.accountPlan,
      paywall: ent.paywall,
      scopes: key.scopes ?? [...DEFAULT_SCOPES],
      sandbox: key.sandbox === true,
      expiresAt: key.expiresAt ?? null,
      graceUntil: key.graceUntil ?? null,
    };
  },
});

/**
 * Put an account on a plan by hand, for comped accounts until billing exists:
 * npx convex run apiKeys:setPlan '{"email":"...","plan":"plus"}' --prod
 */
export const setPlan = internalMutation({
  args: { email: v.string(), plan: planId },
  returns: v.union(failure, v.object({ ok: v.literal(true), plan: v.string() })),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email.trim().toLowerCase()))
      .first();
    if (!user) return { ok: false as const, message: "no user with that email" };
    const acct = await accountFor(ctx, user._id);
    if (!acct) return { ok: false as const, message: "that user has no API account yet: they make a key first" };
    await ctx.db.patch(acct._id, { plan: args.plan });
    return { ok: true as const, plan: args.plan };
  },
});
