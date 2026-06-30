import { describe, it, expect } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * sendTestEmail is gated to the caller's OWN verified address (so an authed user
 * can't send branded mail to arbitrary recipients). These lock the gate query.
 */
describe("isOwnVerifiedEmail — sendTestEmail recipient gate", () => {
  async function makeVerifiedUser(
    t: ReturnType<typeof createTestContext>,
    email: string,
    verified = true
  ) {
    return await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email });
      await ctx.db.insert("authAccounts", {
        userId,
        provider: "password",
        providerAccountId: email,
        ...(verified ? { emailVerified: email } : {}),
      });
      return userId as Id<"users">;
    });
  }

  it("allows the caller's own verified email", async () => {
    const t = createTestContext();
    const userId = await makeVerifiedUser(t, "owner@example.com");
    expect(
      await t.query(internal.notifications.isOwnVerifiedEmail, { userId, email: "owner@example.com" })
    ).toBe(true);
  });

  it("rejects an email that is NOT the caller's own", async () => {
    const t = createTestContext();
    const userId = await makeVerifiedUser(t, "owner@example.com");
    await makeVerifiedUser(t, "victim@example.com");
    expect(
      await t.query(internal.notifications.isOwnVerifiedEmail, { userId, email: "victim@example.com" })
    ).toBe(false);
  });

  it("rejects an unverified caller's own email", async () => {
    const t = createTestContext();
    const userId = await makeVerifiedUser(t, "unverified@example.com", false);
    expect(
      await t.query(internal.notifications.isOwnVerifiedEmail, { userId, email: "unverified@example.com" })
    ).toBe(false);
  });
});
