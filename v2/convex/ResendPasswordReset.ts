import { Email } from "@convex-dev/auth/providers/Email";
import { ConvexError } from "convex/values";
import { Resend as ResendAPI } from "resend";
import { render } from "@react-email/render";
import { generateSecureOTP } from "./lib/crypto";
import { isEmailBlocked } from "./lib/emailBlocklist";
import { recordError } from "./lib/errorRecording";
import { PasswordResetCode } from "../src/emails/PasswordResetCode";

// See ResendOTP.ts: @convex-dev/auth passes the Convex action ctx as a 2nd arg
// at runtime under its own @ts-expect-error (the @auth/core EmailConfig type
// only declares one param). We type the minimum ctx surface recordError needs.
type SendCtx = { scheduler: { runAfter: (delay: number, fn: unknown, args: unknown) => Promise<unknown> } };

export const ResendPasswordReset = Email({
  id: "resend-password-reset",
  async generateVerificationToken() {
    // 12-char alphanumeric: 30^12 = 5.3 * 10^17 combinations (vs 10^8 for 8-digit)
    return generateSecureOTP();
  },
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    ctx?: SendCtx,
  ) {
    // Blocklist guard — silent-by-design, same as ResendOTP.
    if (isEmailBlocked(email)) {
      console.warn(`[ResendPasswordReset] Skipping: blocklisted recipient ${email}`);
      return;
    }

    const resend = new ResendAPI(process.env.AUTH_RESEND_KEY!);

    const html = await render(PasswordResetCode({ code: token }));

    const { error } = await resend.emails.send({
      from: "PERM Tracker <noreply@permtracker.app>",
      to: [email],
      subject: "PERM Tracker: Password reset code",
      html,
    });
    if (error) {
      // Same rationale as ResendOTP: record to the error pipeline AND throw a
      // ConvexError so the reset UI surfaces a real failure instead of silently
      // advancing to the code-entry form for a code that never sent.
      console.error(`[ResendPasswordReset] Failed to send reset email to ${email}:`, error.message);
      if (ctx) await recordError(ctx, "action", "ResendPasswordReset.send", error);
      throw new ConvexError(
        "We couldn't send your password reset code right now. Please try again in a moment.",
      );
    }
  },
});
