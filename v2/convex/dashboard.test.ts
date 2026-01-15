/**
 * Integration Tests for Dashboard Queries
 *
 * Tests the 4 main dashboard queries:
 * 1. dashboard.getDeadlines - Groups deadlines by urgency
 * 2. dashboard.getSummary - Case counts by status
 * 3. dashboard.getRecentActivity - Last 5 updated cases
 * 4. dashboard.getUpcomingDeadlines - Deadlines within N days
 *
 * IMPORTANT: These tests use convex-test with real database operations.
 * Each test gets isolated database state via createTestContext().
 *
 * TDD NOTE: Tests written BEFORE implementation - queries don't exist yet!
 */

import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";
import { createTestContext, createAuthenticatedContext, setupSchedulerTests, finishScheduledFunctions, advanceTime } from "../test-utils/convex";
import { fixtures, daysFromNow, daysAgo } from "../test-utils/dashboard-fixtures";

// ============================================================================
// dashboard.getDeadlines Tests (10 tests)
// ============================================================================

describe("dashboard.getDeadlines", () => {
  // Set up fake timers for scheduler tests
  setupSchedulerTests();

  test("returns empty result when not authenticated (graceful degradation)", async () => {
    const t = createTestContext();

    // Should return empty groups instead of throwing during sign-out transitions
    const result = await t.query(api.dashboard.getDeadlines, {});
    expect(result).toEqual({
      overdue: [],
      thisWeek: [],
      thisMonth: [],
      later: [],
    });
  });

  test("returns empty groups when user has no cases", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    const result = await auth.query(api.dashboard.getDeadlines, {});

    expect(result).toEqual({
      overdue: [],
      thisWeek: [],
      thisMonth: [],
      later: [],
    });
  });

  test("groups PWD expiration into thisWeek when due in 5 days", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create case with PWD expiring in 5 days
    // Create authenticated context - userId is created internally by createAuthenticatedContext
    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      pwdFilingDate: daysAgo(60),
      pwdDeterminationDate: daysAgo(30),
      pwdExpirationDate: daysFromNow(5),
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getDeadlines, {});

    expect(result.thisWeek).toHaveLength(1);
    expect(result.thisWeek[0]).toMatchObject({
      type: "pwd_expiration",
      dueDate: daysFromNow(5),
    });
    expect(result.overdue).toHaveLength(0);
    expect(result.thisMonth).toHaveLength(0);
    expect(result.later).toHaveLength(0);
  });

  test("groups RFI deadline into overdue when past due", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext
    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089WithRFI(),
      rfiEntries: [
        {
          id: "rfi-overdue",
          receivedDate: daysAgo(32),
          responseDueDate: daysAgo(2), // Overdue by 2 days!
          createdAt: Date.now() - 32 * 24 * 60 * 60 * 1000,
        },
      ],
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getDeadlines, {});

    expect(result.overdue).toHaveLength(1);
    expect(result.overdue[0]).toMatchObject({
      type: "rfi_response", // mapped from rfi_due
      dueDate: daysAgo(2),
    });
  });

  test("groups ETA 9089 expiration into thisMonth when due in 20 days", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext
    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089Certified(),
      eta9089FilingDate: daysAgo(170), // Filing before certification
      eta9089CertificationDate: daysAgo(160),
      eta9089ExpirationDate: daysFromNow(20), // 180 days from certification
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getDeadlines, {});

    expect(result.thisMonth).toHaveLength(1);
    expect(result.thisMonth[0]).toMatchObject({
      type: "eta9089_expiration",
      dueDate: daysFromNow(20),
    });
  });

  test("groups I-140 filing window into later when due in 60 days", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext
    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089Certified(),
      eta9089CertificationDate: daysAgo(120),
      eta9089ExpirationDate: daysFromNow(60),
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getDeadlines, {});

    expect(result.later).toHaveLength(1);
    expect(result.later[0]).toMatchObject({
      type: "i140_filing_window",
      dueDate: daysFromNow(60),
    });
  });

  test("excludes PWD expiration after ETA 9089 is filed (superseded)", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext
    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089Pending(),
      pwdExpirationDate: daysFromNow(30), // Still has expiration
      eta9089FilingDate: daysAgo(10), // But ETA 9089 is filed!
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getDeadlines, {});

    // PWD expiration should NOT appear (superseded)
    const allDeadlines = [
      ...result.overdue,
      ...result.thisWeek,
      ...result.thisMonth,
      ...result.later,
    ];
    expect(allDeadlines.find((d) => d.type === "pwd_expiration")).toBeUndefined();
  });

  test("excludes deadlines from closed cases", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext
    await auth.mutation(api.cases.create, {
      ...fixtures.special.closedCase(),
      pwdExpirationDate: daysFromNow(10), // Has deadline but closed
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getDeadlines, {});

    expect(result.thisWeek).toHaveLength(0);
    expect(result.thisMonth).toHaveLength(0);
    expect(result.later).toHaveLength(0);
  });

  test("excludes deadlines from deleted cases", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext
    const caseId = await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdExpiringSoon(),
      pwdExpirationDate: daysFromNow(3),
    });

    // Soft delete the case
    await auth.mutation(api.cases.remove, { id: caseId });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getDeadlines, {});

    expect(result.thisWeek).toHaveLength(0);
  });

  test("isolates deadlines by user (RLS)", async () => {
    const t = createTestContext();
    const authA = await createAuthenticatedContext(t, "User A");
    const authB = await createAuthenticatedContext(t, "User B");

    // Each auth context has its own user - we use the context for isolation, not the userId directly

    // User A creates case with deadline
    await authA.mutation(api.cases.create, {
      ...fixtures.pwd.pwdExpiringSoon(),
      pwdExpirationDate: daysFromNow(5),
    });

    // User B creates case with deadline
    await authB.mutation(api.cases.create, {
      ...fixtures.pwd.pwdExpiringSoon(),
      pwdExpirationDate: daysFromNow(5),
    });
    await finishScheduledFunctions(t);

    // User A should only see their own deadline
    const resultA = await authA.query(api.dashboard.getDeadlines, {});
    expect(resultA.thisWeek).toHaveLength(1);

    // User B should only see their own deadline
    const resultB = await authB.query(api.dashboard.getDeadlines, {});
    expect(resultB.thisWeek).toHaveLength(1);
  });

  test("includes RFE deadlines when active", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext
    await auth.mutation(api.cases.create, {
      ...fixtures.i140.i140WithRFE(),
      rfeEntries: [
        {
          id: "rfe-custom",
          receivedDate: daysAgo(5),
          responseDueDate: daysFromNow(82), // Custom due date (87 days from receipt)
          createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
        },
      ],
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getDeadlines, {});

    expect(result.later).toHaveLength(1);
    expect(result.later[0]).toMatchObject({
      type: "rfe_response", // mapped from rfe_due
      dueDate: daysFromNow(82),
    });
  });
});

