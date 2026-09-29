/**
 * The shared read of a user's cases (silent-limit audit #2, Sep 29 2026).
 *
 * The lists it replaced read `.take(1000)` OLDEST first with deleted cases
 * counted in, so an account past 1,000 lost its newest cases from the list,
 * the dashboard and the calendar without a word. These run the real index
 * read against convex-test.
 */
import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedContext, setupSchedulerTests } from "../../../test-utils/convex";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { readUserCases, USER_CASES_MAX } from "../userCases";

function caseDoc(userId: Id<"users">, employerName: string, deletedAt?: number) {
  const now = Date.now();
  return {
    userId,
    employerName,
    beneficiaryIdentifier: "B",
    positionTitle: "Engineer",
    caseStatus: "pwd" as const,
    progressStatus: "working" as const,
    rfiEntries: [],
    rfeEntries: [],
    notes: [],
    isProfessionalOccupation: false,
    isFavorite: false,
    priorityLevel: "normal" as const,
    tags: [],
    calendarSyncEnabled: true,
    documents: [],
    recruitmentApplicantsCount: 0,
    additionalRecruitmentMethods: [],
    createdAt: now,
    updatedAt: now,
    ...(deletedAt !== undefined ? { deletedAt } : {}),
  };
}

describe("readUserCases", () => {
  setupSchedulerTests();

  it("returns live cases (oldest first, as before) and leaves deleted ones out", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t, "Reader");
    const out = await user.run(async (ctx) => {
      await ctx.db.insert("cases", caseDoc(user.userId, "Oldest"));
      await ctx.db.insert("cases", caseDoc(user.userId, "Deleted", Date.now()));
      await ctx.db.insert("cases", caseDoc(user.userId, "Newest"));
      return readUserCases(ctx, user.userId);
    });
    expect(out.cases.map((c) => c.employerName)).toEqual(["Oldest", "Newest"]);
    expect(out.truncated).toBe(false);
  });

  it("keeps the NEWEST cases and says when it stopped", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t, "Capped");
    const out = await user.run(async (ctx) => {
      for (let i = 0; i < 5; i++) await ctx.db.insert("cases", caseDoc(user.userId, `C${i}`));
      return readUserCases(ctx, user.userId, 3);
    });
    expect(out.cases.map((c) => c.employerName)).toEqual(["C2", "C3", "C4"]);
    expect(out.truncated).toBe(true);
  });

  it("is not truncated at exactly the ceiling", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t, "Exact");
    const out = await user.run(async (ctx) => {
      for (let i = 0; i < 3; i++) await ctx.db.insert("cases", caseDoc(user.userId, `C${i}`));
      return readUserCases(ctx, user.userId, 3);
    });
    expect(out.cases).toHaveLength(3);
    expect(out.truncated).toBe(false);
  });

  it("sits far above the old 1,000", () => {
    expect(USER_CASES_MAX).toBeGreaterThanOrEqual(5_000);
  });

  it("the case list counts past 1,000 and deleted cases do not use up the room", async () => {
    const t = createTestContext();
    const user = await createAuthenticatedContext(t, "Big account");
    await user.run(async (ctx) => {
      // 200 deleted cases first: under the old read they filled 200 of the
      // 1,000 slots before a single live case was counted.
      for (let i = 0; i < 200; i++) await ctx.db.insert("cases", caseDoc(user.userId, `Gone ${i}`, 1));
      for (let i = 0; i < 1_050; i++) await ctx.db.insert("cases", caseDoc(user.userId, `Live ${i}`));
    });
    const res = await user.query(api.cases.listFiltered, { pageSize: 12 });
    expect(res.pagination.totalCount).toBe(1_050);
    expect(res.pagination.truncated).toBe(false);
  }, 180_000);
});
