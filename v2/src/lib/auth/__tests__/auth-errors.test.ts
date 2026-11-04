import { describe, expect, it } from "vitest";

import {
  blockedResponseMessage,
  isBlockedResponseError,
  isInvalidCodeError,
  isMaskedServerError,
  isRateLimitError,
  SIGNUP_REFUSED_TEXT,
  signupRefusal,
} from "../auth-errors";

// Real messages from Sentry, verbatim.
const CHALLENGE_PAGE = `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`; // 4G
const RATE_LIMIT_PAGE = `Unexpected token 'T', "Too Many R"... is not valid JSON`; // 4A
const SAFARI_PARSE = "The string did not match the expected pattern."; // 4D
const MASKED = "[Request ID: 51c34f59011c0f6b] Server Error"; // 2Q

describe("auth error classification", () => {
  it("recognises a non-JSON reply from the auth proxy in every browser's wording", () => {
    for (const m of [CHALLENGE_PAGE, RATE_LIMIT_PAGE, SAFARI_PARSE]) {
      expect(isBlockedResponseError(m)).toBe(true);
    }
    expect(isBlockedResponseError(MASKED)).toBe(false);
    expect(isBlockedResponseError("Invalid verification code")).toBe(false);
  });

  it("a rate-limit PAGE is also a rate-limit match, which is why blocked is checked first", () => {
    expect(isRateLimitError(RATE_LIMIT_PAGE)).toBe(true);
    expect(blockedResponseMessage(RATE_LIMIT_PAGE)).toMatch(/Too many attempts/);
    expect(blockedResponseMessage(CHALLENGE_PAGE)).toMatch(/security check/);
  });

  it("recognises Convex's production mask and nothing else", () => {
    expect(isMaskedServerError(MASKED)).toBe(true);
    expect(isMaskedServerError("[CONVEX M(onboarding:saveOnboardingRole)] [Request ID: 7594daf6051167ad] Server Error")).toBe(true);
    expect(isMaskedServerError("Internal Server Error page")).toBe(false);
    // The masked message carries no code wording, so the invalid-code check can't see it.
    expect(isInvalidCodeError(MASKED)).toBe(false);
  });

  it("reads a masked error or an existing account at sign-up as one refusal, without saying which", () => {
    // Convex Auth throws a plain "Account <email> already exists" (createAccountFromCredentials), which production
    // hides behind the mask, and the mask hides every other server failure the same way. The two can't be told
    // apart, and saying "already has an account" would tell a stranger which addresses hold one (Nov 4 2026).
    expect(signupRefusal(MASKED)).toBe("masked");
    expect(signupRefusal("Account someone@example.com already exists")).toBe("exists");
    expect(signupRefusal("duplicate account")).toBe("exists");
    expect(signupRefusal(CHALLENGE_PAGE)).toBeNull();
    expect(signupRefusal("Network error")).toBeNull();
    expect(signupRefusal("Too many attempts. Try again in 10 minutes.")).toBeNull();
  });

  it("words the refusal so it says nothing about whether the address has an account", () => {
    expect(SIGNUP_REFUSED_TEXT).toBe("We couldn't create that account. If you already have one,");
    expect(SIGNUP_REFUSED_TEXT).not.toMatch(/already has an account|exists/i);
  });
});
