/**
 * API keys: made, listed, revoked and checked.
 *
 * A key is made in an ACTION because Convex queries and mutations can't use
 * cryptographic randomness. The action builds the key, keeps only its SHA-256
 * and returns the key once; nothing can show it again.
 *
 * The site checks a key with `verify`, by hash, and keeps the answer for 60
 * seconds (src/lib/api/auth.ts), so a revoked key stops working within a
 * minute and Convex sees one query per key per minute, not one per call.
 * `verify` is public on purpose: only someone holding the key can compute its
 * hash, and the answer carries no user id, no email and no name.
 *
 * Calls are counted in the public-data database (src/lib/api/usage.ts), keyed
 * by the account's random id and the key's public id, never by user.
 */
import { ConvexError, v } from "convex/values";

import {
  action,
  internalMutation,
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
import { apiPlan } from "./lib/apiPlans";

const NAME_MAX = 60;
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function accountFor(ctx: QueryCtx | MutationCtx, userId: Id<"users">): Promise<Doc<"apiAccounts"> | null> {
  return await ctx.db
    .query("apiAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

const planValidator = v.object({
  id: v.union(v.literal("free"), v.literal("plus")),
  label: v.string(),
  keys: v.number(),
  perMinute: v.number(),
  perDay: v.number(),
  perMonth: v.number(),
});
const failure = v.object({ ok: v.literal(false), message: v.string() });

/** The signed-in person's plan, limits and active keys. Null when signed out. */
export const mine = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      plan: planValidator,
      account: v.union(v.string(), v.null()),
      keys: v.array(v.object({ keyId: v.string(), name: v.string(), createdAt: v.number() })),
    }),
  ),
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;
    const acct = await accountFor(ctx, userId);
    const keys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const plan = apiPlan(acct?.plan);
    return {
      plan,
      account: acct?.account ?? null,
      keys: keys
        .filter((k) => k.revokedAt === undefined)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((k) => ({ keyId: k.keyId, name: k.name, createdAt: k.createdAt })),
    };
  },
});

/** Make a key. The returned `key` is the only time it exists outside its owner's hands. */
export const create = action({
  args: { name: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), key: v.string(), keyId: v.string(), name: v.string() }),
    failure,
  ),
  handler: async (ctx, args): Promise<{ ok: true; key: string; keyId: string; name: string } | { ok: false; message: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false, message: "Sign in to make a key." };
    const userId = extractUserIdFromAction(identity.subject);
    const name = args.name.trim().slice(0, NAME_MAX) || "My key";

    const key = buildApiKey(randomBytes);
    const parsed = parseApiKey(key);
    if (!parsed) throw new Error("built a key that does not parse");
    const keyHash = await hashApiKey(key);
    const result = await ctx.runMutation(internal.apiKeys.insertKey, {
      userId,
      keyHash,
      keyId: parsed.keyId,
      name,
      // Used only when the account has no API account yet.
      newAccount: `acct_${randomBase62(20, randomBytes)}`,
    });
    if (!result.ok) return result;
    return { ok: true, key, keyId: parsed.keyId, name };
  },
});

export const insertKey = internalMutation({
  args: {
    userId: v.id("users"),
    keyHash: v.string(),
    keyId: v.string(),
    name: v.string(),
    newAccount: v.string(),
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

    let acct = await accountFor(ctx, args.userId);
    const plan = apiPlan(acct?.plan);
    const active = (
      await ctx.db
        .query("apiKeys")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect()
    ).filter((k) => k.revokedAt === undefined);
    if (active.length >= plan.keys) {
      return {
        ok: false,
        message:
          plan.keys === 1
            ? `The ${plan.label} plan has one key. Revoke it to make a new one.`
            : `The ${plan.label} plan has ${plan.keys} keys. Revoke one to make a new one.`,
      };
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
        createdAt: Date.now(),
      });
      acct = await ctx.db.get(id);
    }
    await ctx.db.insert("apiKeys", {
      userId: args.userId,
      account: acct!.account,
      keyHash: args.keyHash,
      keyId: args.keyId,
      name: args.name,
      createdAt: Date.now(),
    });
    return { ok: true };
  },
});

/** Revoke one of your own keys. Calls with it stop within a minute. */
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
    if (key.revokedAt === undefined) await ctx.db.patch(key._id, { revokedAt: Date.now() });
    return { revoked: true };
  },
});

/**
 * The site's check of a key, by hash. Null for a hash we never issued or a key
 * whose account is being deleted.
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
      plan: v.union(v.literal("free"), v.literal("plus")),
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
    return {
      keyId: key.keyId,
      revoked: false as const,
      account: key.account,
      plan: apiPlan(acct?.plan).id,
    };
  },
});

/**
 * Put an account on a plan by hand, for comped accounts until billing exists:
 * npx convex run apiKeys:setPlan '{"email":"...","plan":"plus"}' --prod
 */
export const setPlan = internalMutation({
  args: { email: v.string(), plan: v.union(v.literal("free"), v.literal("plus")) },
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
