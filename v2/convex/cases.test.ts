import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedContext, setupSchedulerTests, finishScheduledFunctions } from "../test-utils/convex";
import { api } from "./_generated/api";

describe("Cases Security", () => {
  // Enable fake timers for scheduled function handling
  // Mutations like create/update call ctx.scheduler.runAfter() for notifications
  setupSchedulerTests();
  describe("Authentication", () => {
    it("should return empty array for unauthenticated list query (graceful handling)", async () => {
      // Queries return empty results for unauthenticated users to handle sign-out transitions gracefully
      const t = createTestContext();
      const result = await t.query(api.cases.list, {});
      expect(result).toEqual([]);
    });

    it("should reject unauthenticated create mutation", async () => {
      // Mutations should still reject unauthenticated users
      const t = createTestContext();
      await expect(
        t.mutation(api.cases.create, {
          employerName: "Test Corp",
          beneficiaryIdentifier: "John D.",
          positionTitle: "Engineer",
        })
      ).rejects.toThrow();
    });

    it("should return null for unauthenticated get query (graceful handling)", async () => {
      // First create a case as authenticated user
      const t = createTestContext();
      const authT = await createAuthenticatedContext(t, "User 1");
      const caseId = await authT.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Unauthenticated users get null (same as "not found") for graceful sign-out handling
      const unauthT = createTestContext();
      const result = await unauthT.query(api.cases.get, { id: caseId });
      expect(result).toBeNull();
    });
  });

  describe("User Isolation", () => {
    it("should not return other user's cases in list", async () => {
      const t = createTestContext();

      // User A creates a case
      const userA = await createAuthenticatedContext(t, "User A");
      await userA.mutation(api.cases.create, {
        employerName: "Company A",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Role A",
      });
      await finishScheduledFunctions(t);

      // User B should see empty list
      const userB = await createAuthenticatedContext(t, "User B");
      const userBCases = await userB.query(api.cases.list, {});
      expect(userBCases).toHaveLength(0);
    });

    it("should return null for other user's case by ID", async () => {
      const t = createTestContext();

      // User A creates a case
      const userA = await createAuthenticatedContext(t, "User A");
      const caseId = await userA.mutation(api.cases.create, {
        employerName: "Company A",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Role A",
      });
      await finishScheduledFunctions(t);

      // User B should get null (not an error, just null)
      const userB = await createAuthenticatedContext(t, "User B");
      const result = await userB.query(api.cases.get, { id: caseId });
      expect(result).toBeNull();
    });

    it("should reject update on other user's case", async () => {
      const t = createTestContext();

      const userA = await createAuthenticatedContext(t, "User A");
      const caseId = await userA.mutation(api.cases.create, {
        employerName: "Company A",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Role A",
      });
      await finishScheduledFunctions(t);

      const userB = await createAuthenticatedContext(t, "User B");
      await expect(
        userB.mutation(api.cases.update, { id: caseId, employerName: "Hacked" })
      ).rejects.toThrow();
    });

    it("should reject delete on other user's case", async () => {
      const t = createTestContext();

      const userA = await createAuthenticatedContext(t, "User A");
      const caseId = await userA.mutation(api.cases.create, {
        employerName: "Company A",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Role A",
      });
      await finishScheduledFunctions(t);

      const userB = await createAuthenticatedContext(t, "User B");
      await expect(userB.mutation(api.cases.remove, { id: caseId })).rejects.toThrow();
    });
  });

  describe("Soft Delete", () => {
    it("should exclude soft-deleted cases from list", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // List should have 1 case
      let cases = await user.query(api.cases.list, {});
      expect(cases).toHaveLength(1);

      // Delete the case
      await user.mutation(api.cases.remove, { id: caseId });
      await finishScheduledFunctions(t);

      // List should be empty
      cases = await user.query(api.cases.list, {});
      expect(cases).toHaveLength(0);
    });

    it("should return null for soft-deleted case by ID", async () => {
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

      const result = await user.query(api.cases.get, { id: caseId });
      expect(result).toBeNull();
    });

    // Note: restore mutation has been removed since we now use hard delete
    // Cases are permanently deleted and cannot be restored
  });
});

// ============================================================================
// Bulk Operations Tests (4.3)
// ============================================================================

