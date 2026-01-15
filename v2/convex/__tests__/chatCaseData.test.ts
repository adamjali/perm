/**
 * Chat Case Data Query Tests
 *
 * Comprehensive tests for the chatbot case query functions:
 * - queryCases: Flexible case filtering with field projection
 * - getCaseById: Single case lookup with ownership verification
 * - getCaseSummary: Aggregate statistics for case overview
 *
 * @see /convex/chatCaseData.ts - Implementation
 */

import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
} from "../../test-utils/convex";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/**
 * Type guard to check if query result has cases array
 * Handles both old format (count) and new idsOnly format (totalCount/returnedCount)
 */
type QueryResultWithCases = {
  cases: Array<Record<string, unknown>>;
  count?: number;
  totalCount?: number;
  returnedCount?: number;
};
type QueryResultCountOnly = { count: number };

function hasCases(result: QueryResultWithCases | QueryResultCountOnly): result is QueryResultWithCases {
  return 'cases' in result && Array.isArray(result.cases);
}

/**
 * Get the count from a result (handles both formats)
 */
function _getCount(result: QueryResultWithCases | QueryResultCountOnly): number {
  if ('totalCount' in result && typeof result.totalCount === 'number') {
    return result.totalCount;
  }
  if ('count' in result && typeof result.count === 'number') {
    return result.count;
  }
  throw new Error('Result has no count field');
}

/**
 * Helper to safely get cases from query result
 * Throws descriptive error if cases not present (test failure)
 */
function getCases(result: QueryResultWithCases | QueryResultCountOnly): Array<Record<string, unknown>> {
  if (!hasCases(result)) {
    throw new Error('Expected result to have cases array but got count-only result');
  }
  return result.cases;
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Factory to create test case data with defaults
 */
function createCaseData(overrides: Partial<{
  employerName: string;
  beneficiaryIdentifier: string;
  positionTitle: string;
  caseStatus: "pwd" | "recruitment" | "eta9089" | "i140" | "closed";
  progressStatus: "working" | "waiting_intake" | "filed" | "approved" | "under_review" | "rfi_rfe";
  pwdExpirationDate: string;
  eta9089ExpirationDate: string;
  filingWindowCloses: string;
  recruitmentWindowCloses: string;
  rfiEntries: Array<{
    id: string;
    title?: string;
    description?: string;
    notes?: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt: number;
  }>;
  rfeEntries: Array<{
    id: string;
    title?: string;
    description?: string;
    notes?: string;
    receivedDate: string;
    responseDueDate: string;
    responseSubmittedDate?: string;
    createdAt: number;
  }>;
  notes: Array<{ id: string; content: string; createdAt: number; status: "pending" | "done" | "deleted" }>;
  isProfessionalOccupation: boolean;
  isFavorite: boolean;
  priorityLevel: "low" | "normal" | "high" | "urgent";
  tags: string[];
  calendarSyncEnabled: boolean;
  documents: Array<{ id: string; name: string; url: string; mimeType: string; size: number; uploadedAt: number }>;
  recruitmentApplicantsCount: number;
  additionalRecruitmentMethods: Array<{ method: string; date: string; description?: string }>;
}> = {}) {
  const now = Date.now();
  return {
    employerName: overrides.employerName ?? "Test Company Inc",
    beneficiaryIdentifier: overrides.beneficiaryIdentifier ?? "John Doe",
    positionTitle: overrides.positionTitle ?? "Software Engineer",
    caseStatus: overrides.caseStatus ?? "pwd",
    progressStatus: overrides.progressStatus ?? "working",
    pwdExpirationDate: overrides.pwdExpirationDate,
    eta9089ExpirationDate: overrides.eta9089ExpirationDate,
    filingWindowCloses: overrides.filingWindowCloses,
    recruitmentWindowCloses: overrides.recruitmentWindowCloses,
    rfiEntries: overrides.rfiEntries ?? [],
    rfeEntries: overrides.rfeEntries ?? [],
    notes: overrides.notes ?? [],
    isProfessionalOccupation: overrides.isProfessionalOccupation ?? false,
    isFavorite: overrides.isFavorite ?? false,
    priorityLevel: overrides.priorityLevel ?? "normal",
    tags: overrides.tags ?? [],
    calendarSyncEnabled: overrides.calendarSyncEnabled ?? true,
    documents: overrides.documents ?? [],
    recruitmentApplicantsCount: overrides.recruitmentApplicantsCount ?? 0,
    additionalRecruitmentMethods: overrides.additionalRecruitmentMethods ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get tomorrow's date in ISO format
 */
function getTomorrow(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split("T")[0]!;
}

/**
 * Get yesterday's date in ISO format
 */
function getYesterday(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0]!;
}

/**
 * Get date N days from now in ISO format
 */
function getDaysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0]!;
}

