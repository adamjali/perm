import { describe, expect, it } from "vitest";

import {
  blockedResponseMessage,
  isBlockedResponseError,
  isExistingAccountError,
  isInvalidCodeError,
  isMaskedServerError,
  isRateLimitError,
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

  it("reads a masked error at sign-up as an existing account, the one plain error the form can't rule out", () => {
    // Convex Auth throws a plain "Account <email> already exists" (createAccountFromCredentials), which production
    // hides behind the mask. The form checks every other input before it submits.
    expect(isExistingAccountError(MASKED)).toBe(true);
    expect(isExistingAccountError("Account someone@example.com already exists")).toBe(true);
    expect(isExistingAccountError("duplicate account")).toBe(true);
    expect(isExistingAccountError(CHALLENGE_PAGE)).toBe(false);
    expect(isExistingAccountError("Network error")).toBe(false);
  });
});