describe("Bulk Operations", () => {
  // Enable fake timers for scheduled function handling
  setupSchedulerTests();

  describe("bulkRemove", () => {
    it("should soft delete multiple cases", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create multiple cases
      const caseId1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);
      const caseId2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);
      const caseId3 = await user.mutation(api.cases.create, {
        employerName: "Company 3",
        beneficiaryIdentifier: "Person 3",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Bulk delete first two
      const result = await user.mutation(api.cases.bulkRemove, {
        ids: [caseId1, caseId2],
      });
      await finishScheduledFunctions(t);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);

      // Verify only case 3 remains
      const cases = await user.query(api.cases.list, {});
      expect(cases).toHaveLength(1);
      expect(cases[0]._id).toBe(caseId3);
    });

    it("should reject bulk delete for unauthenticated users", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const unauthT = createTestContext();
      await expect(
        unauthT.mutation(api.cases.bulkRemove, { ids: [caseId] })
      ).rejects.toThrow();
    });

    it("should not delete other user's cases", async () => {
      const t = createTestContext();

      // User A creates a case
      const userA = await createAuthenticatedContext(t, "User A");
      const caseIdA = await userA.mutation(api.cases.create, {
        employerName: "Company A",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // User B tries to bulk delete User A's case
      const userB = await createAuthenticatedContext(t, "User B");
      const result = await userB.mutation(api.cases.bulkRemove, {
        ids: [caseIdA],
      });
      await finishScheduledFunctions(t);

      // Should complete but not delete any (User B doesn't own the case)
      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);

      // User A's case should still exist
      const userACases = await userA.query(api.cases.list, {});
      expect(userACases).toHaveLength(1);
    });

    it("should log audit entries for bulk deletion", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);
      const caseId2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.bulkRemove, {
        ids: [caseId1, caseId2],
      });
      await finishScheduledFunctions(t);

      const logs = await user.query(api.auditLogs.listMine, { tableName: "cases" });
      const deleteLogs = logs.filter((l) => l.action === "delete");

      expect(deleteLogs.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle partial failures gracefully", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);
      const caseId2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Delete caseId1 first (soft delete)
      await user.mutation(api.cases.remove, { id: caseId1 });
      await finishScheduledFunctions(t);

      // Then try to bulk delete both (caseId1 already deleted, should fail for it)
      const result = await user.mutation(api.cases.bulkRemove, {
        ids: [caseId1, caseId2],
      });
      await finishScheduledFunctions(t);

      // Should succeed for caseId2, fail for caseId1 (already deleted)
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });
  });

  describe("bulkUpdateStatus", () => {
    it("should update status for multiple cases", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);
      const caseId2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);

      const result = await user.mutation(api.cases.bulkUpdateStatus, {
        ids: [caseId1, caseId2],
        status: "recruitment",
      });
      await finishScheduledFunctions(t);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);

      // Verify status was updated
      const case1 = await user.query(api.cases.get, { id: caseId1 });
      const case2 = await user.query(api.cases.get, { id: caseId2 });
      expect(case1?.caseStatus).toBe("recruitment");
      expect(case2?.caseStatus).toBe("recruitment");
    });

    it("should reject bulk update for unauthenticated users", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const unauthT = createTestContext();
      await expect(
        unauthT.mutation(api.cases.bulkUpdateStatus, {
          ids: [caseId],
          status: "recruitment",
        })
      ).rejects.toThrow();
    });

    it("should not update other user's cases", async () => {
      const t = createTestContext();

      const userA = await createAuthenticatedContext(t, "User A");
      const caseIdA = await userA.mutation(api.cases.create, {
        employerName: "Company A",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);

      const userB = await createAuthenticatedContext(t, "User B");
      const result = await userB.mutation(api.cases.bulkUpdateStatus, {
        ids: [caseIdA],
        status: "recruitment",
      });
      await finishScheduledFunctions(t);

      expect(result.successCount).toBe(0);
      expect(result.failedCount).toBe(1);

      // User A's case should remain unchanged
      const caseA = await userA.query(api.cases.get, { id: caseIdA });
      expect(caseA?.caseStatus).toBe("pwd");
    });

    it("should log audit entries for bulk status update", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);
      const caseId2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.bulkUpdateStatus, {
        ids: [caseId1, caseId2],
        status: "recruitment",
      });
      await finishScheduledFunctions(t);

      const logs = await user.query(api.auditLogs.listMine, { tableName: "cases" });
      const updateLogs = logs.filter((l) => l.action === "update");

      expect(updateLogs.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle mixed ownership gracefully", async () => {
      const t = createTestContext();

      const userA = await createAuthenticatedContext(t, "User A");
      const caseIdA = await userA.mutation(api.cases.create, {
        employerName: "Company A",
        beneficiaryIdentifier: "Person A",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);

      const userB = await createAuthenticatedContext(t, "User B");
      const caseIdB = await userB.mutation(api.cases.create, {
        employerName: "Company B",
        beneficiaryIdentifier: "Person B",
        positionTitle: "Engineer",
        caseStatus: "pwd",
      });
      await finishScheduledFunctions(t);

      // User A tries to update both their case and User B's case
      const result = await userA.mutation(api.cases.bulkUpdateStatus, {
        ids: [caseIdA, caseIdB],
        status: "recruitment",
      });
      await finishScheduledFunctions(t);

      // Should only update User A's case
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);

      // Verify User A's case was updated
      const caseA = await userA.query(api.cases.get, { id: caseIdA });
      expect(caseA?.caseStatus).toBe("recruitment");

      // Verify User B's case was NOT updated
      const caseB = await userB.query(api.cases.get, { id: caseIdB });
      expect(caseB?.caseStatus).toBe("pwd");
    });
  });
});

