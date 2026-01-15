/**
 * Tests for Timeline Convex Functions
 *
 * Tests cover:
 * - getPreferences: defaults for new users, returns saved preferences
 * - updatePreferences: saves timeRange, saves selectedCaseIds
 * - addCaseToTimeline: adds case to empty list, converts undefined to array
 * - removeCaseFromTimeline: removes case from list
 * - getCasesForTimeline: returns all active cases, filters to selected, excludes deleted
 */

import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedContext, setupSchedulerTests, finishScheduledFunctions } from "../test-utils/convex";
import { api } from "./_generated/api";

describe("Timeline Preferences", () => {
  // Enable fake timers for scheduled function handling
  setupSchedulerTests();

  describe("getPreferences", () => {
    it("should return defaults for new user (no preferences saved)", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const preferences = await user.query(api.timeline.getPreferences, {});

      expect(preferences.selectedCaseIds).toBeNull();
      expect(preferences.timeRange).toBe(12); // Default time range
    });

    it("should return saved preferences after update", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Update preferences
      await user.mutation(api.timeline.updatePreferences, {
        timeRange: 6,
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});

      expect(preferences.timeRange).toBe(6);
    });

    it("should return empty results for unauthenticated user", async () => {
      const t = createTestContext();

      const preferences = await t.query(api.timeline.getPreferences, {});

      expect(preferences.selectedCaseIds).toBeNull();
      expect(preferences.timeRange).toBe(12);
    });
  });

  describe("updatePreferences", () => {
    it("should save timeRange", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.timeline.updatePreferences, {
        timeRange: 24,
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});

      expect(preferences.timeRange).toBe(24);
    });

    it("should save selectedCaseIds", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create a case first
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.timeline.updatePreferences, {
        selectedCaseIds: [caseId],
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});

      expect(preferences.selectedCaseIds).toEqual([caseId]);
    });

    it("should create new preferences if none exist", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // First update creates preferences
      const preferencesId = await user.mutation(api.timeline.updatePreferences, {
        timeRange: 3,
      });
      await finishScheduledFunctions(t);

      expect(preferencesId).toBeDefined();

      const preferences = await user.query(api.timeline.getPreferences, {});
      expect(preferences.timeRange).toBe(3);
    });

    it("should update existing preferences", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // First update
      await user.mutation(api.timeline.updatePreferences, {
        timeRange: 6,
      });
      await finishScheduledFunctions(t);

      // Second update
      await user.mutation(api.timeline.updatePreferences, {
        timeRange: 24,
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});
      expect(preferences.timeRange).toBe(24);
    });

    it("should set selectedCaseIds to null", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create a case and add to selection
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.timeline.updatePreferences, {
        selectedCaseIds: [caseId],
      });
      await finishScheduledFunctions(t);

      // Set to null (show all)
      await user.mutation(api.timeline.updatePreferences, {
        selectedCaseIds: null,
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});
      expect(preferences.selectedCaseIds).toBeNull();
    });
  });

  describe("addCaseToTimeline", () => {
    it("should add case to empty list (no preferences exist)", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create a case
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Add to timeline
      await user.mutation(api.timeline.addCaseToTimeline, {
        caseId,
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});
      expect(preferences.selectedCaseIds).toContain(caseId);
    });

    it("should convert undefined selection to array with case when adding", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create initial case that would be in "all active"
      const case1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Create preferences with undefined selectedCaseIds (means "all")
      await user.mutation(api.timeline.updatePreferences, {
        timeRange: 6,
        // Don't set selectedCaseIds - it will be undefined
      });
      await finishScheduledFunctions(t);

      // Create new case
      const case2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Add case2 to timeline - should convert undefined to explicit list
      await user.mutation(api.timeline.addCaseToTimeline, {
        caseId: case2,
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});

      // Should now have explicit list containing both cases
      expect(preferences.selectedCaseIds).toBeDefined();
      expect(preferences.selectedCaseIds).toContain(case1);
      expect(preferences.selectedCaseIds).toContain(case2);
    });

    it("should add case to existing selection", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const case1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const case2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Set initial selection with case1
      await user.mutation(api.timeline.updatePreferences, {
        selectedCaseIds: [case1],
      });
      await finishScheduledFunctions(t);

      // Add case2
      await user.mutation(api.timeline.addCaseToTimeline, {
        caseId: case2,
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});
      expect(preferences.selectedCaseIds).toContain(case1);
      expect(preferences.selectedCaseIds).toContain(case2);
    });

    it("should not duplicate case if already in selection", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Add case twice
      await user.mutation(api.timeline.addCaseToTimeline, { caseId });
      await finishScheduledFunctions(t);
      await user.mutation(api.timeline.addCaseToTimeline, { caseId });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});
      const caseCount = preferences.selectedCaseIds?.filter((id) => id === caseId).length;
      expect(caseCount).toBe(1);
    });

    it("should reject adding non-existent case", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create and delete a case to get a valid but non-existent ID
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);
      await user.mutation(api.cases.remove, { id: caseId });
      await finishScheduledFunctions(t);

      await expect(
        user.mutation(api.timeline.addCaseToTimeline, { caseId })
      ).rejects.toThrow("Case not found");
    });

    it("should reject adding other user's case", async () => {
      const t = createTestContext();

      const userA = await createAuthenticatedContext(t, "User A");
      const caseId = await userA.mutation(api.cases.create, {
        employerName: "User A Corp",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const userB = await createAuthenticatedContext(t, "User B");
      await expect(
        userB.mutation(api.timeline.addCaseToTimeline, { caseId })
      ).rejects.toThrow("Case not found");
    });
  });

  describe("removeCaseFromTimeline", () => {
    it("should remove case from list", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const case1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const case2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Set selection with both cases
      await user.mutation(api.timeline.updatePreferences, {
        selectedCaseIds: [case1, case2],
      });
      await finishScheduledFunctions(t);

      // Remove case1
      await user.mutation(api.timeline.removeCaseFromTimeline, {
        caseId: case1,
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});
      expect(preferences.selectedCaseIds).not.toContain(case1);
      expect(preferences.selectedCaseIds).toContain(case2);
    });

    it("should handle removing from undefined selection (creates explicit list)", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create two cases
      const case1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const case2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // No preferences exist (undefined means "all active")
      // Remove case1 - should create explicit list with only case2
      await user.mutation(api.timeline.removeCaseFromTimeline, {
        caseId: case1,
      });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});
      expect(preferences.selectedCaseIds).toBeDefined();
      expect(preferences.selectedCaseIds).not.toContain(case1);
      expect(preferences.selectedCaseIds).toContain(case2);
    });

    it("should handle removing last case from selection", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.timeline.updatePreferences, {
        selectedCaseIds: [caseId],
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.timeline.removeCaseFromTimeline, { caseId });
      await finishScheduledFunctions(t);

      const preferences = await user.query(api.timeline.getPreferences, {});
      expect(preferences.selectedCaseIds).toEqual([]);
    });
  });
});

