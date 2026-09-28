/**
 * The check both code-sending providers run before they send
 * (convex/ResendOTP.ts, convex/ResendPasswordReset.ts). It charges
 * convex/authMail.ts and throws when either limit refuses.
 *
 * Convex Auth passes the signIn action's ctx to sendVerificationRequest at
 * run time, under its own @ts-expect-error. Without a ctx to charge through,
 * this refuses rather than sends: a limit that quietly stops counting is how
 * the gap it closes stayed open.
 */
import { ConvexError } from "convex/values";
import { internal } from "../_generated/api";

/** Caught by isRateLimitError on every auth form ("too many"). */
export const AUTH_MAIL_REFUSED =
  "Too many codes have been sent to this address recently. Please wait an hour and try again.";

export type ChargeCtx = {
  runMutation?: (ref: typeof internal.authMail.charge, args: { email: string }) => Promise<boolean>;
};

export async function chargeAuthMail(ctx: ChargeCtx | undefined, email: string): Promise<void> {
  if (typeof ctx?.runMutation !== "function") {
    throw new ConvexError("We couldn't send your code right now. Please try again in a moment.");
  }
  if (!(await ctx.runMutation(internal.authMail.charge, { email }))) {
    throw new ConvexError(AUTH_MAIL_REFUSED);
  }
}
