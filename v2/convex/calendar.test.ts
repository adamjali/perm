/**
 * Tests for Calendar Convex Functions
 *
 * Tests cover:
 * - getCalendarEvents: returns cases with deadline fields, filters closed cases
 * - getCalendarPreferences: returns empty arrays by default, returns saved preferences
 * - updateCalendarPreferences: saves hiddenCases, saves hiddenDeadlineTypes
 */

import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedContext, setupSchedulerTests, finishScheduledFunctions } from "../test-utils/convex";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

describe("Calendar Events", () => {
  // Enable fake timers for scheduled function handling
  setupSchedulerTests();

  describe("getCalendarEvents", () => {
    it("should return cases with all deadline fields", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
        caseStatus: "recruitment",
        progressStatusOverride: true, // Required to override auto-calculated status
        progressStatus: "working",
        pwdFilingDate: "2024-01-15",
        pwdDeterminationDate: "2024-02-15",
        pwdExpirationDate: "2025-06-30",
        sundayAdFirstDate: "2024-03-03",
        sundayAdSecondDate: "2024-03-10",
        jobOrderStartDate: "2024-03-01",
        jobOrderEndDate: "2024-03-31",
      });
      await finishScheduledFunctions(t);

      const events = await user.query(api.calendar.getCalendarEvents, {});

      expect(events).toHaveLength(1);
      const event = events[0];

      expect(event.employerName).toBe("Test Corp");
      expect(event.beneficiaryIdentifier).toBe("John D.");
      expect(event.positionTitle).toBe("Engineer");
      expect(event.caseStatus).toBe("recruitment");
      expect(event.progressStatus).toBe("working");
      expect(event.pwdFilingDate).toBe("2024-01-15");
      expect(event.pwdDeterminationDate).toBe("2024-02-15");
      expect(event.pwdExpirationDate).toBe("2025-06-30");
      expect(event.sundayAdFirstDate).toBe("2024-03-03");
      expect(event.sundayAdSecondDate).toBe("2024-03-10");
      expect(event.jobOrderStartDate).toBe("2024-03-01");
      expect(event.jobOrderEndDate).toBe("2024-03-31");
      expect(event.rfiEntries).toEqual([]);
      expect(event.rfeEntries).toEqual([]);
    });

    it("should return empty array for unauthenticated user", async () => {
      const t = createTestContext();

      const events = await t.query(api.calendar.getCalendarEvents, {});

      expect(events).toEqual([]);
    });

    it("should filter out closed cases by default", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Active Corp",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Closed Corp",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Developer",
        caseStatus: "closed",
        progressStatusOverride: true, // Required to override auto-calculated status
      });
      await finishScheduledFunctions(t);

      const events = await user.query(api.calendar.getCalendarEvents, {});

      expect(events).toHaveLength(1);
      expect(events[0].employerName).toBe("Active Corp");
    });

    it("should include closed cases when showClosed is true", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Active Corp",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Closed Corp",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Developer",
        caseStatus: "closed",
        progressStatusOverride: true, // Required to override auto-calculated status
      });
      await finishScheduledFunctions(t);

      const events = await user.query(api.calendar.getCalendarEvents, {
        showClosed: true,
      });

      expect(events).toHaveLength(2);
    });

    it("should exclude deleted cases", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.remove, { id: caseId });
      await finishScheduledFunctions(t);

      const events = await user.query(api.calendar.getCalendarEvents, {});

      expect(events).toHaveLength(0);
    });

    it("should only return current user's cases", async () => {
      const t = createTestContext();

      const userA = await createAuthenticatedContext(t, "User A");
      await userA.mutation(api.cases.create, {
        employerName: "User A Corp",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const userB = await createAuthenticatedContext(t, "User B");
      const events = await userB.query(api.calendar.getCalendarEvents, {});

      expect(events).toHaveLength(0);
    });

    it("should return multiple cases", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Developer",
        caseStatus: "recruitment",
        progressStatusOverride: true, // Required to override auto-calculated status
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Company 3",
        beneficiaryIdentifier: "Person 3",
        positionTitle: "Manager",
        caseStatus: "i140",
        progressStatusOverride: true, // Required to override auto-calculated status
      });
      await finishScheduledFunctions(t);

      const events = await user.query(api.calendar.getCalendarEvents, {});

      expect(events).toHaveLength(3);
    });
  });
});

