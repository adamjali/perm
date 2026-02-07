/**
 * @fileoverview Tests for Convex onboarding functions
 * @see v2/convex/onboarding.ts
 *
 * Tests cover:
 * - Onboarding state query (authenticated/unauthenticated/no profile)
 * - Onboarding step progression and completedAt logic
 * - Role selection saving
 * - Checklist item completion (append, dedup, dismissed guard)
 * - Checklist dismissal
 * - Onboarding reset
 */

import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
} from "../test-utils/convex";
import { api } from "./_generated/api";

// ============================================================================
// HELPERS
// ============================================================================

/** Insert a full userProfile for the authenticated user with all required schema fields. */
async function insertProfile(
  authT: Awaited<ReturnType<typeof createAuthenticatedContext>>,
  overrides?: Record<string, unknown>
) {
  const now = Date.now();
  await authT.run(async (ctx) => {
    await ctx.db.insert("userProfiles", {
      userId: authT.userId,
      fullName: "Test User",
      userType: "individual" as const,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      pushNotificationsEnabled: false,
      urgentDeadlineDays: 7,
      reminderDaysBefore: [1, 3, 7, 14, 30],
      emailDeadlineReminders: true,
      emailStatusUpdates: true,
      emailRfeAlerts: true,
      preferredNotificationEmail: "signup" as const,
      quietHoursEnabled: false,
      timezone: "America/New_York",
      calendarSyncEnabled: true,
      calendarSyncPwd: true,
      calendarSyncEta9089: true,
      calendarSyncI140: true,
      calendarSyncRfe: true,
      calendarSyncRfi: true,
      calendarSyncRecruitment: true,
      calendarSyncFilingWindow: true,
      googleCalendarConnected: false,
      gmailConnected: false,
      casesSortBy: "updatedAt",
      casesSortOrder: "desc" as const,
      casesPerPage: 20,
      dismissedDeadlines: [],
      darkModeEnabled: false,
      autoDeadlineEnforcementEnabled: false,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  });
}

// ============================================================================
// getOnboardingState
// ============================================================================

describe("getOnboardingState", () => {
  it("returns null for unauthenticated user", async () => {
    const t = createTestContext();

    const result = await t.query(api.onboarding.getOnboardingState, {});
    expect(result).toBeNull();
  });

  it("returns null when authenticated but no profile exists", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");

    const result = await authT.query(api.onboarding.getOnboardingState, {});
    expect(result).toBeNull();
  });

  it("returns correct shape with default values for fresh profile", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT);

    const result = await authT.query(api.onboarding.getOnboardingState, {});

    expect(result).not.toBeNull();
    expect(result).toEqual({
      onboardingStep: null,
      onboardingCompletedAt: null,
      onboardingChecklist: [],
      onboardingChecklistDismissed: false,
      termsAcceptedAt: null,
      fullName: "Test User",
    });
  });

  it("returns stored values when profile has onboarding data", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT, {
      onboardingStep: "role",
      onboardingCompletedAt: 1700000000000,
      onboardingChecklist: ["create_case", "add_dates"],
      onboardingChecklistDismissed: true,
      termsAcceptedAt: 1699000000000,
    });

    const result = await authT.query(api.onboarding.getOnboardingState, {});

    expect(result).toEqual({
      onboardingStep: "role",
      onboardingCompletedAt: 1700000000000,
      onboardingChecklist: ["create_case", "add_dates"],
      onboardingChecklistDismissed: true,
      termsAcceptedAt: 1699000000000,
      fullName: "Test User",
    });
  });
});

// ============================================================================
// updateOnboardingStep
// ============================================================================

