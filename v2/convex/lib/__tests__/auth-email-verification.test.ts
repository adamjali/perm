import { describe, it, expect } from "vitest";
import { createTestContext } from "../../../test-utils/convex";
import { isEmailVerified, getVerifiedUserIds } from "../auth";

describe("isEmailVerified", () => {
  it("returns true for Google OAuth user", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "google",
        providerAccountId: "google-123",
      });
      expect(await isEmailVerified(ctx, userId)).toBe(true);
    });
  });

  it("returns true for password user with emailVerified", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: "test@example.com",
        emailVerified: "test@example.com",
      });
      expect(await isEmailVerified(ctx, userId)).toBe(true);
    });
  });

  it("returns false for password user without emailVerified", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: "unverified@example.com",
      });
      expect(await isEmailVerified(ctx, userId)).toBe(false);
    });
  });

  it("returns false for user with no authAccounts", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      expect(await isEmailVerified(ctx, userId)).toBe(false);
    });
  });

  it("returns true when any account is verified (Google + unverified password)", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      // Unverified password account
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: "multi@example.com",
      });
      // Google account (always verified)
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "google",
        providerAccountId: "google-multi",
      });
      expect(await isEmailVerified(ctx, userId)).toBe(true);
    });
  });

  it("returns false for empty string emailVerified", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {});
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: "empty@example.com",
        emailVerified: "",
      });
      expect(await isEmailVerified(ctx, userId)).toBe(false);
    });
  });
});

describe("getVerifiedUserIds", () => {
  it("returns empty Set when no authAccounts exist", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const result = await getVerifiedUserIds(ctx);
      expect(result.size).toBe(0);
    });
  });

  it("returns correct Set for mixed verified/unverified users", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const verifiedUser = await ctx.db.insert("users", { email: "v@example.com" });
      const unverifiedUser = await ctx.db.insert("users", { email: "u@example.com" });
      const googleUser = await ctx.db.insert("users", { email: "g@example.com" });

      // Verified password account
      await ctx.db.insert("authAccounts", {
        userId: verifiedUser,
        provider: "password",
        providerAccountId: "v@example.com",
        emailVerified: "v@example.com",
      });
      // Unverified password account
      await ctx.db.insert("authAccounts", {
        userId: unverifiedUser,
        provider: "password",
        providerAccountId: "u@example.com",
      });
      // Google account
      await ctx.db.insert("authAccounts", {
        userId: googleUser,
        provider: "google",
        providerAccountId: "google-g",
      });

      const result = await getVerifiedUserIds(ctx);
      expect(result.size).toBe(2);
      expect(result.has(verifiedUser)).toBe(true);
      expect(result.has(googleUser)).toBe(true);
      expect(result.has(unverifiedUser)).toBe(false);
    });
  });

  it("handles multiple accounts for same user without duplicates", async () => {
    const t = createTestContext();
    await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "multi@example.com" });

      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: "multi@example.com",
        emailVerified: "multi@example.com",
      });
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "google",
        providerAccountId: "google-multi",
      });

      const result = await getVerifiedUserIds(ctx);
      expect(result.size).toBe(1);
      expect(result.has(userId)).toBe(true);
    });
  });
});