// ============================================================================
// dashboard.getSummary Tests (7 tests)
// ============================================================================

describe("dashboard.getSummary", () => {
  // Set up fake timers for scheduler tests
  setupSchedulerTests();

  test("returns empty result when not authenticated (graceful degradation)", async () => {
    const t = createTestContext();

    // Should return empty counts instead of throwing during sign-out transitions
    const result = await t.query(api.dashboard.getSummary, {});
    expect(result).toEqual({
      pwd: { count: 0, subtext: "" },
      recruitment: { count: 0, subtext: "" },
      eta9089: { count: 0, subtext: "" },
      i140: { count: 0, subtext: "" },
      complete: { count: 0, subtext: "" },
      closed: { count: 0, subtext: "" },
      duplicates: { count: 0, subtext: "" },
    });
  });

  test("returns zero counts when user has no cases", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    const result = await auth.query(api.dashboard.getSummary, {});

    // Per perm_flow.md subtext formats
    expect(result).toEqual({
      pwd: { count: 0, subtext: "0 working", progress: 0 },
      recruitment: { count: 0, subtext: "0 ready to start", progress: 0 },
      eta9089: { count: 0, subtext: "0 prep", progress: 0 },
      i140: { count: 0, subtext: "0 prep", progress: 0 },
      complete: { count: 0, subtext: "I-140 Approved", progress: 100 },
      closed: { count: 0, subtext: "Archived", progress: 100 },
      duplicates: { count: 0, subtext: "Marked as duplicate", progress: 0 },
    });
  });

  test("counts cases by status correctly", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    // Create cases in different stages
    await auth.mutation(api.cases.create, fixtures.pwd.pwdWorking());
    await auth.mutation(api.cases.create, fixtures.pwd.pwdWithExpiration());
    await auth.mutation(api.cases.create, fixtures.recruitment.recruitmentActive());
    await auth.mutation(api.cases.create, fixtures.eta9089.eta9089Pending());
    await auth.mutation(api.cases.create, fixtures.eta9089.eta9089WithRFI());
    await auth.mutation(api.cases.create, fixtures.i140.i140Pending());
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getSummary, {});

    expect(result.pwd.count).toBe(2);
    expect(result.recruitment.count).toBe(1);
    expect(result.eta9089.count).toBe(2);
    expect(result.i140.count).toBe(1);
  });

  test("separates Complete (I-140 Approved) from Closed", { timeout: 30000 }, async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    // Create completed case (I-140 approved, still in i140 stage)
    await auth.mutation(api.cases.create, {
      ...fixtures.i140.i140Approved(),
      caseStatus: "i140",
      progressStatus: "approved",
      i140ApprovalDate: daysAgo(10),
    });

    // Create closed case (archived)
    await auth.mutation(api.cases.create, {
      ...fixtures.special.closedCase(),
      caseStatus: "closed",
      progressStatus: "approved",
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getSummary, {});

    expect(result.complete.count).toBe(1); // I-140 approved
    expect(result.closed.count).toBe(1); // Archived
  });

  test("builds correct subtexts per perm_flow.md", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    // PWD: 2 working, 1 filed
    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      progressStatus: "working",
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      progressStatus: "working",
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWithExpiration(),
      progressStatus: "filed",
    });

    // Recruitment: 1 ready to start (working), 1 in progress (filed)
    await auth.mutation(api.cases.create, {
      ...fixtures.recruitment.recruitmentActive(),
      progressStatus: "working",
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.recruitment.recruitmentComplete(),
      progressStatus: "filed", // "in progress" = filed/approved/under_review
    });

    // ETA 9089: 1 prep (working), 1 RFI, 2 filed
    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089Pending(),
      progressStatus: "working", // "prep"
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089Pending(),
      progressStatus: "filed",
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089Pending(),
      progressStatus: "filed",
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089WithRFI(),
      progressStatus: "rfi_rfe",
    });

    // I-140: 1 prep (working), 1 RFE, 1 filed
    await auth.mutation(api.cases.create, {
      ...fixtures.i140.i140Pending(),
      progressStatus: "working", // "prep"
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.i140.i140Pending(),
      progressStatus: "rfi_rfe", // "RFE"
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.i140.i140Pending(),
      progressStatus: "filed",
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getSummary, {});

    // PWD per perm_flow.md: "X working, Y filed"
    expect(result.pwd.subtext).toBe("2 working, 1 filed");

    // Recruitment per perm_flow.md: "X ready to start, Y in progress"
    expect(result.recruitment.subtext).toBe("1 ready to start, 1 in progress");

    // ETA 9089 per perm_flow.md: "X prep, Y RFI, Z filed"
    expect(result.eta9089.subtext).toBe("1 prep, 1 RFI, 2 filed");

    // I-140 per perm_flow.md: "X prep, Y RFE, Z filed"
    expect(result.i140.subtext).toBe("1 prep, 1 RFE, 1 filed");
  });

  test("excludes soft-deleted cases from counts", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    // Create 2 PWD cases
    const case1 = await auth.mutation(api.cases.create, fixtures.pwd.pwdWorking());
    await auth.mutation(api.cases.create, fixtures.pwd.pwdWithExpiration());

    // Delete one
    await auth.mutation(api.cases.remove, { id: case1 });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getSummary, {});

    expect(result.pwd.count).toBe(1); // Only non-deleted case
  });

  test("isolates counts by user (RLS)", async () => {
    const t = createTestContext();
    const authA = await createAuthenticatedContext(t, "User A");
    const authB = await createAuthenticatedContext(t, "User B");

    // User A creates 3 PWD cases (userId is set by auth context)
    await authA.mutation(api.cases.create, fixtures.pwd.pwdWorking());
    await authA.mutation(api.cases.create, fixtures.pwd.pwdWorking());
    await authA.mutation(api.cases.create, fixtures.pwd.pwdWorking());

    // User B creates 1 PWD case
    await authB.mutation(api.cases.create, fixtures.pwd.pwdWorking());
    await finishScheduledFunctions(t);

    // User A should see 3
    const resultA = await authA.query(api.dashboard.getSummary, {});
    expect(resultA.pwd.count).toBe(3);

    // User B should see 1
    const resultB = await authB.query(api.dashboard.getSummary, {});
    expect(resultB.pwd.count).toBe(1);
  });
});

