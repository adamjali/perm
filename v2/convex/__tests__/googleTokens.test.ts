import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestContext, createAuthenticatedContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { buildDefaultProfile } from "../lib/userDefaults";
import { decryptToken, isEncryptedToken } from "../lib/crypto";

const TEST_KEY = "a".repeat(64);
const TOKENS = {
  accessToken: "access-123",
  refreshToken: "refresh-456",
  expiryTime: 1_900_000_000_000,
  email: "owner@example.com",
  scopes: ["https://www.googleapis.com/auth/calendar.events"],
};

/**
 * The signed-in user's token store and the post-refresh one write the same
 * thing: both tokens encrypted, the expiry, email and scopes, and the
 * calendar marked connected.
 */
describe("storing Google tokens", () => {
  beforeEach(() => vi.stubEnv("OAUTH_ENCRYPTION_KEY", TEST_KEY));
  afterEach(() => vi.unstubAllEnvs());

  async function stored(t: ReturnType<typeof createTestContext>, userId: Id<"users">) {
    const profile = await t.run((ctx) =>
      ctx.db.query("userProfiles").withIndex("by_user_id", (q) => q.eq("userId", userId)).unique(),
    );
    expect(isEncryptedToken(profile!.googleAccessToken!)).toBe(true);
    expect(isEncryptedToken(profile!.googleRefreshToken!)).toBe(true);
    return {
      accessToken: await decryptToken(profile!.googleAccessToken!),
      refreshToken: await decryptToken(profile!.googleRefreshToken!),
      expiryTime: profile!.googleTokenExpiry,
      email: profile!.googleEmail,
      scopes: profile!.googleScopes,
      connected: profile!.googleCalendarConnected,
    };
  }

  it("storeGoogleTokens writes the signed-in user's tokens", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t);
    await t.run((ctx) => ctx.db.insert("userProfiles", buildDefaultProfile(user.userId)));

    expect(await user.mutation(api.googleAuth.storeGoogleTokens, TOKENS)).toEqual({ success: true });
    expect(await stored(t, user.userId)).toEqual({ ...TOKENS, connected: true });
  });

  it("storeGoogleTokensInternal writes the named user's tokens", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t);
    await t.run((ctx) => ctx.db.insert("userProfiles", buildDefaultProfile(user.userId)));

    expect(
      await t.mutation(internal.googleAuth.storeGoogleTokensInternal, { userId: user.userId, ...TOKENS }),
    ).toEqual({ success: true });
    expect(await stored(t, user.userId)).toEqual({ ...TOKENS, connected: true });
  });

  it("both refuse a user with no profile", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t);
    await expect(user.mutation(api.googleAuth.storeGoogleTokens, TOKENS)).rejects.toThrow("User profile not found");
    await expect(
      t.mutation(internal.googleAuth.storeGoogleTokensInternal, { userId: user.userId, ...TOKENS }),
    ).rejects.toThrow("User profile not found");
  });
});