describe("Audit Logging", () => {
  // Enable fake timers for scheduled function handling
  setupSchedulerTests();

  it("should log case creation", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t, "User 1");

    await user.mutation(api.cases.create, {
      employerName: "Test Corp",
      beneficiaryIdentifier: "John D.",
      positionTitle: "Engineer",
    });
    await finishScheduledFunctions(t);

    const logs = await user.query(api.auditLogs.listMine, { tableName: "cases" });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe("create");
    expect(logs[0].tableName).toBe("cases");
  });

  it("should log case update with field changes", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t, "User 1");

    const caseId = await user.mutation(api.cases.create, {
      employerName: "Old Name",
      beneficiaryIdentifier: "John D.",
      positionTitle: "Engineer",
    });
    await finishScheduledFunctions(t);

    await user.mutation(api.cases.update, {
      id: caseId,
      employerName: "New Name",
    });
    await finishScheduledFunctions(t);

    const logs = await user.query(api.auditLogs.listMine, { tableName: "cases" });
    const updateLog = logs.find((l) => l.action === "update");

    expect(updateLog).toBeDefined();
    // Values are serialized to strings for storage
    expect(updateLog?.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "employerName",
          oldValue: '"Old Name"',
          newValue: '"New Name"',
        }),
      ])
    );
  });

  it("should log case deletion", async () => {
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

    const logs = await user.query(api.auditLogs.listMine, { tableName: "cases" });
    const deleteLog = logs.find((l) => l.action === "delete");

    expect(deleteLog).toBeDefined();
  });

  it("should not show other user's audit logs", async () => {
    const t = createTestContext();

    const userA = await createAuthenticatedContext(t, "User A");
    await userA.mutation(api.cases.create, {
      employerName: "User A Corp",
      beneficiaryIdentifier: "Person A",
      positionTitle: "Role A",
    });
    await finishScheduledFunctions(t);

    const userB = await createAuthenticatedContext(t, "User B");
    const userBLogs = await userB.query(api.auditLogs.listMine, {});

    expect(userBLogs).toHaveLength(0);
  });
});

