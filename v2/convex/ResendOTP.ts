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
      throw new Error(`Failed to send email: ${error.message}`);
    }
  },
});
