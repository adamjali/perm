/**
 * @fileoverview Tests for Convex user functions
 * @see v2/convex/users.ts
 *
 * Tests cover:
 * - User profile CRUD operations
 * - Push subscription management
 * - Account deletion (requestAccountDeletion, cancelAccountDeletion)
 */

import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
  finishScheduledFunctions,
} from "../test-utils/convex";
import { api } from "./_generated/api";

// ============================================================================
// USER PROFILE TESTS
// ============================================================================

describe("User Profile", () => {
  setupSchedulerTests();

  describe("ensureUserProfile", () => {
    it("creates a new profile for authenticated user", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      const profileId = await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      expect(profileId).toBeDefined();

      // Verify profile exists
      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile).toBeDefined();
      expect(profile?.emailNotificationsEnabled).toBe(true);
    });

    it("returns existing profile id if profile already exists", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      // Create profile first time
      const profileId1 = await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      // Call again - should return same id
      const profileId2 = await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      expect(profileId1).toBe(profileId2);
    });

    it("rejects unauthenticated users", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.users.ensureUserProfile, {})
      ).rejects.toThrow();
    });

    it("copies name from users table to fullName in profile", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "John Doe");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      // Verify fullName was copied from user.name
      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile?.fullName).toBe("John Doe");
    });

    it("copies image from users table to profilePhotoUrl in profile", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      // Set image on the user (simulating Google OAuth)
      const user = await authT.query(api.users.currentUser, {});
      await authT.run(async (ctx) => {
        await ctx.db.patch(user!._id, {
          image: "https://lh3.googleusercontent.com/test-photo.jpg",
        });
      });

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      // Verify profilePhotoUrl was copied from user.image
      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile?.profilePhotoUrl).toBe(
        "https://lh3.googleusercontent.com/test-photo.jpg"
      );
    });
  });

  describe("updateUserProfile", () => {
    it("updates profile fields", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      // Create profile
      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      // Update profile
      await authT.mutation(api.users.updateUserProfile, {
        emailNotificationsEnabled: false,
      });
      await finishScheduledFunctions(t);

      // Verify updates
      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile?.emailNotificationsEnabled).toBe(false);
    });

    it("rejects unauthenticated users", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.users.updateUserProfile, { emailNotificationsEnabled: true })
      ).rejects.toThrow();
    });

    it("auto-creates profile if it does not exist (upsert)", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");
      // Don't create profile first - updateUserProfile should auto-create

      await authT.mutation(api.users.updateUserProfile, {
        emailNotificationsEnabled: false,
      });
      await finishScheduledFunctions(t);

      // Verify profile was auto-created with the update applied
      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile).toBeDefined();
      expect(profile?.emailNotificationsEnabled).toBe(false);
      // Should also copy name from auth
      expect(profile?.fullName).toBe("Test User");
    });
  });
});

// ============================================================================
// PUSH SUBSCRIPTION TESTS
// ============================================================================

describe("Push Subscriptions", () => {
  setupSchedulerTests();

  const validSubscription = JSON.stringify({
    endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
    keys: {
      p256dh: "test-p256dh-key",
      auth: "test-auth-key",
    },
  });

  describe("savePushSubscription", () => {
    it("saves valid push subscription", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      // Create profile first
      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      // Save subscription
      const result = await authT.mutation(api.users.savePushSubscription, {
        subscription: validSubscription,
      });
      await finishScheduledFunctions(t);

      expect(result.success).toBe(true);

      // Verify profile was updated
      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile?.pushNotificationsEnabled).toBe(true);
      expect(profile?.pushSubscription).toBe(validSubscription);
    });

    it("rejects invalid JSON subscription", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      await expect(
        authT.mutation(api.users.savePushSubscription, {
          subscription: "not-valid-json",
        })
      ).rejects.toThrow("not valid JSON");
    });

    it("rejects subscription missing required fields", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      const invalidSubscription = JSON.stringify({
        endpoint: "https://example.com",
        // Missing keys
      });

      await expect(
        authT.mutation(api.users.savePushSubscription, {
          subscription: invalidSubscription,
        })
      ).rejects.toThrow("missing required fields");
    });
  });

  describe("removePushSubscription", () => {
    it("removes push subscription and disables push notifications", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      // Create profile and add subscription
      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);
      await authT.mutation(api.users.savePushSubscription, {
        subscription: validSubscription,
      });
      await finishScheduledFunctions(t);

      // Remove subscription
      const result = await authT.mutation(api.users.removePushSubscription, {});
      await finishScheduledFunctions(t);

      expect(result.success).toBe(true);

      // Verify subscription was removed
      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile?.pushNotificationsEnabled).toBe(false);
      expect(profile?.pushSubscription).toBeUndefined();
    });
  });
});

// ============================================================================
// ACCOUNT DELETION TESTS
// ============================================================================

