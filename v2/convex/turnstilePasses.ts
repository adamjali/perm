/**
 * Stores a pass issued by convex/turnstile.ts. Kept apart from that file
 * because it runs in Node ("use node"), and a mutation can't.
 *
 * @module convex/turnstilePasses
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { issuePass } from "./lib/turnstilePass";

export const issue = internalMutation({
  args: { hash: v.string() },
  returns: v.null(),
  handler: async (ctx, { hash }) => {
    await issuePass(ctx, hash, Date.now());
    return null;
  },
});