// ============================================================================
// dashboard.getRecentActivity Tests (5 tests)
// ============================================================================

describe("dashboard.getRecentActivity", () => {
  // Set up fake timers for scheduler tests
  setupSchedulerTests();

  test("returns empty array when not authenticated (graceful degradation)", async () => {
    const t = createTestContext();

    // Should return empty array instead of throwing during sign-out transitions
    const result = await t.query(api.dashboard.getRecentActivity, {});
    expect(result).toEqual([]);
  });

  test("returns empty array when user has no cases", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    const result = await auth.query(api.dashboard.getRecentActivity, {});

    expect(result).toEqual([]);
  });

  test("returns last 5 updated cases", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    // Create 7 cases (should only return 5 most recent)
    await auth.mutation(api.cases.create, fixtures.pwd.pwdWorking());
    await auth.mutation(api.cases.create, fixtures.pwd.pwdWithExpiration());
    const caseToUpdate = await auth.mutation(api.cases.create, {
      ...fixtures.recruitment.recruitmentActive(),
    });
    await auth.mutation(api.cases.create, fixtures.eta9089.eta9089Pending());
    await auth.mutation(api.cases.create, fixtures.i140.i140Pending());
    await auth.mutation(api.cases.create, fixtures.pwd.pwdWorking());
    await auth.mutation(api.cases.create, fixtures.pwd.pwdWorking());

    // Update caseToUpdate to make it most recent
    await auth.mutation(api.cases.update, {
      id: caseToUpdate,
      notes: [{ id: "note1", content: "Updated", createdAt: Date.now(), status: "pending" }],
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getRecentActivity, {});

    expect(result).toHaveLength(5);
  });

  test("orders by updatedAt descending (most recent first)", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    const firstCase = await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      beneficiaryIdentifier: "FIRST",
    });
    await finishScheduledFunctions(t);
    advanceTime(1000); // Advance time to get distinct timestamps

    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      beneficiaryIdentifier: "SECOND",
    });
    await finishScheduledFunctions(t);
    advanceTime(1000); // Advance time to get distinct timestamps

    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      beneficiaryIdentifier: "THIRD",
    });
    await finishScheduledFunctions(t);
    advanceTime(1000); // Advance time to get distinct timestamps

    // Update firstCase to be most recent
    await auth.mutation(api.cases.update, { id: firstCase, isFavorite: true });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getRecentActivity, {});

    // Should be: case1 (just updated), case3, case2
    expect(result[0].beneficiaryIdentifier).toBe("FIRST");
    expect(result[1].beneficiaryIdentifier).toBe("THIRD");
    expect(result[2].beneficiaryIdentifier).toBe("SECOND");
  });

  test("excludes soft-deleted cases", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    const case1 = await auth.mutation(api.cases.create, fixtures.pwd.pwdWorking());
    await auth.mutation(api.cases.create, fixtures.pwd.pwdWithExpiration());

    // Delete case1
    await auth.mutation(api.cases.remove, { id: case1 });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getRecentActivity, {});

    expect(result).toHaveLength(1); // Only non-deleted case
  });

  test("isolates activity by user (RLS)", async () => {
    const t = createTestContext();
    const authA = await createAuthenticatedContext(t, "User A");
    const authB = await createAuthenticatedContext(t, "User B");

    // User A creates 2 cases (userId is set by auth context)
    await authA.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      beneficiaryIdentifier: "USER-A-1",
    });
    await authA.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      beneficiaryIdentifier: "USER-A-2",
    });

    // User B creates 2 cases
    await authB.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      beneficiaryIdentifier: "USER-B-1",
    });
    await authB.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      beneficiaryIdentifier: "USER-B-2",
    });
    await finishScheduledFunctions(t);

    // User A should only see their own activity
    const resultA = await authA.query(api.dashboard.getRecentActivity, {});
    expect(resultA).toHaveLength(2);
    expect(resultA.every((c) => c.beneficiaryIdentifier.startsWith("USER-A"))).toBe(true);

    // User B should only see their own activity
    const resultB = await authB.query(api.dashboard.getRecentActivity, {});
    expect(resultB).toHaveLength(2);
    expect(resultB.every((c) => c.beneficiaryIdentifier.startsWith("USER-B"))).toBe(true);
  });
});

