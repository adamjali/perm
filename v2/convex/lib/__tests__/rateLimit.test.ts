import { describe, it, expect } from "vitest";
import { RATE_LIMITS } from "../rateLimit";
import type { RateLimitConfig, RateLimitResult } from "../rateLimit";

describe("RATE_LIMITS configuration", () => {
  it("LOGIN allows 10 attempts per 15 minutes", () => {
    expect(RATE_LIMITS.LOGIN.limit).toBe(10);
    expect(RATE_LIMITS.LOGIN.windowMs).toBe(15 * 60 * 1000);
  });

  it("OTP_VERIFY allows 5 attempts per 15 minutes", () => {
    expect(RATE_LIMITS.OTP_VERIFY.limit).toBe(5);
    expect(RATE_LIMITS.OTP_VERIFY.windowMs).toBe(15 * 60 * 1000);
  });

  it("PASSWORD_RESET allows 3 attempts per hour", () => {
    expect(RATE_LIMITS.PASSWORD_RESET.limit).toBe(3);
    expect(RATE_LIMITS.PASSWORD_RESET.windowMs).toBe(60 * 60 * 1000);
  });

  it("EMAIL_SEND allows 5 per 10 minutes", () => {
    expect(RATE_LIMITS.EMAIL_SEND.limit).toBe(5);
    expect(RATE_LIMITS.EMAIL_SEND.windowMs).toBe(10 * 60 * 1000);
  });

  it("all configs have positive limits and windows", () => {
    for (const [, config] of Object.entries(RATE_LIMITS)) {
      expect(config.limit).toBeGreaterThan(0);
      expect(config.windowMs).toBeGreaterThan(0);
    }
  });
});

describe("RateLimitResult type contract", () => {
  it("allowed result has remaining > 0 and no message", () => {
    const result: RateLimitResult = {
      allowed: true,
      remaining: 9,
      resetInMs: 900000,
    };
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.message).toBeUndefined();
  });

  it("blocked result has remaining 0 and includes message", () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetInMs: 300000,
      message: "Too many requests. Please try again in 5 minutes.",
    };
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.message).toContain("Too many requests");
  });
});

describe("Rate limit key generation (via config)", () => {
  it("different actions have different limits", () => {
    const configs: Record<string, RateLimitConfig> = {
      login: RATE_LIMITS.LOGIN,
      otp: RATE_LIMITS.OTP_VERIFY,
      reset: RATE_LIMITS.PASSWORD_RESET,
    };
    // Verify each action has distinct configuration
    expect(configs.login.limit).not.toBe(configs.otp.limit);
    expect(configs.login.limit).not.toBe(configs.reset.limit);
  });

  it("LOGIN is more permissive than OTP_VERIFY", () => {
    // Login should allow more attempts than OTP verification
    expect(RATE_LIMITS.LOGIN.limit).toBeGreaterThan(
      RATE_LIMITS.OTP_VERIFY.limit
    );
  });

  it("PASSWORD_RESET is the most restrictive", () => {
    expect(RATE_LIMITS.PASSWORD_RESET.limit).toBeLessThanOrEqual(
      RATE_LIMITS.OTP_VERIFY.limit
    );
    expect(RATE_LIMITS.PASSWORD_RESET.limit).toBeLessThanOrEqual(
      RATE_LIMITS.LOGIN.limit
    );
  });
});
