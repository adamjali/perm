/**
 * Mutation-side helpers for `alertOutbox`, shared by every opt-out path.
 *
 * An item waiting in the outbox was built while its subscription was live.
 * If the person turns that subscription off before the bundle goes, sending
 * it anyway would be mail they just said no to, so every opt-out drops what
 * is still waiting for the rows it touched.
 */

import type { MutationCtx } from "../_generated/server";

type Kind = "case" | "queue" | "bulletin" | "employer";

/**
 * Drop queued items for an address: every kind, one kind, or one row.
 *
 * `scope` is `"all"`, a kind, or a full `<kind>:<id>` ref. Returns how many
 * were dropped. Bounded: an address holds at most a few dozen live
 * subscriptions, and the outbox holds at most one item per subscription per
 * sweep between bundles.
 */
export async function dropQueued(
  ctx: MutationCtx,
  email: string,
  scope: "all" | Kind | `${Kind}:${string}`,
): Promise<number> {
  let dropped = 0;
  for await (const row of ctx.db
    .query("alertOutbox")
    .withIndex("by_email_status", (q) => q.eq("email", email).eq("status", "queued"))) {
    const matches =
      scope === "all" || scope === row.kind || scope === row.ref;
    if (!matches) continue;
    await ctx.db.patch(row._id, { status: "dropped", html: undefined, text: undefined });
    dropped += 1;
  }
  return dropped;
}
