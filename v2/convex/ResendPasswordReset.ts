import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { render } from "@react-email/render";
import { generateSecureOTP } from "./lib/crypto";
import { isEmailBlocked } from "./lib/emailBlocklist";
import { PasswordResetCode } from "../src/emails/PasswordResetCode";

export const ResendPasswordReset = Email({
  id: "resend-password-reset",
  async generateVerificationToken() {
    // 12-char alphanumeric: 30^12 = 5.3 * 10^17 combinations (vs 10^8 for 8-digit)
    return generateSecureOTP();
  },
  async sendVerificationRequest({ identifier: email, token }) {
    // Blocklist guard — same as ResendOTP.
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
      // Log but don't throw — same rationale as ResendOTP.
      // The auth flow should complete so the user sees the code entry form.
      // They can retry to resend. Throwing here causes opaque "Server Error".
      console.error(`[ResendPasswordReset] Failed to send reset email to ${email}:`, error.message);
    }
  },
});