// ============================================================================
// dashboard.getUpcomingDeadlines Tests (5 tests)
// ============================================================================

describe("dashboard.getUpcomingDeadlines", () => {
  // Set up fake timers for scheduler tests
  setupSchedulerTests();

  test("returns empty array when not authenticated (graceful degradation)", async () => {
    const t = createTestContext();

    // Should return empty array instead of throwing during sign-out transitions
    const result = await t.query(api.dashboard.getUpcomingDeadlines, {});
    expect(result).toEqual([]);
  });

  test("defaults to 30 days", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    // Create deadlines at various intervals
    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      pwdFilingDate: daysAgo(60),
      pwdDeterminationDate: daysAgo(30),
      pwdExpirationDate: daysFromNow(25), // Within 30 days
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      pwdFilingDate: daysAgo(60),
      pwdDeterminationDate: daysAgo(30),
      pwdExpirationDate: daysFromNow(45), // Outside 30 days
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getUpcomingDeadlines, {});

    expect(result).toHaveLength(1); // Only the one within 30 days
    expect(result[0].dueDate).toBe(daysFromNow(25));
  });

  test("filters to specified days", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      pwdFilingDate: daysAgo(60),
      pwdDeterminationDate: daysAgo(30),
      pwdExpirationDate: daysFromNow(5), // Within 7 days
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      pwdFilingDate: daysAgo(60),
      pwdDeterminationDate: daysAgo(30),
      pwdExpirationDate: daysFromNow(10), // Outside 7 days
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getUpcomingDeadlines, { days: 7 });

    expect(result).toHaveLength(1); // Only the one within 7 days
    expect(result[0].dueDate).toBe(daysFromNow(5));
  });

  test("includes overdue deadlines", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089WithRFI(),
      rfiEntries: [
        {
          id: "rfi-overdue",
          receivedDate: daysAgo(32),
          responseDueDate: daysAgo(2), // Overdue!
          createdAt: Date.now() - 32 * 24 * 60 * 60 * 1000,
        },
      ],
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      pwdFilingDate: daysAgo(60),
      pwdDeterminationDate: daysAgo(30),
      pwdExpirationDate: daysFromNow(15), // Upcoming
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getUpcomingDeadlines, { days: 30 });

    expect(result).toHaveLength(2); // Both overdue and upcoming
    expect(result.some((d) => d.dueDate === daysAgo(2))).toBe(true); // Overdue included
  });

  test("sorts by daysUntil ascending", async () => {
    const t = createTestContext();
    const auth = await createAuthenticatedContext(t, "User A");

    // Create authenticated context - userId is created internally by createAuthenticatedContext

    // Create deadlines in random order
    await auth.mutation(api.cases.create, {
      ...fixtures.pwd.pwdWorking(),
      pwdFilingDate: daysAgo(60),
      pwdDeterminationDate: daysAgo(30),
      pwdExpirationDate: daysFromNow(20),
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.eta9089.eta9089WithRFI(),
      rfiEntries: [
        {
          id: "rfi-soonest",
          receivedDate: daysAgo(25),
          responseDueDate: daysFromNow(5), // Soonest
          createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
        },
      ],
    });
    await auth.mutation(api.cases.create, {
      ...fixtures.i140.i140WithRFE(),
      rfeEntries: [
        {
          id: "rfe-mid",
          receivedDate: daysAgo(10),
          responseDueDate: daysFromNow(15),
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
        },
      ],
    });
    await finishScheduledFunctions(t);

    const result = await auth.query(api.dashboard.getUpcomingDeadlines, { days: 30 });

    // Should be sorted: 5 days, 15 days, 20 days
    expect(result).toHaveLength(3);
    expect(result[0].dueDate).toBe(daysFromNow(5));
    expect(result[1].dueDate).toBe(daysFromNow(15));
    expect(result[2].dueDate).toBe(daysFromNow(20));
  });
});
