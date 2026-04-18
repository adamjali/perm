import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { render } from "@react-email/render";
import { generateSecureOTP } from "./lib/crypto";
import { isEmailBlocked } from "./lib/emailBlocklist";
import { VerificationCode } from "../src/emails/VerificationCode";

export const ResendOTP = Email({
  id: "resend-otp",
  async generateVerificationToken() {
    // 12-char alphanumeric: 30^12 = 5.3 * 10^17 combinations (vs 10^8 for 8-digit)
    return generateSecureOTP();
  },
  async sendVerificationRequest({ identifier: email, token }) {
    // Blocklist guard — these emails must never receive anything from us.
    // Silently skip so auth flow completes (matches the existing error-swallowing pattern).
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
      // Log but don't throw — the verification token is already stored in the DB.
      // Throwing here crashes the entire auth:signIn action and surfaces as an
      // opaque "Server Error" to the client (Convex redacts plain Error messages).
      // By not throwing, the auth flow completes normally and the client transitions
      // to the verification step. The user can retry sign-in to resend the code.
      console.error(`[ResendOTP] Failed to send verification email to ${email}:`, error.message);
    }
  },
});
