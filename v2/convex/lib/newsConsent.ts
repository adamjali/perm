/**
 * Staging a product-news opt-in, inside the caller's own transaction.
 *
 * The three alert `subscribe` mutations stage the news row themselves rather
 * than letting the HTTP layer fire a second mutation afterwards, because the
 * confirmation email has to NAME the opt-in and the row has to exist by the
 * time that email is composed. See the module docstring in
 * convex/emailPrefs.ts for the race that shape closes.
 *
 * ## Why this is in lib/ and not next to `stageNews`
 *
 * The obvious home is convex/emailPrefs.ts. It can't be: that module imports
 * `./lib/auth`, which pulls `@convex-dev/auth/server`, and Convex loads a
 * whole module for any function in it. Importing `emailPrefs` from
 * queueAlerts / caseAlerts / bulletinAlerts would make every cold subscribe on
 * the unauthenticated HTTP routes pay for an auth SDK it never touches. That's
 * the same cold-path discipline that already forced the React renderer in
 * those three files to be a dynamic import, measured there at 1.3-2.5s on a
 * request that should reject in under a second. This file imports nothing but
 * a type.
 *
 * @module convex/lib/newsConsent
 */

import type { MutationCtx } from "../_generated/server";

/**
 * The same conservative address check the alert modules use.
 *
 * The length cap runs FIRST and that ordering is load-bearing, not style.
 * `[^\s@]` matches `.`, so `[^\s@]+\.[^\s@]{2,}$` backtracks quadratically on
 * a long failing input: measured in V8, `"a@" + ".".repeat(80000) + "@"` took
 * 8.2 seconds against this pattern and 0.005 ms with the length check first.
 */
function isPlausibleEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Record a product-news opt-in for an address, UNCONFIRMED.
 *
 * Inert until an alert confirm click lands on the same address, which is what
 * `emailPrefs.confirmNewsForEmail` acts on. Nothing here sends mail or grants
 * consent; it records that the box was ticked. Callers reach it through
 * `emailPrefs.stageNews` (the internalMutation wrapper) or directly from a
 * mutation that is already in a transaction.
 */
export async function stageNewsFor(
  ctx: MutationCtx,
  rawEmail: string,
  source?: string,
): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!isPlausibleEmail(email)) return;

  const existing = await ctx.db
    .query("newsSubscribers")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (existing) {
    // An opted-out row stays opted out until a fresh confirm click: the stage
    // is recorded by clearing nothing. A new checkbox tick on a form is a
    // request, and the confirm click is what honours it. `createdAt` moving
    // past `unsubscribedAt` is the whole signal - that comparison in
    // `confirmNewsForEmail` is what separates a genuine new request from a
    // replayed old link.
    if (existing.unsubscribedAt !== undefined) {
      await ctx.db.patch(existing._id, { createdAt: Date.now() });
    }
    return;
  }

  await ctx.db.insert("newsSubscribers", {
    email,
    createdAt: Date.now(),
    source,
  });
}