describe("updateOnboardingStep", () => {
  it("throws for unauthenticated user", async () => {
    const t = createTestContext();

    await expect(
      t.mutation(api.onboarding.updateOnboardingStep, { step: "welcome" })
    ).rejects.toThrow();
  });

  it("throws when profile does not exist", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");

    await expect(
      authT.mutation(api.onboarding.updateOnboardingStep, { step: "welcome" })
    ).rejects.toThrow("User profile not found");
  });

  it("sets onboardingStep to the given value", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT);

    await authT.mutation(api.onboarding.updateOnboardingStep, { step: "role" });

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingStep).toBe("role");
  });

  it.each(["welcome", "role", "create_case", "value_preview", "completion"] as const)(
    "does NOT set onboardingCompletedAt for wizard step '%s'",
    async (step) => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");
      await insertProfile(authT);

      await authT.mutation(api.onboarding.updateOnboardingStep, { step });

      const state = await authT.query(api.onboarding.getOnboardingState, {});
      expect(state?.onboardingCompletedAt).toBeNull();
    }
  );

  it.each(["tour_pending", "tour_completed", "done"] as const)(
    "sets onboardingCompletedAt for terminal step '%s'",
    async (step) => {
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "Test User");
      await insertProfile(authT);

      const before = Date.now();
      await authT.mutation(api.onboarding.updateOnboardingStep, { step });

      const state = await authT.query(api.onboarding.getOnboardingState, {});
      expect(state?.onboardingCompletedAt).toBeGreaterThanOrEqual(before);
      expect(state?.onboardingStep).toBe(step);
    }
  );

  it("does NOT overwrite existing onboardingCompletedAt", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    const existingTimestamp = 1700000000000;
    await insertProfile(authT, { onboardingCompletedAt: existingTimestamp });

    await authT.mutation(api.onboarding.updateOnboardingStep, { step: "done" });

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingCompletedAt).toBe(existingTimestamp);
  });

  it("can progress through multiple steps", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT);

    await authT.mutation(api.onboarding.updateOnboardingStep, { step: "welcome" });
    let state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingStep).toBe("welcome");

    await authT.mutation(api.onboarding.updateOnboardingStep, { step: "role" });
    state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingStep).toBe("role");

    await authT.mutation(api.onboarding.updateOnboardingStep, { step: "completion" });
    state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingStep).toBe("completion");
    expect(state?.onboardingCompletedAt).toBeNull();

    await authT.mutation(api.onboarding.updateOnboardingStep, { step: "tour_pending" });
    state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingStep).toBe("tour_pending");
    expect(state?.onboardingCompletedAt).not.toBeNull();
  });
});

// ============================================================================
// saveOnboardingRole
// ============================================================================

describe("saveOnboardingRole", () => {
  it("throws for unauthenticated user", async () => {
    const t = createTestContext();

    await expect(
      t.mutation(api.onboarding.saveOnboardingRole, { role: "Paralegal" })
    ).rejects.toThrow();
  });

  it("throws when profile does not exist", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");

    await expect(
      authT.mutation(api.onboarding.saveOnboardingRole, { role: "Paralegal" })
    ).rejects.toThrow("User profile not found");
  });

  it.each([
    "Immigration Attorney",
    "Paralegal",
    "HR Professional",
    "Employer/Petitioner",
    "Other",
  ] as const)("saves role '%s' to jobTitle field", async (role) => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT);

    await authT.mutation(api.onboarding.saveOnboardingRole, { role });

    // Verify jobTitle was updated by reading profile directly
    const profile = await authT.run(async (ctx) => {
      return await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", authT.userId))
        .unique();
    });
    expect(profile?.jobTitle).toBe(role);
  });
});

// ============================================================================
// completeChecklistItem
// ============================================================================

