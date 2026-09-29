/**
 * Every sign-in code and password-reset email is charged here before it
 * sends (convex/lib/authMailGate.ts, called from convex/ResendOTP.ts and
 * convex/ResendPasswordReset.ts).
 *
 * Two limits, in this order. Per address, 5 codes an hour: enough for a
 * person asking again, and the one an attacker meets first, because a reset
 * can only be sent to an address that has an account. Then the whole site,
 * 80 a day (40 until Sep 29 2026): the backstop that no rotation gets
 * around. List mail stops at 85 of Resend's 100 (convex/lib/emailLimits.ts),
 * so the last 15 of every day are always free for codes. A refusal by the
 * site-wide pool is counted for the admin panel (noteRefusal); a per-address
 * refusal is one person asking too often, not a sign the pool is too small.
 *
 * The answer names which limit refused ("address" or "site"), so the form can
 * say the true thing: until Sep 29 2026 a site-wide refusal told the person
 * codes had been sent "to this address", which was false.
 *
 * @module convex/authMail
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  AUTH_MAIL_ADDRESS_KEY,
  AUTH_MAIL_PER_ADDRESS,
  BUDGETS,
  noteRefusal,
  windowFor,
} from "./lib/alertBudgets";
import { checkRateLimit, recordRateLimitAttempt } from "./lib/rateLimit";

export const charge = internalMutation({
  args: { email: v.string() },
  returns: v.union(v.literal("ok"), v.literal("address"), v.literal("site")),
  handler: async (ctx, { email }) => {
    const address = email.trim().toLowerCase();
    const mine = await checkRateLimit(ctx, address, AUTH_MAIL_ADDRESS_KEY, AUTH_MAIL_PER_ADDRESS);
    if (!mine.allowed) return "address" as const;
    const all = await checkRateLimit(ctx, "all", BUDGETS.authMail.key, windowFor("authMail"));
    if (!all.allowed) {
      await noteRefusal(ctx, "authMail");
      return "site" as const;
    }
    await recordRateLimitAttempt(ctx, address, AUTH_MAIL_ADDRESS_KEY);
    await recordRateLimitAttempt(ctx, "all", BUDGETS.authMail.key);
    return "ok" as const;
  },
});
