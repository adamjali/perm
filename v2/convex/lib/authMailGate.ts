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

/** The site-wide daily pool, not this address. Also reads as "too many". */
export const AUTH_MAIL_SITE_BUSY =
  "Too many codes have gone out from the site today, so this one can't be sent right now. Please try again in a few hours.";

export type ChargeCtx = {
  runMutation?: (
    ref: typeof internal.authMail.charge,
    args: { email: string },
  ) => Promise<"ok" | "address" | "site">;
};

/**
 * Count a code that left in the day's email count (convex/emailLedger.ts), so
 * list mail stops short of the 100 and leaves room for the next code. Codes are
 * never put in the retry queue: one that arrives late is useless. Best effort;
 * a failed count never fails the sign-in.
 */
export async function recordAuthSend(ctx: unknown, sent: unknown): Promise<void> {
  const run = (ctx as { runMutation?: unknown } | undefined)?.runMutation;
  if (typeof run !== "function") return;
  const headers = (sent as { headers?: Record<string, string> | null } | undefined)?.headers;
  const n = Number(headers?.["x-resend-daily-quota"]);
  try {
    await (run as (ref: typeof internal.emailLedger.recordSend, args: { quota?: number }) => Promise<unknown>)(
      internal.emailLedger.recordSend,
      Number.isFinite(n) && n >= 0 ? { quota: n } : {},
    );
  } catch {
    // The code went out; the count is a guard, not a gate.
  }
}

export async function chargeAuthMail(ctx: ChargeCtx | undefined, email: string): Promise<void> {
  if (typeof ctx?.runMutation !== "function") {
    throw new ConvexError("We couldn't send your code right now. Please try again in a moment.");
  }
  const verdict = await ctx.runMutation(internal.authMail.charge, { email });
  if (verdict === "ok") return;
  throw new ConvexError(verdict === "site" ? AUTH_MAIL_SITE_BUSY : AUTH_MAIL_REFUSED);
}