// ============================================================================
// QUERRYCASES TESTS
// ============================================================================

describe("queryCases", () => {
  setupSchedulerTests();

  // ============================================================================
  // AUTHENTICATION TESTS
  // ============================================================================

  describe("authentication", () => {
    it("returns empty array when not authenticated", async () => {
      const t = createTestContext();

      // Call query without authentication
      const result = await t.query(api.chatCaseData.queryCases, {});

      expect(result).toEqual({ cases: [], count: 0 });
    });

    it("returns count: 0 when not authenticated with countOnly", async () => {
      const t = createTestContext();

      const result = await t.query(api.chatCaseData.queryCases, { countOnly: true });

      expect(result).toEqual({ count: 0 });
    });
  });

  // ============================================================================
  // BASIC QUERY TESTS
  // ============================================================================

  describe("basic queries", () => {
    it("returns all non-deleted cases with no filters", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      // Create test cases directly in the database
      await asUser.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Company A" }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Company B" }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Company C" }),
          userId: asUser.userId,
        });
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {});

      expect(result.count).toBe(3);
      expect(getCases(result).length).toBe(3);
    });

    it("excludes deleted cases (deletedAt set)", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Active Case" }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Deleted Case" }),
          userId: asUser.userId,
          deletedAt: Date.now(),
        });
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {});

      expect(result.count).toBe(1);
      expect(getCases(result)[0]?.employerName).toBe("Active Case");
    });

    it("respects user ownership (can't see other users' cases)", async () => {
      const t = createTestContext();
      const asUser1 = await createAuthenticatedContext(t, "User One");
      const asUser2 = await createAuthenticatedContext(t, "User Two");

      // User 1 creates a case
      await asUser1.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "User1 Company" }),
          userId: asUser1.userId,
        });
      });

      // User 2 creates a case
      await asUser2.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "User2 Company" }),
          userId: asUser2.userId,
        });
      });

      // User 1 should only see their case
      const result1 = await asUser1.query(api.chatCaseData.queryCases, {});
      expect(result1.count).toBe(1);
      expect(getCases(result1)[0]!.employerName).toBe("User1 Company");

      // User 2 should only see their case
      const result2 = await asUser2.query(api.chatCaseData.queryCases, {});
      expect(result2.count).toBe(1);
      expect(getCases(result2)[0]!.employerName).toBe("User2 Company");
    });
  });

  // ============================================================================
  // FILTER TESTS
  // ============================================================================

  describe("filters", () => {
    it("filters by caseStatus correctly", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "PWD Case", caseStatus: "pwd" }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Recruitment Case", caseStatus: "recruitment" }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "ETA Case", caseStatus: "eta9089" }),
          userId: asUser.userId,
        });
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {
        caseStatus: "recruitment",
      });

      expect(result.count).toBe(1);
      expect(getCases(result)[0]!.employerName).toBe("Recruitment Case");
    });

    it("filters by progressStatus correctly", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Working Case", progressStatus: "working" }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Filed Case", progressStatus: "filed" }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Approved Case", progressStatus: "approved" }),
          userId: asUser.userId,
        });
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {
        progressStatus: "filed",
      });

      expect(result.count).toBe(1);
      expect(getCases(result)[0]!.employerName).toBe("Filed Case");
    });

    it("filters by hasRfi (active RFI entries)", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        // Case with active RFI (no responseSubmittedDate)
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "With Active RFI",
            rfiEntries: [{
              id: "rfi-1",
              receivedDate: getYesterday(),
              responseDueDate: getTomorrow(),
              createdAt: Date.now(),
            }],
          }),
          userId: asUser.userId,
        });
        // Case with responded RFI
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "With Responded RFI",
            rfiEntries: [{
              id: "rfi-2",
              receivedDate: getYesterday(),
              responseDueDate: getTomorrow(),
              responseSubmittedDate: getYesterday(),
              createdAt: Date.now(),
            }],
          }),
          userId: asUser.userId,
        });
        // Case without RFI
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "No RFI" }),
          userId: asUser.userId,
        });
      });

      const resultWithRfi = await asUser.query(api.chatCaseData.queryCases, {
        hasRfi: true,
      });
      expect(resultWithRfi.count).toBe(1);
      expect(getCases(resultWithRfi)[0]!.employerName).toBe("With Active RFI");

      const resultWithoutRfi = await asUser.query(api.chatCaseData.queryCases, {
        hasRfi: false,
      });
      expect(resultWithoutRfi.count).toBe(2);
    });

    it("filters by hasRfe (active RFE entries)", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        // Case with active RFE (no responseSubmittedDate)
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "With Active RFE",
            rfeEntries: [{
              id: "rfe-1",
              receivedDate: getYesterday(),
              responseDueDate: getTomorrow(),
              createdAt: Date.now(),
            }],
          }),
          userId: asUser.userId,
        });
        // Case without RFE
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "No RFE" }),
          userId: asUser.userId,
        });
      });

      const resultWithRfe = await asUser.query(api.chatCaseData.queryCases, {
        hasRfe: true,
      });
      expect(resultWithRfe.count).toBe(1);
      expect(getCases(resultWithRfe)[0]!.employerName).toBe("With Active RFE");
    });

    it("filters by hasOverdueDeadline", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        // Case with overdue PWD expiration
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Overdue PWD",
            pwdExpirationDate: getYesterday(),
          }),
          userId: asUser.userId,
        });
        // Case with future deadline
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Future Deadline",
            pwdExpirationDate: getDaysFromNow(30),
          }),
          userId: asUser.userId,
        });
        // Case with no deadlines
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "No Deadlines" }),
          userId: asUser.userId,
        });
      });

      const resultOverdue = await asUser.query(api.chatCaseData.queryCases, {
        hasOverdueDeadline: true,
      });
      expect(resultOverdue.count).toBe(1);
      expect(getCases(resultOverdue)[0]!.employerName).toBe("Overdue PWD");
    });

    it("filters by deadlineWithinDays", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        // Case with deadline in 3 days
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Deadline Soon",
            pwdExpirationDate: getDaysFromNow(3),
          }),
          userId: asUser.userId,
        });
        // Case with deadline in 30 days
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Deadline Far",
            pwdExpirationDate: getDaysFromNow(30),
          }),
          userId: asUser.userId,
        });
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {
        deadlineWithinDays: 7,
      });
      expect(result.count).toBe(1);
      expect(getCases(result)[0]!.employerName).toBe("Deadline Soon");
    });

    it("filters by searchText (across employer, position, beneficiary, notes)", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "TechCorp Industries",
            positionTitle: "Backend Developer",
            beneficiaryIdentifier: "Jane Smith",
          }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Other Company",
            positionTitle: "Software Engineer",
            beneficiaryIdentifier: "John Doe",
            notes: [{ id: "n1", content: "Need TechCorp documents", createdAt: Date.now(), status: "pending" }],
          }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Unrelated Inc",
            positionTitle: "Manager",
            beneficiaryIdentifier: "Bob Wilson",
          }),
          userId: asUser.userId,
        });
      });

      // Search by employer
      const resultEmployer = await asUser.query(api.chatCaseData.queryCases, {
        searchText: "TechCorp",
      });
      expect(resultEmployer.count).toBe(2); // Found in employer name and notes

      // Search by beneficiary
      const resultBeneficiary = await asUser.query(api.chatCaseData.queryCases, {
        searchText: "Jane",
      });
      expect(resultBeneficiary.count).toBe(1);
      expect(getCases(resultBeneficiary)[0]!.beneficiaryIdentifier).toBe("Jane Smith");

      // Search by position
      const resultPosition = await asUser.query(api.chatCaseData.queryCases, {
        searchText: "Backend",
      });
      expect(resultPosition.count).toBe(1);
    });

    it("multiple filters combine correctly", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        // Matches both filters
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Target Company",
            caseStatus: "recruitment",
            progressStatus: "working",
          }),
          userId: asUser.userId,
        });
        // Matches caseStatus only
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Other Recruitment",
            caseStatus: "recruitment",
            progressStatus: "filed",
          }),
          userId: asUser.userId,
        });
        // Matches progressStatus only
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Working PWD",
            caseStatus: "pwd",
            progressStatus: "working",
          }),
          userId: asUser.userId,
        });
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {
        caseStatus: "recruitment",
        progressStatus: "working",
      });

      expect(result.count).toBe(1);
      expect(getCases(result)[0]!.employerName).toBe("Target Company");
    });
  });

  // ============================================================================
  // AGGREGATION TESTS
  // ============================================================================

  describe("aggregation", () => {
    it("countOnly mode returns only count", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Company A" }),
          userId: asUser.userId,
        });
        await ctx.db.insert("cases", {
          ...createCaseData({ employerName: "Company B" }),
          userId: asUser.userId,
        });
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {
        countOnly: true,
      });

      expect(result.count).toBe(2);
      expect(result).not.toHaveProperty("cases");
    });

    it("limit parameter works", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        for (let i = 0; i < 10; i++) {
          await ctx.db.insert("cases", {
            ...createCaseData({ employerName: `Company ${i}` }),
            userId: asUser.userId,
          });
        }
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {
        limit: 5,
      });

      expect(getCases(result).length).toBe(5);
      expect(result.count).toBe(10); // Total count includes all matching
    });
  });

  // ============================================================================
  // PROJECTION TESTS
  // ============================================================================

  describe("projection", () => {
    it("fields projection works correctly", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Test Company",
            caseStatus: "recruitment",
            progressStatus: "working",
          }),
          userId: asUser.userId,
        });
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {
        fields: ["employerName", "caseStatus"],
      });

      expect(getCases(result)[0]!).toHaveProperty("_id");
      expect(getCases(result)[0]!).toHaveProperty("employerName");
      expect(getCases(result)[0]!).toHaveProperty("caseStatus");
      expect(getCases(result)[0]!).not.toHaveProperty("progressStatus");
      expect(getCases(result)[0]!).not.toHaveProperty("positionTitle");
    });

    it("returnAllFields returns all fields", async () => {
      const t = createTestContext();
      const asUser = await createAuthenticatedContext(t, "Test User");

      await asUser.run(async (ctx) => {
        await ctx.db.insert("cases", {
          ...createCaseData({
            employerName: "Test Company",
            caseStatus: "recruitment",
          }),
          userId: asUser.userId,
        });
      });

      const result = await asUser.query(api.chatCaseData.queryCases, {
        returnAllFields: true,
      });

      const caseDoc = getCases(result)[0]!;
      expect(caseDoc).toHaveProperty("_id");
      expect(caseDoc).toHaveProperty("employerName");
      expect(caseDoc).toHaveProperty("caseStatus");
      expect(caseDoc).toHaveProperty("progressStatus");
      expect(caseDoc).toHaveProperty("positionTitle");
      expect(caseDoc).toHaveProperty("createdAt");
      // Should NOT include userId (private field)
      expect(caseDoc).not.toHaveProperty("userId");
    });
  });
});