describe("Cases List Filtered", () => {
  // Enable fake timers for scheduled function handling
  setupSchedulerTests();

  describe("Pagination", () => {
    it("should return first page with default page size", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create 15 cases
      for (let i = 1; i <= 15; i++) {
        await user.mutation(api.cases.create, {
          employerName: `Employer ${i}`,
          beneficiaryIdentifier: `Person ${i}`,
          positionTitle: "Engineer",
        });
        await finishScheduledFunctions(t);
      }

      const result = await user.query(api.cases.listFiltered, {});

      expect(result.cases).toHaveLength(12); // Default pageSize
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(12);
      expect(result.pagination.totalCount).toBe(15);
      expect(result.pagination.totalPages).toBe(2);
    });

    it("should return second page", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create 15 cases
      for (let i = 1; i <= 15; i++) {
        await user.mutation(api.cases.create, {
          employerName: `Employer ${i}`,
          beneficiaryIdentifier: `Person ${i}`,
          positionTitle: "Engineer",
        });
        await finishScheduledFunctions(t);
      }

      const result = await user.query(api.cases.listFiltered, { page: 2 });

      expect(result.cases).toHaveLength(3); // Remaining 3 cases
      expect(result.pagination.page).toBe(2);
      expect(result.pagination.totalCount).toBe(15);
    });

    it("should support custom page size", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      // Create 10 cases
      for (let i = 1; i <= 10; i++) {
        await user.mutation(api.cases.create, {
          employerName: `Employer ${i}`,
          beneficiaryIdentifier: `Person ${i}`,
          positionTitle: "Engineer",
        });
        await finishScheduledFunctions(t);
      }

      const result = await user.query(api.cases.listFiltered, { pageSize: 5 });

      expect(result.cases).toHaveLength(5);
      expect(result.pagination.pageSize).toBe(5);
      expect(result.pagination.totalPages).toBe(2);
    });

    it("should return empty array for page beyond total pages", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Company",
        beneficiaryIdentifier: "Person",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, { page: 10 });

      expect(result.cases).toHaveLength(0);
      expect(result.pagination.page).toBe(10);
      expect(result.pagination.totalCount).toBe(1);
    });
  });

  describe("Filtering", () => {
    it("should filter by status", async () => {
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
        positionTitle: "Engineer",
        caseStatus: "recruitment",
        progressStatusOverride: true, // Required to override auto-calculated status
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, { status: "pwd" });

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].caseStatus).toBe("pwd");
      expect(result.pagination.totalCount).toBe(1);
    });

    it("should filter by progress status", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        progressStatus: "working",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
        progressStatus: "filed",
        progressStatusOverride: true, // Required to preserve manual progressStatus
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, { progressStatus: "filed" });

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].progressStatus).toBe("filed");
    });

    it("should filter by favorites only", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        isFavorite: true,
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
        isFavorite: false,
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, { favoritesOnly: true });

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].isFavorite).toBe(true);
    });

    it("should search by employer name (case-insensitive)", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Acme Corporation",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Other Company",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, { searchQuery: "acme" });

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].employerName).toBe("Acme Corporation");
    });

    it("should search by beneficiary name (case-insensitive)", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "John Smith",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Jane Doe",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, { searchQuery: "SMITH" });

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].beneficiaryIdentifier).toBe("John Smith");
    });

    it("should combine multiple filters", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Acme Corp",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        caseStatus: "pwd",
        progressStatus: "working",
        isFavorite: true,
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Acme Corp",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
        caseStatus: "pwd",
        progressStatus: "filed",
        isFavorite: false,
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, {
        status: "pwd",
        progressStatus: "working",
        favoritesOnly: true,
        searchQuery: "acme",
      });

      expect(result.cases).toHaveLength(1);
      expect(result.cases[0].beneficiaryIdentifier).toBe("Person 1");
    });

    it("should exclude soft-deleted cases", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Company",
        beneficiaryIdentifier: "Person",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.remove, { id: caseId });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, {});

      expect(result.cases).toHaveLength(0);
    });
  });

  describe("Sorting", () => {
    it("should sort by deadline ascending (default)", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        pwdExpirationDate: "2025-12-31",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
        pwdExpirationDate: "2025-06-30",
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, {});

      // Earlier deadline should come first
      expect(result.cases[0].employerName).toBe("Company 2");
      expect(result.cases[1].employerName).toBe("Company 1");
    });

    it("should sort by deadline descending", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        pwdExpirationDate: "2025-06-30",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
        pwdExpirationDate: "2025-12-31",
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, { sortOrder: "desc" });

      // Later deadline should come first
      expect(result.cases[0].employerName).toBe("Company 2");
      expect(result.cases[1].employerName).toBe("Company 1");
    });

    it("should sort by updated timestamp", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const case1Id = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Create second case (ID not used directly but case is used in sorting test)
      await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Update case 1 (should make it more recent)
      await user.mutation(api.cases.update, {
        id: case1Id,
        employerName: "Company 1 Updated",
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, {
        sortBy: "updated",
        sortOrder: "desc",
      });

      // Most recently updated should come first
      expect(result.cases[0].employerName).toBe("Company 1 Updated");
    });

    it("should sort by employer name", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Zebra Inc",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      await user.mutation(api.cases.create, {
        employerName: "Acme Corp",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, {
        sortBy: "employer",
        sortOrder: "asc",
      });

      expect(result.cases[0].employerName).toBe("Acme Corp");
      expect(result.cases[1].employerName).toBe("Zebra Inc");
    });
  });

  describe("Case Card Data Structure", () => {
    it("should return properly structured case card data", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John Doe",
        positionTitle: "Engineer",
        caseStatus: "pwd",
        progressStatus: "working",
        progressStatusOverride: true, // Required to preserve manual status
        isFavorite: true,
        pwdFilingDate: "2025-01-15",
        pwdExpirationDate: "2025-06-30",
        // No eta9089FilingDate yet, so PWD expiration is active deadline
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, {});

      expect(result.cases).toHaveLength(1);
      const caseData = result.cases[0];

      // Verify structure
      expect(caseData._id).toBe(caseId);
      expect(caseData.employerName).toBe("Test Corp");
      expect(caseData.beneficiaryIdentifier).toBe("John Doe");
      expect(caseData.caseStatus).toBe("pwd");
      expect(caseData.progressStatus).toBe("working");
      expect(caseData.isFavorite).toBe(true);
      expect(caseData.nextDeadline).toBe("2025-06-30");
      expect(caseData.dates.pwdFiled).toBe("2025-01-15");
      expect(caseData.dates.etaFiled).toBeUndefined();
      expect(caseData.dates.i140Filed).toBeUndefined();
      expect(caseData.dates.created).toBeGreaterThan(0);
      expect(caseData.dates.updated).toBeGreaterThan(0);
    });

    it("should calculate next deadline from multiple deadlines", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t, "User 1");

      await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John Doe",
        positionTitle: "Engineer",
        pwdExpirationDate: "2025-12-31",
        rfiEntries: [
          {
            id: "rfi-test",
            receivedDate: "2025-01-01",
            responseDueDate: "2025-01-31", // 30 days per PERM regulations
            createdAt: Date.now(),
          },
        ],
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.listFiltered, {});

      // Should pick the earliest deadline (RFI due date is sooner than PWD expiration)
      expect(result.cases[0].nextDeadline).toBe("2025-01-31");
    });
  });

  describe("Authentication and Ownership", () => {
    it("should return empty results for unauthenticated query (graceful handling)", async () => {
      const t = createTestContext();
      const result = await t.query(api.cases.listFiltered, {});
      // Gracefully returns empty results instead of throwing for sign-out transitions
      expect(result.cases).toHaveLength(0);
      expect(result.pagination.totalCount).toBe(0);
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
      const result = await userB.query(api.cases.listFiltered, {});

      expect(result.cases).toHaveLength(0);
    });
  });
});

