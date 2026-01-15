/**
 * Google OAuth Utilities Tests
 *
 * Tests for OAuth state encoding/decoding and client configuration.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  encodeState,
  decodeState,
  getOAuthClient,
  CALENDAR_SCOPE,
  type StatePayload,
} from "../oauth";

// ============================================================================
// State Encoding/Decoding Tests
// ============================================================================

describe("encodeState", () => {
  it("creates a base64url encoded string", () => {
    const state = encodeState("user-123", [CALENDAR_SCOPE]);
    expect(typeof state).toBe("string");
    // Base64url should not contain + / or =
    expect(state).not.toMatch(/[+/=]/);
  });

  it("includes userId and scopes in encoded state", () => {
    const state = encodeState("user-123", [CALENDAR_SCOPE]);
    const decoded = decodeState(state);

    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe("user-123");
    expect(decoded?.scopes).toContain(CALENDAR_SCOPE);
  });

  it("generates unique nonce for each call", () => {
    const state1 = encodeState("user-123", [CALENDAR_SCOPE]);
    const state2 = encodeState("user-123", [CALENDAR_SCOPE]);

    const decoded1 = decodeState(state1);
    const decoded2 = decodeState(state2);

    expect(decoded1?.nonce).not.toBe(decoded2?.nonce);
  });
});

describe("decodeState", () => {
  it("decodes valid state string", () => {
    const original: StatePayload = {
      userId: "user-456",
      scopes: [CALENDAR_SCOPE, "another-scope"],
      nonce: "test-nonce-123",
    };
    const encoded = Buffer.from(JSON.stringify(original)).toString("base64url");

    const decoded = decodeState(encoded);

    expect(decoded).toEqual(original);
  });

  it("returns null for invalid base64", () => {
    const result = decodeState("not-valid-base64!!!");
    expect(result).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    const encoded = Buffer.from("not json").toString("base64url");
    const result = decodeState(encoded);
    expect(result).toBeNull();
  });

  it("returns null when userId is missing", () => {
    const payload = { scopes: [CALENDAR_SCOPE], nonce: "test" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

    const result = decodeState(encoded);
    expect(result).toBeNull();
  });

  it("returns null when scopes is missing", () => {
    const payload = { userId: "user-123", nonce: "test" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

    const result = decodeState(encoded);
    expect(result).toBeNull();
  });

  it("returns null when nonce is missing", () => {
    const payload = { userId: "user-123", scopes: [CALENDAR_SCOPE] };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

    const result = decodeState(encoded);
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    const result = decodeState("");
    expect(result).toBeNull();
  });
});

// ============================================================================
// OAuth Client Configuration Tests
// ============================================================================

describe("getOAuthClient", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws error when GOOGLE_CALENDAR_CLIENT_ID is missing", () => {
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "test-secret";

    expect(() => getOAuthClient()).toThrow("Google OAuth credentials not configured");
  });

  it("throws error when GOOGLE_CALENDAR_CLIENT_SECRET is missing", () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "test-client-id";
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;

    expect(() => getOAuthClient()).toThrow("Google OAuth credentials not configured");
  });

  it("creates client when credentials are configured", () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

    const client = getOAuthClient();

    expect(client).toBeDefined();
    // Check internal config via _clientId (available on OAuth2Client)
    expect((client as unknown as { _clientId: string })._clientId).toBe("test-client-id");
  });

  it("uses localhost as default redirect when NEXT_PUBLIC_APP_URL not set", () => {
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "test-secret";
    delete process.env.NEXT_PUBLIC_APP_URL;

    const client = getOAuthClient();

    // Get redirect URI from internal config
    const redirectUri = (client as unknown as { redirectUri?: string }).redirectUri;
    expect(redirectUri).toContain("localhost:3000");
  });
});

// ============================================================================
// Constant Tests
// ============================================================================

describe("CALENDAR_SCOPE", () => {
  it("is the correct Google Calendar events scope", () => {
    expect(CALENDAR_SCOPE).toBe("https://www.googleapis.com/auth/calendar.events");
  });
});