// ============================================================================
// GETCASEBYID TESTS
// ============================================================================

describe("getCaseById", () => {
  setupSchedulerTests();

  it("returns case for owner", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    let caseId: Id<"cases">;
    await asUser.run(async (ctx) => {
      caseId = await ctx.db.insert("cases", {
        ...createCaseData({ employerName: "My Company" }),
        userId: asUser.userId,
      });
    });

    const result = await asUser.query(api.chatCaseData.getCaseById, {
      id: caseId!,
    });

    expect(result).not.toBeNull();
    expect(result!._id).toBe(caseId!);
    expect(result!.employerName).toBe("My Company");
  });

  it("returns null for non-owner", async () => {
    const t = createTestContext();
    const asUser1 = await createAuthenticatedContext(t, "User One");
    const asUser2 = await createAuthenticatedContext(t, "User Two");

    let caseId: Id<"cases">;
    await asUser1.run(async (ctx) => {
      caseId = await ctx.db.insert("cases", {
        ...createCaseData({ employerName: "User1's Case" }),
        userId: asUser1.userId,
      });
    });

    // User 2 tries to access User 1's case
    const result = await asUser2.query(api.chatCaseData.getCaseById, {
      id: caseId!,
    });

    expect(result).toBeNull();
  });

  it("returns null for deleted case", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    let caseId: Id<"cases">;
    await asUser.run(async (ctx) => {
      caseId = await ctx.db.insert("cases", {
        ...createCaseData({ employerName: "Deleted Case" }),
        userId: asUser.userId,
        deletedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.chatCaseData.getCaseById, {
      id: caseId!,
    });

    expect(result).toBeNull();
  });

  it("returns null for non-existent case", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    // Create a case to get a valid ID format, then delete it
    let caseId: Id<"cases">;
    await asUser.run(async (ctx) => {
      caseId = await ctx.db.insert("cases", {
        ...createCaseData(),
        userId: asUser.userId,
      });
      await ctx.db.delete(caseId);
    });

    const result = await asUser.query(api.chatCaseData.getCaseById, {
      id: caseId!,
    });

    expect(result).toBeNull();
  });

  it("fields projection works", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    let caseId: Id<"cases">;
    await asUser.run(async (ctx) => {
      caseId = await ctx.db.insert("cases", {
        ...createCaseData({
          employerName: "Test Company",
          caseStatus: "recruitment",
          progressStatus: "working",
        }),
        userId: asUser.userId,
      });
    });

    const result = await asUser.query(api.chatCaseData.getCaseById, {
      id: caseId!,
      fields: ["employerName", "caseStatus"],
      returnAllFields: false,
    });

    expect(result).not.toBeNull();
    expect(result!).toHaveProperty("_id");
    expect(result!).toHaveProperty("employerName");
    expect(result!).toHaveProperty("caseStatus");
    expect(result!).not.toHaveProperty("progressStatus");
  });

  it("returns null when not authenticated", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    // Create a case with authenticated user
    let caseId: Id<"cases">;
    await asUser.run(async (ctx) => {
      caseId = await ctx.db.insert("cases", {
        ...createCaseData(),
        userId: asUser.userId,
      });
    });

    // Query without authentication
    const result = await t.query(api.chatCaseData.getCaseById, {
      id: caseId!,
    });

    expect(result).toBeNull();
  });
});

