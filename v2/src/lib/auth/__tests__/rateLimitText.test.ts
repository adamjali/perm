import { describe, it, expect } from "vitest";
import { authRateLimitText } from "../rateLimitText";
import { AUTH_MAIL_REFUSED, AUTH_MAIL_SITE_BUSY } from "@convex/lib/authMailGate";

describe("authRateLimitText (silent-limit audit #63)", () => {
  it("shows the server's own wait for the address limit", () => {
    const wrapped = `[CONVEX A(auth:signIn)] [Request ID: x] Server Error Uncaught ConvexError: ${AUTH_MAIL_REFUSED} Called by client`;
    expect(authRateLimitText(wrapped)).toBe(AUTH_MAIL_REFUSED);
  });
  it("shows the server's own wait for the site-wide limit", () => {
    expect(authRateLimitText(`Uncaught ConvexError: ${AUTH_MAIL_SITE_BUSY}`)).toBe(AUTH_MAIL_SITE_BUSY);
  });
  it("names the failed-attempt refill", () => {
    expect(authRateLimitText("TooManyFailedAttempts")).toMatch(/6 minutes/);
  });
  it("never says 'a moment'", () => {
    expect(authRateLimitText("rate limit")).not.toMatch(/moment/);
  });
});