describe("completeChecklistItem", () => {
  it("throws for unauthenticated user", async () => {
    const t = createTestContext();

    await expect(
      t.mutation(api.onboarding.completeChecklistItem, { itemId: "create_case" })
    ).rejects.toThrow();
  });

  it("throws when profile does not exist", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");

    await expect(
      authT.mutation(api.onboarding.completeChecklistItem, { itemId: "create_case" })
    ).rejects.toThrow("User profile not found");
  });

  it("appends a new item to the checklist", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT);

    await authT.mutation(api.onboarding.completeChecklistItem, { itemId: "create_case" });

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingChecklist).toEqual(["create_case"]);
  });

  it("appends multiple different items in order", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT);

    await authT.mutation(api.onboarding.completeChecklistItem, { itemId: "create_case" });
    await authT.mutation(api.onboarding.completeChecklistItem, { itemId: "add_dates" });
    await authT.mutation(api.onboarding.completeChecklistItem, { itemId: "explore_calendar" });

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingChecklist).toEqual([
      "create_case",
      "add_dates",
      "explore_calendar",
    ]);
  });

  it("prevents duplicate items", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT);

    await authT.mutation(api.onboarding.completeChecklistItem, { itemId: "create_case" });
    await authT.mutation(api.onboarding.completeChecklistItem, { itemId: "create_case" });

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingChecklist).toEqual(["create_case"]);
  });

  it("skips when checklist is dismissed", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT, { onboardingChecklistDismissed: true });

    await authT.mutation(api.onboarding.completeChecklistItem, { itemId: "create_case" });

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingChecklist).toEqual([]);
  });

  it("appends to existing checklist items from profile", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT, {
      onboardingChecklist: ["create_case", "add_dates"],
    });

    await authT.mutation(api.onboarding.completeChecklistItem, { itemId: "try_assistant" });

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingChecklist).toEqual([
      "create_case",
      "add_dates",
      "try_assistant",
    ]);
  });
});

// ============================================================================
// dismissChecklist
// ============================================================================

describe("dismissChecklist", () => {
  it("throws for unauthenticated user", async () => {
    const t = createTestContext();

    await expect(
      t.mutation(api.onboarding.dismissChecklist, {})
    ).rejects.toThrow();
  });

  it("throws when profile does not exist", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");

    await expect(
      authT.mutation(api.onboarding.dismissChecklist, {})
    ).rejects.toThrow("User profile not found");
  });

  it("sets onboardingChecklistDismissed to true and step to done", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT);

    await authT.mutation(api.onboarding.dismissChecklist, {});

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingChecklistDismissed).toBe(true);
    expect(state?.onboardingStep).toBe("done");
  });

  it("preserves existing checklist items when dismissing", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT, {
      onboardingChecklist: ["create_case", "add_dates"],
    });

    await authT.mutation(api.onboarding.dismissChecklist, {});

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingChecklistDismissed).toBe(true);
    expect(state?.onboardingChecklist).toEqual(["create_case", "add_dates"]);
  });
});

// ============================================================================
// resetOnboarding
// ============================================================================

describe("resetOnboarding", () => {
  it("throws for unauthenticated user", async () => {
    const t = createTestContext();

    await expect(
      t.mutation(api.onboarding.resetOnboarding, {})
    ).rejects.toThrow();
  });

  it("throws when profile does not exist", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");

    await expect(
      authT.mutation(api.onboarding.resetOnboarding, {})
    ).rejects.toThrow("User profile not found");
  });

  it("resets all onboarding fields to initial state", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT, {
      onboardingStep: "done",
      onboardingCompletedAt: 1700000000000,
      onboardingChecklist: ["create_case", "add_dates", "explore_calendar"],
      onboardingChecklistDismissed: true,
    });

    await authT.mutation(api.onboarding.resetOnboarding, {});

    const state = await authT.query(api.onboarding.getOnboardingState, {});
    expect(state?.onboardingStep).toBe("welcome");
    expect(state?.onboardingCompletedAt).toBeNull();
    expect(state?.onboardingChecklist).toEqual([]);
    expect(state?.onboardingChecklistDismissed).toBe(false);
  });

  it("preserves non-onboarding profile fields after reset", async () => {
    const t = createTestContext();
    const authT = await createAuthenticatedContext(t, "Test User");
    await insertProfile(authT, {
      jobTitle: "Immigration Attorney",
      onboardingStep: "done",
      onboardingCompletedAt: 1700000000000,
    });

    await authT.mutation(api.onboarding.resetOnboarding, {});

    // jobTitle and fullName should be untouched
    const profile = await authT.run(async (ctx) => {
      return await ctx.db
        .query("userProfiles")
        .withIndex("by_user_id", (q) => q.eq("userId", authT.userId))
        .unique();
    });
    expect(profile?.fullName).toBe("Test User");
    expect(profile?.jobTitle).toBe("Immigration Attorney");
    expect(profile?.onboardingStep).toBe("welcome");
  });
});
