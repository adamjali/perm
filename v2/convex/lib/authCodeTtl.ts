/**
 * How long a sign-in or password-reset code works, in seconds.
 *
 * Both emails tell the reader "This code expires in 10 minutes" (src/emails/VerificationCode.tsx and
 * PasswordResetCode.tsx). @convex-dev/auth's Email() provider defaults to an hour, and until Nov 4 2026 neither
 * provider set its own, so a code kept working 50 minutes after its email said it had stopped. One constant, read
 * by both providers (convex/ResendOTP.ts, convex/ResendPasswordReset.ts); src/emails/__tests__/authCodeExpiry.test.tsx
 * holds the emails' wording to it.
 */
export const AUTH_CODE_MAX_AGE_S = 10 * 60;
