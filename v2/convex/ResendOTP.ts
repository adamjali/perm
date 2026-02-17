import { Email } from "@convex-dev/auth/providers/Email";
import { Resend as ResendAPI } from "resend";
import { generateSecureOTP } from "./lib/crypto";

export const ResendOTP = Email({
  id: "resend-otp",
  async generateVerificationToken() {
    // 12-char alphanumeric: 30^12 = 5.3 * 10^17 combinations (vs 10^8 for 8-digit)
    return generateSecureOTP();
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const resend = new ResendAPI(process.env.AUTH_RESEND_KEY!);
    const { error } = await resend.emails.send({
      from: "PERM Tracker <noreply@permtracker.app>",
      to: [email],
      subject: "Verify your email",
      html: `<p>Your verification code is: <strong>${token}</strong></p>
             <p>This code expires in 10 minutes.</p>`,
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
