/**
 * The one-time pass that ties the human check to the sign-up itself.
 *
 * convex/turnstile.ts asks Cloudflare whether a Turnstile token is good.
 * Until Sep 28 2026 that was only a check the browser ran BEFORE calling
 * signIn with flow "signUp", so a script could call signIn directly and
 * skip it. Now a passing check also issues a pass: a random string handed to
 * the browser and stored here only as its SHA-256. The sign-up form sends it
 * along, and the createOrUpdateUser hook in convex/auth.ts refuses to create
 * a password account without a live, unused pass, then deletes it.
 *
 * The Cloudflare call can't live in the sign-up itself: Convex Auth's
 * profile() is synchronous, and siteverify is a fetch.
 *
 * Nothing here grows: a pass is deleted when used, and every new pass deletes
 * up to PRUNE_PER_ISSUE expired ones. Minting a pass needs a token Cloudflare
 * accepts, so the table can't be filled without solving the check.
 */
import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";

/** How long a pass stays good. The form sends it the moment the check passes. */
export const PASS_TTL_MS = 10 * 60 * 1000;
/** Expired rows each new pass deletes. */
export const PRUNE_PER_ISSUE = 25;
/**
 * What a refused sign-up says. The browser matches "security check expired"
 * (isSecurityCheckExpired in src/lib/auth/auth-errors.ts), and a ConvexError
 * keeps this text through Convex's production error masking.
 */
export const PASS_REFUSED =
  "The security check expired. Refresh the page, complete the check again, and resubmit.";

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** A fresh pass: 32 random bytes as hex. */
export function newPass(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

/** The only form of a pass that is ever stored. */
export async function hashPass(pass: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pass));
  return hex(new Uint8Array(digest));
}

/** Store a pass's hash and clear out expired ones. */
export async function issuePass(ctx: MutationCtx, hash: string, now: number): Promise<void> {
  await ctx.db.insert("turnstilePasses", { hash, expiresAt: now + PASS_TTL_MS });
  const expired = await ctx.db
    .query("turnstilePasses")
    .withIndex("by_expires", (q) => q.lt("expiresAt", now))
    .take(PRUNE_PER_ISSUE);
  for (const row of expired) await ctx.db.delete(row._id);
}

/**
 * Use a pass up. True only for a pass that exists and hasn't expired; the row
 * is deleted either way, so no pass works twice.
 */
export async function consumePass(ctx: MutationCtx, pass: unknown, now: number): Promise<boolean> {
  if (typeof pass !== "string" || pass.length !== 64) return false;
  const hash = await hashPass(pass);
  const row = await ctx.db
    .query("turnstilePasses")
    .withIndex("by_hash", (q) => q.eq("hash", hash))
    .first();
  if (row === null) return false;
  await ctx.db.delete(row._id);
  return row.expiresAt > now;
}

/**
 * The gate the createOrUpdateUser hook runs before it creates or links a user.
 * Only a brand-new password account needs a pass: Google is its own human
 * check, and a returning user (existingUserId set) already has an account.
 */
export async function requireSignupPass(
  ctx: MutationCtx,
  args: {
    existingUserId: unknown;
    type: string;
    provider: { id: string };
    profile: Record<string, unknown>;
  },
): Promise<void> {
  if (args.existingUserId !== null) return;
  if (args.type !== "credentials" || args.provider.id !== "password") return;
  if (!(await consumePass(ctx, args.profile.turnstilePass, Date.now()))) {
    throw new ConvexError(PASS_REFUSED);
  }
}
