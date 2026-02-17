import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { encryptToken, decryptToken, isEncryptedToken } from "../crypto";

// Test encryption key: 32 random bytes hex-encoded (64 chars)
const TEST_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("FEIN / Token Encryption (AES-256-GCM)", () => {
  beforeEach(() => {
    vi.stubEnv("OAUTH_ENCRYPTION_KEY", TEST_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts and decrypts a FEIN successfully", async () => {
    const fein = "12-3456789";
    const encrypted = await encryptToken(fein);
    expect(encrypted).not.toBe(fein);
    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe(fein);
  });

  it("produces different ciphertext for same plaintext (random IV)", async () => {
    const fein = "98-7654321";
    const encrypted1 = await encryptToken(fein);
    const encrypted2 = await encryptToken(fein);
    expect(encrypted1).not.toBe(encrypted2);
    // Both decrypt to same value
    expect(await decryptToken(encrypted1)).toBe(fein);
    expect(await decryptToken(encrypted2)).toBe(fein);
  });

  it("handles empty string", async () => {
    const encrypted = await encryptToken("");
    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe("");
  });

  it("handles long strings", async () => {
    const longValue = "a".repeat(1000);
    const encrypted = await encryptToken(longValue);
    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe(longValue);
  });

  it("handles special characters in FEIN", async () => {
    const fein = "12-345/6789 (test)";
    const encrypted = await encryptToken(fein);
    const decrypted = await decryptToken(encrypted);
    expect(decrypted).toBe(fein);
  });

  it("throws when encryption key is missing", async () => {
    vi.stubEnv("OAUTH_ENCRYPTION_KEY", "");
    await expect(encryptToken("test")).rejects.toThrow();
  });

  it("throws when encryption key is wrong length", async () => {
    vi.stubEnv("OAUTH_ENCRYPTION_KEY", "tooshort");
    await expect(encryptToken("test")).rejects.toThrow(
      "OAUTH_ENCRYPTION_KEY must be 64 hex characters"
    );
  });

  it("fails to decrypt with wrong key", async () => {
    const encrypted = await encryptToken("12-3456789");
    // Change to a different valid key
    vi.stubEnv(
      "OAUTH_ENCRYPTION_KEY",
      "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210"
    );
    await expect(decryptToken(encrypted)).rejects.toThrow();
  });
});

describe("isEncryptedToken", () => {
  it("returns true for encrypted tokens", async () => {
    vi.stubEnv("OAUTH_ENCRYPTION_KEY", TEST_KEY);
    const encrypted = await encryptToken("12-3456789");
    expect(isEncryptedToken(encrypted)).toBe(true);
    vi.unstubAllEnvs();
  });

  it("returns false for plaintext FEIN", () => {
    expect(isEncryptedToken("12-3456789")).toBe(false);
  });

  it("returns false for short base64 strings", () => {
    // Base64 of less than 12 bytes
    expect(isEncryptedToken(btoa("short"))).toBe(false);
  });

  it("returns false for non-base64 strings", () => {
    expect(isEncryptedToken("not-base64!@#$")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEncryptedToken("")).toBe(false);
  });
});
