// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@react-email/render";

import { VerificationCode } from "../VerificationCode";
import { PasswordResetCode } from "../PasswordResetCode";
import { ResendOTP } from "@convex/ResendOTP";
import { ResendPasswordReset } from "@convex/ResendPasswordReset";
import { AUTH_CODE_MAX_AGE_S } from "@convex/lib/authCodeTtl";

/**
 * A sign-in or reset code lasts as long as its email says (Nov 4 2026).
 *
 * Both emails say "This code expires in 10 minutes", and until this test the providers set no `maxAge`, so
 * @convex-dev/auth's Email() default of an hour applied: a code kept working 50 minutes after the email said it
 * had stopped. The library reads the provider's options over its own defaults (provider_utils.js
 * `merge(provider, provider.options)`), which is what `effective` mirrors.
 */
function effective(provider: { maxAge?: number; options?: unknown }): number | undefined {
  const options = (provider.options ?? {}) as { maxAge?: number };
  return options.maxAge ?? provider.maxAge;
}

describe("sign-in and reset codes expire when their emails say", () => {
  it("is ten minutes", () => {
    expect(AUTH_CODE_MAX_AGE_S).toBe(10 * 60);
  });

  it.each([
    ["the sign-in code", ResendOTP],
    ["the password reset code", ResendPasswordReset],
  ])("%s lasts AUTH_CODE_MAX_AGE_S, not the library's hour", (_label, provider) => {
    expect(effective(provider as { maxAge?: number; options?: unknown })).toBe(AUTH_CODE_MAX_AGE_S);
  });

  it.each([
    ["VerificationCode", () => VerificationCode({ code: "ABCDEFGHJKLM" })],
    ["PasswordResetCode", () => PasswordResetCode({ code: "ABCDEFGHJKLM" })],
  ])("%s tells the reader the same number of minutes", async (_label, build) => {
    const html = await render(build());
    const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    expect(text).toContain(`expires in ${AUTH_CODE_MAX_AGE_S / 60} minutes`);
  });
});