describe("Account Deletion", () => {
  setupSchedulerTests();

  describe("requestAccountDeletion", () => {
    it("sets deletedAt 30 days in future", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      // Create profile
      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      const beforeRequest = Date.now();

      // Request deletion
      const result = await authT.mutation(api.users.requestAccountDeletion, {});
      await finishScheduledFunctions(t);

      expect(result.success).toBe(true);
      expect(result.deletionDate).toBeDefined();

      // Verify deletion date is approximately 30 days in future
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      expect(result.deletionDate).toBeGreaterThanOrEqual(
        beforeRequest + thirtyDaysMs - 1000
      );
      expect(result.deletionDate).toBeLessThanOrEqual(
        Date.now() + thirtyDaysMs + 1000
      );
    });

    it("sets deletedAt on user profile", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      await authT.mutation(api.users.requestAccountDeletion, {});
      await finishScheduledFunctions(t);

      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile?.deletedAt).toBeDefined();
      expect(profile?.deletedAt).toBeGreaterThan(Date.now());
    });

    it("sets deletedAt on users table", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      await authT.mutation(api.users.requestAccountDeletion, {});
      await finishScheduledFunctions(t);

      const user = await authT.query(api.users.currentUser, {});
      expect(user?.deletedAt).toBeDefined();
      expect(user?.deletedAt).toBeGreaterThan(Date.now());
    });

    it("rejects unauthenticated users", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.users.requestAccountDeletion, {})
      ).rejects.toThrow();
    });

    it("throws error if profile does not exist", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");
      // Don't create profile

      await expect(
        authT.mutation(api.users.requestAccountDeletion, {})
      ).rejects.toThrow("User profile not found");
    });

    it("returns message with deletion date", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      const result = await authT.mutation(api.users.requestAccountDeletion, {});

      expect(result.message).toContain("permanently deleted after");
    });
  });

  describe("cancelAccountDeletion", () => {
    it("clears deletedAt successfully", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      // Create profile and request deletion
      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);
      await authT.mutation(api.users.requestAccountDeletion, {});
      await finishScheduledFunctions(t);

      // Verify deletedAt is set
      let profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile?.deletedAt).toBeDefined();

      // Cancel deletion
      const result = await authT.mutation(api.users.cancelAccountDeletion, {});
      await finishScheduledFunctions(t);

      expect(result.success).toBe(true);

      // Verify deletedAt is cleared
      profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile?.deletedAt).toBeUndefined();
    });

    it("clears deletedAt on users table", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);
      await authT.mutation(api.users.requestAccountDeletion, {});
      await finishScheduledFunctions(t);

      await authT.mutation(api.users.cancelAccountDeletion, {});
      await finishScheduledFunctions(t);

      const user = await authT.query(api.users.currentUser, {});
      expect(user?.deletedAt).toBeUndefined();
    });

    it("throws error if no deletion scheduled", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      // Try to cancel without requesting deletion first
      await expect(
        authT.mutation(api.users.cancelAccountDeletion, {})
      ).rejects.toThrow("No deletion scheduled");
    });

    it("throws error if grace period has expired", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      // Manually set deletedAt to past date (simulating expired grace period)
      const profile = await authT.query(api.users.currentUserProfile, {});
      await authT.run(async (ctx) => {
        await ctx.db.patch(profile!._id, {
          deletedAt: Date.now() - 1000, // 1 second ago
        });
      });

      await expect(
        authT.mutation(api.users.cancelAccountDeletion, {})
      ).rejects.toThrow("Grace period has expired");
    });

    it("rejects unauthenticated users", async () => {
      const t = createTestContext();

      await expect(
        t.mutation(api.users.cancelAccountDeletion, {})
      ).rejects.toThrow();
    });
  });
});

// ============================================================================
// CURRENT USER QUERIES
// ============================================================================

describe("Current User Queries", () => {
  setupSchedulerTests();

  describe("currentUser", () => {
    it("returns null for unauthenticated user", async () => {
      const t = createTestContext();

      const user = await t.query(api.users.currentUser, {});
      expect(user).toBeNull();
    });

    it("returns user for authenticated user", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      const user = await authT.query(api.users.currentUser, {});
      expect(user).toBeDefined();
      expect(user?.name).toBe("Test User");
    });
  });

  describe("currentUserProfile", () => {
    it("returns null for unauthenticated user", async () => {
      const t = createTestContext();

      const profile = await t.query(api.users.currentUserProfile, {});
      expect(profile).toBeNull();
    });

    it("returns null if profile does not exist", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile).toBeNull();
    });

    it("returns profile if it exists", async () => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");

      await authT.mutation(api.users.ensureUserProfile, {});
      await finishScheduledFunctions(t);

      const profile = await authT.query(api.users.currentUserProfile, {});
      expect(profile).toBeDefined();
      expect(profile?.emailNotificationsEnabled).toBe(true);
    });
  });
});
