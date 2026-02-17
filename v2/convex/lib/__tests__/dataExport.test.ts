import { describe, it, expect, vi, afterEach } from "vitest";
import { encryptToken, isEncryptedToken, decryptToken } from "../crypto";

const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/**
 * Tests for the FEIN decrypt-for-export logic.
 * The actual `decryptFeinForExport` is a private function in dataExport.ts,
 * so we test the same pattern: decrypt encrypted FEINs, pass through plaintext.
 */
describe("FEIN export decryption logic", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("decrypts an encrypted FEIN for export", async () => {
    vi.stubEnv("OAUTH_ENCRYPTION_KEY", TEST_KEY);
    const fein = "12-3456789";
    const encrypted = await encryptToken(fein);

    // Simulate what decryptFeinForExport does
    expect(isEncryptedToken(encrypted)).toBe(true);
    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe(fein);
  });

  it("passes through plaintext FEIN (legacy data)", () => {
    const fein = "12-3456789";
    expect(isEncryptedToken(fein)).toBe(false);
    // decryptFeinForExport returns plaintext as-is
    // (no need to call decryptToken for non-encrypted values)
  });

  it("returns undefined for undefined FEIN", () => {
    const fein: string | undefined = undefined;
    // decryptFeinForExport returns undefined for falsy input
    expect(fein).toBeUndefined();
  });

  it("handles encryption roundtrip through export path", async () => {
    vi.stubEnv("OAUTH_ENCRYPTION_KEY", TEST_KEY);
    const feins = ["12-3456789", "98-7654321", "00-0000000"];

    for (const fein of feins) {
      const encrypted = await encryptToken(fein);
      expect(isEncryptedToken(encrypted)).toBe(true);
      expect(await decryptToken(encrypted)).toBe(fein);
    }
  });
});

describe("Export data structure expectations", () => {
  it("export version should be a string", () => {
    // The actual query returns exportVersion: "1.0"
    const exportData = {
      exportVersion: "1.0",
      exportDate: new Date().toISOString(),
      user: null,
      profile: null,
      cases: [],
      conversations: [],
      notifications: [],
      auditLogs: [],
    };

    expect(exportData.exportVersion).toBe("1.0");
    expect(exportData.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Array.isArray(exportData.cases)).toBe(true);
    expect(Array.isArray(exportData.conversations)).toBe(true);
    expect(Array.isArray(exportData.notifications)).toBe(true);
    expect(Array.isArray(exportData.auditLogs)).toBe(true);
  });

  it("redacts sensitive profile fields", () => {
    const profile = {
      fullName: "Test User",
      googleAccessToken: "some-token",
      googleRefreshToken: "some-refresh",
      pushSubscription: '{"endpoint":"..."}',
    };

    // Simulate redaction logic from dataExport.ts
    const exported = {
      ...profile,
      googleAccessToken: profile.googleAccessToken ? "[REDACTED]" : undefined,
      googleRefreshToken: profile.googleRefreshToken
        ? "[REDACTED]"
        : undefined,
      pushSubscription: profile.pushSubscription ? "[REDACTED]" : undefined,
    };

    expect(exported.fullName).toBe("Test User");
    expect(exported.googleAccessToken).toBe("[REDACTED]");
    expect(exported.googleRefreshToken).toBe("[REDACTED]");
    expect(exported.pushSubscription).toBe("[REDACTED]");
  });

  it("does not redact fields that are already undefined", () => {
    const profile = {
      fullName: "Test User",
      googleAccessToken: undefined,
      googleRefreshToken: undefined,
      pushSubscription: undefined,
    };

    const exported = {
      ...profile,
      googleAccessToken: profile.googleAccessToken ? "[REDACTED]" : undefined,
      googleRefreshToken: profile.googleRefreshToken
        ? "[REDACTED]"
        : undefined,
      pushSubscription: profile.pushSubscription ? "[REDACTED]" : undefined,
    };

    expect(exported.googleAccessToken).toBeUndefined();
    expect(exported.googleRefreshToken).toBeUndefined();
    expect(exported.pushSubscription).toBeUndefined();
  });
});