describe("Calendar Preferences", () => {
  // Enable fake timers for scheduled function handling
  setupSchedulerTests();

  describe("getCalendarPreferences", () => {
    it("should return empty arrays for unauthenticated user", async () => {
      const t = createTestContext();

      const preferences = await t.query(api.calendar.getCalendarPreferences, {});

      expect(preferences.hiddenCases).toEqual([]);
      expect(preferences.hiddenDeadlineTypes).toEqual([]);
    });

    it("should return empty arrays when no profile exists", async () => {
      const t = createTestContext();
      // Create authenticated context but don't create a profile
      const user = await createAuthenticatedContext(t, "User 1");

      const preferences = await user.query(api.calendar.getCalendarPreferences, {});

      expect(preferences.hiddenCases).toEqual([]);
      expect(preferences.hiddenDeadlineTypes).toEqual([]);
    });

    it("should return saved preferences from profile", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create a case to use as hidden case
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Create user profile with calendar preferences
      await user.run(async (ctx) => {
        const userId = (await ctx.auth.getUserIdentity())?.subject;
        await ctx.db.insert("userProfiles", {
          userId: userId as Id<"users">,
          userType: "individual",
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
          pushNotificationsEnabled: false,
          urgentDeadlineDays: 7,
          reminderDaysBefore: [1, 3, 7],
          emailDeadlineReminders: true,
          emailStatusUpdates: true,
          emailRfeAlerts: true,
          emailWeeklyDigest: false,
          preferredNotificationEmail: "signup",
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
          casesSortOrder: "desc",
          casesPerPage: 20,
          dismissedDeadlines: [],
          darkModeEnabled: false,
          autoDeadlineEnforcementEnabled: false,
          calendarHiddenCases: [caseId],
          calendarHiddenDeadlineTypes: ["pwd_expiration", "rfi_due"],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const preferences = await user.query(api.calendar.getCalendarPreferences, {});

      expect(preferences.hiddenCases).toEqual([caseId]);
      expect(preferences.hiddenDeadlineTypes).toEqual(["pwd_expiration", "rfi_due"]);
    });
  });

  describe("updateCalendarPreferences", () => {
    it("should create profile if none exists", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Call updateCalendarPreferences without an existing profile
      await user.mutation(api.calendar.updateCalendarPreferences, {
        hiddenDeadlineTypes: ["pwd_expiration"],
      });
      await finishScheduledFunctions(t);

      // Verify preferences were saved (which means profile was created)
      const preferences = await user.query(api.calendar.getCalendarPreferences, {});
      expect(preferences.hiddenDeadlineTypes).toEqual(["pwd_expiration"]);
    });

    it("should update hiddenCases", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create a case first
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Create user profile
      await user.run(async (ctx) => {
        const userId = (await ctx.auth.getUserIdentity())?.subject;
        await ctx.db.insert("userProfiles", {
          userId: userId as Id<"users">,
          userType: "individual",
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
          pushNotificationsEnabled: false,
          urgentDeadlineDays: 7,
          reminderDaysBefore: [1, 3, 7],
          emailDeadlineReminders: true,
          emailStatusUpdates: true,
          emailRfeAlerts: true,
          emailWeeklyDigest: false,
          preferredNotificationEmail: "signup",
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
          casesSortOrder: "desc",
          casesPerPage: 20,
          dismissedDeadlines: [],
          darkModeEnabled: false,
          autoDeadlineEnforcementEnabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await user.mutation(api.calendar.updateCalendarPreferences, {
        hiddenCases: [caseId],
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.calendar.getCalendarPreferences, {});

      expect(preferences.hiddenCases).toEqual([caseId]);
    });

    it("should update hiddenDeadlineTypes", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create user profile
      await user.run(async (ctx) => {
        const userId = (await ctx.auth.getUserIdentity())?.subject;
        await ctx.db.insert("userProfiles", {
          userId: userId as Id<"users">,
          userType: "individual",
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
          pushNotificationsEnabled: false,
          urgentDeadlineDays: 7,
          reminderDaysBefore: [1, 3, 7],
          emailDeadlineReminders: true,
          emailStatusUpdates: true,
          emailRfeAlerts: true,
          emailWeeklyDigest: false,
          preferredNotificationEmail: "signup",
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
          casesSortOrder: "desc",
          casesPerPage: 20,
          dismissedDeadlines: [],
          darkModeEnabled: false,
          autoDeadlineEnforcementEnabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await user.mutation(api.calendar.updateCalendarPreferences, {
        hiddenDeadlineTypes: ["pwd_expiration", "rfi_due", "rfe_due"],
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.calendar.getCalendarPreferences, {});

      expect(preferences.hiddenDeadlineTypes).toEqual(["pwd_expiration", "rfi_due", "rfe_due"]);
    });

    it("should update both hiddenCases and hiddenDeadlineTypes", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create a case first
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Create user profile
      await user.run(async (ctx) => {
        const userId = (await ctx.auth.getUserIdentity())?.subject;
        await ctx.db.insert("userProfiles", {
          userId: userId as Id<"users">,
          userType: "individual",
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
          pushNotificationsEnabled: false,
          urgentDeadlineDays: 7,
          reminderDaysBefore: [1, 3, 7],
          emailDeadlineReminders: true,
          emailStatusUpdates: true,
          emailRfeAlerts: true,
          emailWeeklyDigest: false,
          preferredNotificationEmail: "signup",
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
          casesSortOrder: "desc",
          casesPerPage: 20,
          dismissedDeadlines: [],
          darkModeEnabled: false,
          autoDeadlineEnforcementEnabled: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await user.mutation(api.calendar.updateCalendarPreferences, {
        hiddenCases: [caseId],
        hiddenDeadlineTypes: ["i140_filing_deadline"],
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.calendar.getCalendarPreferences, {});

      expect(preferences.hiddenCases).toEqual([caseId]);
      expect(preferences.hiddenDeadlineTypes).toEqual(["i140_filing_deadline"]);
    });

    it("should only update provided fields (partial update)", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create a case first
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Create user profile with initial values
      await user.run(async (ctx) => {
        const userId = (await ctx.auth.getUserIdentity())?.subject;
        await ctx.db.insert("userProfiles", {
          userId: userId as Id<"users">,
          userType: "individual",
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
          pushNotificationsEnabled: false,
          urgentDeadlineDays: 7,
          reminderDaysBefore: [1, 3, 7],
          emailDeadlineReminders: true,
          emailStatusUpdates: true,
          emailRfeAlerts: true,
          emailWeeklyDigest: false,
          preferredNotificationEmail: "signup",
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
          casesSortOrder: "desc",
          casesPerPage: 20,
          dismissedDeadlines: [],
          darkModeEnabled: false,
          autoDeadlineEnforcementEnabled: false,
          calendarHiddenCases: [caseId],
          calendarHiddenDeadlineTypes: ["pwd_expiration"],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Only update hiddenDeadlineTypes
      await user.mutation(api.calendar.updateCalendarPreferences, {
        hiddenDeadlineTypes: ["rfi_due"],
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.calendar.getCalendarPreferences, {});

      // hiddenCases should remain unchanged
      expect(preferences.hiddenCases).toEqual([caseId]);
      // hiddenDeadlineTypes should be updated
      expect(preferences.hiddenDeadlineTypes).toEqual(["rfi_due"]);
    });

    it("should clear arrays when set to empty", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create a case first
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Create user profile with values
      await user.run(async (ctx) => {
        const userId = (await ctx.auth.getUserIdentity())?.subject;
        await ctx.db.insert("userProfiles", {
          userId: userId as Id<"users">,
          userType: "individual",
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: false,
          pushNotificationsEnabled: false,
          urgentDeadlineDays: 7,
          reminderDaysBefore: [1, 3, 7],
          emailDeadlineReminders: true,
          emailStatusUpdates: true,
          emailRfeAlerts: true,
          emailWeeklyDigest: false,
          preferredNotificationEmail: "signup",
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
          casesSortOrder: "desc",
          casesPerPage: 20,
          dismissedDeadlines: [],
          darkModeEnabled: false,
          autoDeadlineEnforcementEnabled: false,
          calendarHiddenCases: [caseId],
          calendarHiddenDeadlineTypes: ["pwd_expiration"],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      // Clear both arrays
      await user.mutation(api.calendar.updateCalendarPreferences, {
        hiddenCases: [],
        hiddenDeadlineTypes: [],
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.calendar.getCalendarPreferences, {});

      expect(preferences.hiddenCases).toEqual([]);
      expect(preferences.hiddenDeadlineTypes).toEqual([]);
    });
  });
});