describe("Timeline Case Data", () => {
  // Enable fake timers for scheduled function handling
  setupSchedulerTests();

  describe("getCasesForTimeline", () => {
    it("should return all active cases when no selection", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create 3 cases with different statuses
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
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Company 3",
        beneficiaryIdentifier: "Person 3",
        positionTitle: "Manager",
        caseStatus: "i140",
      });
      await finishScheduledFunctions(t);

      const cases = await user.query(api.timeline.getCasesForTimeline, {});

      expect(cases).toHaveLength(3);
    });

    it("should filter to selected cases", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const case1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const case2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Developer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Company 3",
        beneficiaryIdentifier: "Person 3",
        positionTitle: "Manager",
      });
      await finishScheduledFunctions(t);

      // Select only case1 and case2
      await user.mutation(api.timeline.updatePreferences, {
        selectedCaseIds: [case1, case2],
      });
      await finishScheduledFunctions(t);

      const cases = await user.query(api.timeline.getCasesForTimeline, {});

      expect(cases).toHaveLength(2);
      expect(cases.map((c) => c.id)).toContain(case1);
      expect(cases.map((c) => c.id)).toContain(case2);
    });

    it("should exclude deleted cases", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const case1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const case2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Developer",
      });
      await finishScheduledFunctions(t);

      // Delete case2
      await user.mutation(api.cases.remove, { id: case2 });
      await finishScheduledFunctions(t);

      const cases = await user.query(api.timeline.getCasesForTimeline, {});

      expect(cases).toHaveLength(1);
      expect(cases[0].id).toBe(case1);
    });

    it("should exclude closed cases when no selection", async () => {
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
        caseStatus: "closed",
        progressStatusOverride: true, // Required to override auto-calculated status
      });
      await finishScheduledFunctions(t);

      const cases = await user.query(api.timeline.getCasesForTimeline, {});

      expect(cases).toHaveLength(1);
      expect(cases[0].caseStatus).toBe("pwd");
    });

    it("should return case with all timeline-relevant fields", async () => {
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

      const cases = await user.query(api.timeline.getCasesForTimeline, {});

      expect(cases).toHaveLength(1);
      const caseData = cases[0];

      expect(caseData.employerName).toBe("Test Corp");
      expect(caseData.positionTitle).toBe("Engineer");
      expect(caseData.caseStatus).toBe("recruitment");
      expect(caseData.progressStatus).toBe("working");
      expect(caseData.pwdFilingDate).toBe("2024-01-15");
      expect(caseData.pwdDeterminationDate).toBe("2024-02-15");
      expect(caseData.pwdExpirationDate).toBe("2025-06-30");
      expect(caseData.sundayAdFirstDate).toBe("2024-03-03");
      expect(caseData.sundayAdSecondDate).toBe("2024-03-10");
      expect(caseData.jobOrderStartDate).toBe("2024-03-01");
      expect(caseData.jobOrderEndDate).toBe("2024-03-31");
      expect(caseData.rfiEntries).toEqual([]);
      expect(caseData.rfeEntries).toEqual([]);
    });

    it("should return empty array for unauthenticated user", async () => {
      const t = createTestContext();

      const cases = await t.query(api.timeline.getCasesForTimeline, {});

      expect(cases).toEqual([]);
    });

    it("should only return current user's cases", async () => {
      const t = createTestContext();

      const userA = await createAuthenticatedContext(t, "User A");
      await userA.mutation(api.cases.create, {
        employerName: "Company A",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const userB = await createAuthenticatedContext(t, "User B");
      const cases = await userB.query(api.timeline.getCasesForTimeline, {});

      expect(cases).toHaveLength(0);
    });

    it("should return all cases when selection is empty array", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Set empty selection - with current implementation, empty array doesn't
      // trigger the explicit selection filter (length > 0 check fails) and
      // doesn't trigger the undefined fallback either, so all non-deleted cases are returned
      await user.mutation(api.timeline.updatePreferences, {
        selectedCaseIds: [],
      });
      await finishScheduledFunctions(t);

      const cases = await user.query(api.timeline.getCasesForTimeline, {});

      // Empty array in current implementation returns all non-deleted cases
      // (neither the explicit selection nor the undefined fallback applies)
      expect(cases).toHaveLength(1);
    });
  });
});