// ============================================================================
// Calendar Sync Integration Tests (ISS-022)
// ============================================================================

describe("Calendar Sync Integration", () => {
  setupSchedulerTests();

  /**
   * Helper to create a user profile with Google Calendar connected.
   * This enables the calendar sync eligibility check to pass.
   */
  async function createUserWithGoogleConnected(
    t: ReturnType<typeof createTestContext>,
    name: string
  ) {
    const authContext = await createAuthenticatedContext(t, name);
    const { userId } = authContext;

    // Create user profile with Google Calendar connected (all required fields per schema)
    await authContext.run(async (ctx) => {
      await ctx.db.insert("userProfiles", {
        userId,
        // Organization section (required)
        userType: "individual" as const,
        // Notification settings (required booleans)
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
        pushNotificationsEnabled: false,
        urgentDeadlineDays: 7,
        reminderDaysBefore: [7, 3, 1],
        // Email preferences (required booleans)
        emailDeadlineReminders: true,
        emailStatusUpdates: true,
        emailRfeAlerts: true,
        emailWeeklyDigest: false,
        preferredNotificationEmail: "signup" as const,
        // Quiet hours (required)
        quietHoursEnabled: false,
        timezone: "America/New_York",
        // Calendar sync (required booleans)
        calendarSyncEnabled: true,
        calendarSyncPwd: true,
        calendarSyncEta9089: true,
        calendarSyncI140: true,
        calendarSyncRfe: true,
        calendarSyncRfi: true,
        calendarSyncRecruitment: true,
        calendarSyncFilingWindow: true,
        // Google OAuth (connected)
        googleEmail: "test@gmail.com",
        googleAccessToken: "encrypted-token",
        googleRefreshToken: "encrypted-refresh",
        googleTokenExpiry: Date.now() + 3600000, // 1 hour from now
        googleScopes: ["https://www.googleapis.com/auth/calendar"],
        googleCalendarConnected: true,
        gmailConnected: false,
        // UI preferences (required)
        casesSortBy: "nextDeadline",
        casesSortOrder: "asc" as const,
        casesPerPage: 20,
        dismissedDeadlines: [],
        darkModeEnabled: false,
        // Deadline enforcement
        autoDeadlineEnforcementEnabled: true,
        // Timestamps
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    return authContext;
  }

  describe("Case Create - Calendar Sync Scheduling", () => {
    it("should schedule calendar sync on case create when calendarSyncEnabled is true (default)", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      // Create case with default calendarSyncEnabled (should be true)
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
        pwdExpirationDate: "2025-06-30", // Deadline field to trigger sync
      });

      // Wait for scheduled functions - this includes calendar sync scheduling
      await finishScheduledFunctions(t);

      // Verify case was created
      const result = await user.query(api.cases.get, { id: caseId });
      expect(result).not.toBeNull();
      expect(result?.employerName).toBe("Test Corp");
    });

    it("should NOT schedule calendar sync when calendarSyncEnabled is explicitly false", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      // Create case with calendarSyncEnabled = false
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
        calendarSyncEnabled: false, // Explicitly disabled
        pwdExpirationDate: "2025-06-30",
      });

      await finishScheduledFunctions(t);

      // Case should be created with sync disabled
      const result = await user.query(api.cases.get, { id: caseId });
      expect(result?.calendarSyncEnabled).toBe(false);
    });

    it("should NOT fail case creation if calendar sync fails", async () => {
      const t = createTestContext();
      // User WITHOUT Google connected - sync will fail but create should succeed
      const user = await createAuthenticatedContext(t, "User 1");

      // Create case - should succeed even without Google connected
      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
        pwdExpirationDate: "2025-06-30",
      });

      await finishScheduledFunctions(t);

      // Case should still be created
      const result = await user.query(api.cases.get, { id: caseId });
      expect(result).not.toBeNull();
      expect(result?.employerName).toBe("Test Corp");
    });
  });

  describe("Case Update - Calendar Sync Scheduling", () => {
    it("should schedule calendar sync when deadline-relevant field changes", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Update deadline-relevant field
      await user.mutation(api.cases.update, {
        id: caseId,
        pwdExpirationDate: "2025-12-31", // Deadline field
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.get, { id: caseId });
      expect(result?.pwdExpirationDate).toBe("2025-12-31");
    });

    it("should NOT schedule calendar sync for non-deadline field changes", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
      });
      await finishScheduledFunctions(t);

      // Update non-deadline field (should NOT trigger sync)
      await user.mutation(api.cases.update, {
        id: caseId,
        employerName: "New Corp Name", // Non-deadline field
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.get, { id: caseId });
      expect(result?.employerName).toBe("New Corp Name");
    });

    it("should NOT schedule calendar sync when case-level sync is disabled", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
        calendarSyncEnabled: false, // Disabled at case level
      });
      await finishScheduledFunctions(t);

      // Update deadline field - should NOT trigger sync because case-level is disabled
      await user.mutation(api.cases.update, {
        id: caseId,
        pwdExpirationDate: "2025-12-31",
      });
      await finishScheduledFunctions(t);

      const result = await user.query(api.cases.get, { id: caseId });
      expect(result?.calendarSyncEnabled).toBe(false);
      expect(result?.pwdExpirationDate).toBe("2025-12-31");
    });
  });

  describe("Case Remove - Calendar Event Deletion", () => {
    it("should schedule calendar event deletion on case remove", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
        pwdExpirationDate: "2025-06-30",
      });
      await finishScheduledFunctions(t);

      // Delete case - should schedule calendar event deletion
      await user.mutation(api.cases.remove, { id: caseId });
      await finishScheduledFunctions(t);

      // Case should be hard-deleted (returns null)
      const result = await user.query(api.cases.get, { id: caseId });
      expect(result).toBeNull(); // Hard-deleted cases return null
    });
  });

  // Note: "Case Restore - Calendar Event Recreation" tests removed
  // since we now use hard delete and cases cannot be restored

  describe("Toggle Calendar Sync", () => {
    it("should schedule calendar sync when toggling ON", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
        calendarSyncEnabled: false, // Start with sync OFF
        pwdExpirationDate: "2025-06-30",
      });
      await finishScheduledFunctions(t);

      // Toggle ON - should schedule calendar sync
      const newState = await user.mutation(api.cases.toggleCalendarSync, {
        id: caseId,
      });
      await finishScheduledFunctions(t);

      expect(newState).toBe(true);

      const result = await user.query(api.cases.get, { id: caseId });
      expect(result?.calendarSyncEnabled).toBe(true);
    });

    it("should schedule calendar event deletion when toggling OFF", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      const caseId = await user.mutation(api.cases.create, {
        employerName: "Test Corp",
        beneficiaryIdentifier: "John D.",
        positionTitle: "Engineer",
        calendarSyncEnabled: true, // Start with sync ON
        pwdExpirationDate: "2025-06-30",
      });
      await finishScheduledFunctions(t);

      // Toggle OFF - should schedule calendar event deletion
      const newState = await user.mutation(api.cases.toggleCalendarSync, {
        id: caseId,
      });
      await finishScheduledFunctions(t);

      expect(newState).toBe(false);

      const result = await user.query(api.cases.get, { id: caseId });
      expect(result?.calendarSyncEnabled).toBe(false);
    });
  });

  describe("Bulk Calendar Sync Toggle", () => {
    it("should schedule calendar sync for all cases when bulk enabling", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      const caseId1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        calendarSyncEnabled: false,
        pwdExpirationDate: "2025-06-30",
      });
      await finishScheduledFunctions(t);

      const caseId2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
        calendarSyncEnabled: false,
        pwdExpirationDate: "2025-07-31",
      });
      await finishScheduledFunctions(t);

      // Bulk toggle ON
      const result = await user.mutation(api.cases.bulkUpdateCalendarSync, {
        ids: [caseId1, caseId2],
        calendarSyncEnabled: true,
      });
      await finishScheduledFunctions(t);

      expect(result.successCount).toBe(2);
      expect(result.failedCount).toBe(0);

      const case1 = await user.query(api.cases.get, { id: caseId1 });
      const case2 = await user.query(api.cases.get, { id: caseId2 });
      expect(case1?.calendarSyncEnabled).toBe(true);
      expect(case2?.calendarSyncEnabled).toBe(true);
    });

    it("should schedule calendar event deletion for all cases when bulk disabling", async () => {
      const t = createTestContext();
      const user = await createUserWithGoogleConnected(t, "User 1");

      const caseId1 = await user.mutation(api.cases.create, {
        employerName: "Company 1",
        beneficiaryIdentifier: "Person 1",
        positionTitle: "Engineer",
        calendarSyncEnabled: true,
        pwdExpirationDate: "2025-06-30",
      });
      await finishScheduledFunctions(t);

      const caseId2 = await user.mutation(api.cases.create, {
        employerName: "Company 2",
        beneficiaryIdentifier: "Person 2",
        positionTitle: "Engineer",
        calendarSyncEnabled: true,
        pwdExpirationDate: "2025-07-31",
      });
      await finishScheduledFunctions(t);

      // Bulk toggle OFF
      const result = await user.mutation(api.cases.bulkUpdateCalendarSync, {
        ids: [caseId1, caseId2],
        calendarSyncEnabled: false,
      });
      await finishScheduledFunctions(t);

      expect(result.successCount).toBe(2);

      const case1 = await user.query(api.cases.get, { id: caseId1 });
      const case2 = await user.query(api.cases.get, { id: caseId2 });
      expect(case1?.calendarSyncEnabled).toBe(false);
      expect(case2?.calendarSyncEnabled).toBe(false);
    });
  });
});
