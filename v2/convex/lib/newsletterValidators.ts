/**
 * Validators shared between the digest module and the admin signals query.
 * Kept out of `convex/newsletter.ts` on purpose: a value import from a
 * function module into another function module closes a type cycle through
 * `_generated/api`, and TypeScript resolves the cycle by widening the query's
 * return type to `any`, which then shows up as implicit-any errors in every
 * test that maps over it.
 */
import { v } from "convex/values";

export const issueStatusValidator = v.union(
  v.literal("preview"),
  v.literal("sending"),
  v.literal("sent"),
);

export const adminSummaryValidator = v.object({
  enabled: v.boolean(),
  dailyCap: v.number(),
  staged: v.number(),
  confirmed: v.number(),
  latest: v.union(
    v.null(),
    v.object({
      weekOf: v.string(),
      subject: v.string(),
      status: issueStatusValidator,
      sentCount: v.number(),
      builtAt: v.number(),
      text: v.string(),
    }),
  ),
});
