import { Email } from "@convex-dev/auth/providers/Email";
import { ConvexError } from "convex/values";
import { Resend as ResendAPI } from "resend";
import { render } from "@react-email/render";
import { generateSecureOTP } from "./lib/crypto";
import { isEmailBlocked } from "./lib/emailBlocklist";
import { recordError } from "./lib/errorRecording";
import { VerificationCode } from "../src/emails/VerificationCode";

// At runtime @convex-dev/auth passes the Convex action ctx as a 2nd arg to the
// email provider's sendVerificationRequest (see node_modules/@convex-dev/auth/
// dist/server/implementation/signIn.js — it does so under its own
// `@ts-expect-error` because the @auth/core EmailConfig type only declares a
// single param). We mirror that here: the params object is typed by the library;
// `ctx` only needs `scheduler.runAfter` for recordError, so we type the minimum.
type SendCtx = { scheduler: { runAfter: (delay: number, fn: unknown, args: unknown) => Promise<unknown> } };

export const ResendOTP = Email({
  id: "resend-otp",
  async generateVerificationToken() {
    // 12-char alphanumeric: 30^12 = 5.3 * 10^17 combinations (vs 10^8 for 8-digit)
    return generateSecureOTP();
  },
  async sendVerificationRequest(
    { identifier: email, token }: { identifier: string; token: string },
    ctx?: SendCtx,
  ) {
    // Blocklist guard — these emails must never receive anything from us.
    // Silently skip (silent-by-design) so the auth flow completes for recipients
    // we intentionally never email.
    if (isEmailBlocked(email)) {
      console.warn(`[ResendOTP] Skipping: blocklisted recipient ${email}`);
      return;
    }

    const resend = new ResendAPI(process.env.AUTH_RESEND_KEY!);

    const html = await render(VerificationCode({ code: token }));

    const { error } = await resend.emails.send({
      from: "PERM Tracker <noreply@permtracker.app>",
      to: [email],
      subject: "PERM Tracker: Your verification code",
      html,
    });
    if (error) {
      // The verification token is already stored in the DB, but the email never
      // left. Swallowing here would strand the user on the code-entry screen
      // waiting for a code that will never arrive. Instead: record to the error
      // pipeline (DB + admin email + Sentry) AND throw a ConvexError so the auth
      // UI shows a real error instead of silently advancing. ConvexError's
      // message survives Convex's plain-Error redaction, so the client sees a
      // meaningful message rather than an opaque "Server Error".
      console.error(`[ResendOTP] Failed to send verification email to ${email}:`, error.message);
      if (ctx) await recordError(ctx, "action", "ResendOTP.send", error);
      throw new ConvexError(
        "We couldn't send your verification code right now. Please try again in a moment.",
      );
    }
  },
});