// ============================================================================
// GETCASESUMMARY TESTS
// ============================================================================

describe("getCaseSummary", () => {
  setupSchedulerTests();

  it("returns correct counts by status", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    await asUser.run(async (ctx) => {
      // Create cases with different statuses
      await ctx.db.insert("cases", {
        ...createCaseData({ caseStatus: "pwd" }),
        userId: asUser.userId,
      });
      await ctx.db.insert("cases", {
        ...createCaseData({ caseStatus: "pwd" }),
        userId: asUser.userId,
      });
      await ctx.db.insert("cases", {
        ...createCaseData({ caseStatus: "recruitment" }),
        userId: asUser.userId,
      });
      await ctx.db.insert("cases", {
        ...createCaseData({ caseStatus: "eta9089" }),
        userId: asUser.userId,
      });
      await ctx.db.insert("cases", {
        ...createCaseData({ caseStatus: "i140" }),
        userId: asUser.userId,
      });
    });

    const result = await asUser.query(api.chatCaseData.getCaseSummary, {});

    expect(result.total).toBe(5);
    expect(result.byStatus.pwd).toBe(2);
    expect(result.byStatus.recruitment).toBe(1);
    expect(result.byStatus.eta9089).toBe(1);
    expect(result.byStatus.i140).toBe(1);
    expect(result.byStatus.closed).toBe(0);
  });

  it("returns correct counts by progress", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    await asUser.run(async (ctx) => {
      await ctx.db.insert("cases", {
        ...createCaseData({ progressStatus: "working" }),
        userId: asUser.userId,
      });
      await ctx.db.insert("cases", {
        ...createCaseData({ progressStatus: "working" }),
        userId: asUser.userId,
      });
      await ctx.db.insert("cases", {
        ...createCaseData({ progressStatus: "filed" }),
        userId: asUser.userId,
      });
      await ctx.db.insert("cases", {
        ...createCaseData({ progressStatus: "approved" }),
        userId: asUser.userId,
      });
    });

    const result = await asUser.query(api.chatCaseData.getCaseSummary, {});

    expect(result.byProgressStatus.working).toBe(2);
    expect(result.byProgressStatus.filed).toBe(1);
    expect(result.byProgressStatus.approved).toBe(1);
    expect(result.byProgressStatus.waiting_intake).toBe(0);
  });

  it("returns correct overdue count", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    await asUser.run(async (ctx) => {
      // Case with overdue deadline
      await ctx.db.insert("cases", {
        ...createCaseData({ pwdExpirationDate: getYesterday() }),
        userId: asUser.userId,
      });
      // Case with future deadline
      await ctx.db.insert("cases", {
        ...createCaseData({ pwdExpirationDate: getDaysFromNow(30) }),
        userId: asUser.userId,
      });
      // Case with no deadlines
      await ctx.db.insert("cases", {
        ...createCaseData(),
        userId: asUser.userId,
      });
    });

    const result = await asUser.query(api.chatCaseData.getCaseSummary, {});

    expect(result.overdueCount).toBe(1);
  });

  it("returns correct upcoming deadline count", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    await asUser.run(async (ctx) => {
      // Case with PWD deadline within 7 days
      await ctx.db.insert("cases", {
        ...createCaseData({ pwdExpirationDate: getDaysFromNow(3) }),
        userId: asUser.userId,
      });
      // Case with another PWD deadline within 7 days
      await ctx.db.insert("cases", {
        ...createCaseData({ pwdExpirationDate: getDaysFromNow(5) }),
        userId: asUser.userId,
      });
      // Case with deadline beyond 7 days
      await ctx.db.insert("cases", {
        ...createCaseData({ pwdExpirationDate: getDaysFromNow(30) }),
        userId: asUser.userId,
      });
    });

    const result = await asUser.query(api.chatCaseData.getCaseSummary, {});

    expect(result.upcomingDeadlineCount).toBe(2);
  });

  it("returns correct active RFI/RFE counts", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    await asUser.run(async (ctx) => {
      // Case with active RFI
      await ctx.db.insert("cases", {
        ...createCaseData({
          rfiEntries: [{
            id: "rfi-1",
            receivedDate: getYesterday(),
            responseDueDate: getTomorrow(),
            createdAt: Date.now(),
          }],
        }),
        userId: asUser.userId,
      });
      // Case with responded RFI (should not count)
      await ctx.db.insert("cases", {
        ...createCaseData({
          rfiEntries: [{
            id: "rfi-2",
            receivedDate: getYesterday(),
            responseDueDate: getTomorrow(),
            responseSubmittedDate: getYesterday(),
            createdAt: Date.now(),
          }],
        }),
        userId: asUser.userId,
      });
      // Case with active RFE
      await ctx.db.insert("cases", {
        ...createCaseData({
          rfeEntries: [{
            id: "rfe-1",
            receivedDate: getYesterday(),
            responseDueDate: getTomorrow(),
            createdAt: Date.now(),
          }],
        }),
        userId: asUser.userId,
      });
    });

    const result = await asUser.query(api.chatCaseData.getCaseSummary, {});

    expect(result.activeRfiCount).toBe(1);
    expect(result.activeRfeCount).toBe(1);
  });

  it("returns empty stats when not authenticated", async () => {
    const t = createTestContext();

    const result = await t.query(api.chatCaseData.getCaseSummary, {});

    expect(result.total).toBe(0);
    expect(result.byStatus).toEqual({
      pwd: 0,
      recruitment: 0,
      eta9089: 0,
      i140: 0,
      closed: 0,
    });
    expect(result.byProgressStatus).toEqual({
      working: 0,
      waiting_intake: 0,
      filed: 0,
      approved: 0,
      under_review: 0,
      rfi_rfe: 0,
    });
    expect(result.overdueCount).toBe(0);
    expect(result.upcomingDeadlineCount).toBe(0);
    expect(result.activeRfiCount).toBe(0);
    expect(result.activeRfeCount).toBe(0);
  });

  it("excludes deleted cases from counts", async () => {
    const t = createTestContext();
    const asUser = await createAuthenticatedContext(t, "Test User");

    await asUser.run(async (ctx) => {
      // Active case
      await ctx.db.insert("cases", {
        ...createCaseData({ caseStatus: "pwd" }),
        userId: asUser.userId,
      });
      // Deleted case
      await ctx.db.insert("cases", {
        ...createCaseData({ caseStatus: "pwd" }),
        userId: asUser.userId,
        deletedAt: Date.now(),
      });
    });

    const result = await asUser.query(api.chatCaseData.getCaseSummary, {});

    expect(result.total).toBe(1);
    expect(result.byStatus.pwd).toBe(1);
  });
});
