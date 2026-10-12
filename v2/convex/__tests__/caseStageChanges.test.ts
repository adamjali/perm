/**
 * Closing, reopening and previewing a case's stage.
 *
 * Oct 12 2026: a close set only caseStatus, so the next edit of the case's
 * dates quietly reopened it; the cases page's bulk "Reopen" put certified cases
 * back at PWD; and the chat couldn't tell before saving which stage the dates
 * would give, so it reported the stage it asked for.
 */
import { describe, expect, it } from "vitest";
import {
  createAuthenticatedContext,
  createTestContext,
  finishScheduledFunctions,
  setupSchedulerTests,
} from "../../test-utils/convex";
import { api } from "../_generated/api";

setupSchedulerTests();

async function seed(extra: Record<string, unknown> = {}) {
  const t = createTestContext();
  const owner = await createAuthenticatedContext(t, "Owner");
  const caseId = await owner.mutation(api.cases.create, {
    employerName: "Acme",
    positionTitle: "Engineer",
    pwdFilingDate: "2026-01-05",
    pwdDeterminationDate: "2026-02-10",
    ...extra,
  });
  await finishScheduledFunctions(t);
  const read = () => t.run(async (ctx) => (await ctx.db.get(caseId))!);
  return { t, owner, caseId, read };
}

describe("closing and reopening", () => {
  it("a bulk close keeps the case closed through a later edit of its dates", async () => {
    const { t, owner, caseId, read } = await seed();
    const r = await owner.mutation(api.cases.bulkUpdateStatus, { ids: [caseId], status: "closed" });
    expect(r).toMatchObject({ successCount: 1, failedCount: 0 });
    const closed = await read();
    expect(closed).toMatchObject({ caseStatus: "closed", closureReason: "manual", progressStatusOverride: true });
    expect(closed.closedAt).toBeTypeOf("number");

    await owner.mutation(api.cases.update, { id: caseId, pwdCaseNumber: "P-100-26041-000001" });
    await finishScheduledFunctions(t);
    expect((await read()).caseStatus).toBe("closed");
  });

  it("reopening a closed case puts it at the stage its dates support, and the dates drive it again", async () => {
    const { t, owner, caseId, read } = await seed({ eta9089FilingDate: undefined });
    await owner.mutation(api.cases.bulkUpdateStatus, { ids: [caseId], status: "closed" });
    // The cases page's "Reopen" sends "pwd".
    const r = await owner.mutation(api.cases.bulkUpdateStatus, { ids: [caseId], status: "pwd" });
    expect(r.results?.[0]).toMatchObject({ caseStatus: "recruitment" });
    const reopened = await read();
    expect(reopened).toMatchObject({ caseStatus: "recruitment", progressStatusOverride: false });
    expect(reopened.closedAt).toBeUndefined();
    expect(reopened.closureReason).toBeUndefined();

    await owner.mutation(api.cases.update, { id: caseId, eta9089FilingDate: "2026-05-04", jobOrderStartDate: "2026-03-01", jobOrderEndDate: "2026-03-31", sundayAdFirstDate: "2026-03-01", sundayAdSecondDate: "2026-03-08", noticeOfFilingStartDate: "2026-03-02", noticeOfFilingEndDate: "2026-03-16" });
    await finishScheduledFunctions(t);
    expect((await read()).caseStatus).toBe("eta9089");
  });

  it("reopenCase also hands the stage back to the dates", async () => {
    const { owner, caseId, read } = await seed();
    await owner.mutation(api.cases.bulkUpdateStatus, { ids: [caseId], status: "closed" });
    await owner.mutation(api.cases.reopenCase, { id: caseId });
    expect((await read()).progressStatusOverride).toBe(false);
  });

  it("a case already at the target stage is unchanged, not failed", async () => {
    const { owner, caseId } = await seed();
    await owner.mutation(api.cases.bulkUpdateStatus, { ids: [caseId], status: "closed" });
    const again = await owner.mutation(api.cases.bulkUpdateStatus, { ids: [caseId], status: "closed" });
    expect(again).toMatchObject({ successCount: 0, failedCount: 0, unchangedCount: 1 });
  });

  it("a closure reason is kept", async () => {
    const { owner, caseId, read } = await seed();
    await owner.mutation(api.cases.bulkUpdateStatus, { ids: [caseId], status: "closed", closureReason: "withdrawn" });
    expect((await read()).closureReason).toBe("withdrawn");
  });

  it("an I-140 denial date closing a case records why and when", async () => {
    const { t, owner, caseId, read } = await seed({
      eta9089FilingDate: "2026-04-20",
      eta9089CertificationDate: "2026-05-01",
      i140FilingDate: "2026-05-15",
      jobOrderStartDate: "2026-02-15",
      jobOrderEndDate: "2026-03-17",
      sundayAdFirstDate: "2026-02-15",
      sundayAdSecondDate: "2026-02-22",
      noticeOfFilingStartDate: "2026-02-17",
      noticeOfFilingEndDate: "2026-03-03",
    });
    await owner.mutation(api.cases.update, { id: caseId, i140DenialDate: "2026-06-01" });
    await finishScheduledFunctions(t);
    const c = await read();
    expect(c.caseStatus).toBe("closed");
    expect(c.closureReason).toBe("denied");
    expect(c.closedAt).toBeTypeOf("number");
  });
});

describe("previewUpdate and previewCreate", () => {
  it("report the stage the dates give, without writing", async () => {
    const { owner, caseId, read } = await seed();
    const before = await read();
    const p = await owner.query(api.cases.previewUpdate, { id: caseId, caseStatus: "eta9089", progressStatus: "filed" });
    // Asking for a stage alone doesn't move it: the dates say recruitment.
    expect(p).toMatchObject({ valid: true, caseStatus: "recruitment", stageFollowsDates: true });
    const withDate = await owner.query(api.cases.previewUpdate, {
      id: caseId,
      eta9089FilingDate: "2026-05-04",
      jobOrderStartDate: "2026-03-01",
      jobOrderEndDate: "2026-03-31",
      sundayAdFirstDate: "2026-03-01",
      sundayAdSecondDate: "2026-03-08",
      noticeOfFilingStartDate: "2026-03-02",
      noticeOfFilingEndDate: "2026-03-16",
    });
    expect(withDate).toMatchObject({ valid: true, caseStatus: "eta9089", progressStatus: "filed" });
    const after = await read();
    expect(after.updatedAt).toBe(before.updatedAt);
    expect(after.eta9089FilingDate).toBeUndefined();
  });

  it("report a broken rule instead of throwing", async () => {
    const { owner, caseId } = await seed();
    const p = await owner.query(api.cases.previewUpdate, { id: caseId, pwdDeterminationDate: "2025-12-01" });
    expect(p.valid).toBe(false);
    expect(p.errors.length).toBeGreaterThan(0);
  });

  it("previewCreate gives the starting stage from the dates", async () => {
    const { owner } = await seed();
    const p = await owner.query(api.cases.previewCreate, { employerName: "B", positionTitle: "C", pwdFilingDate: "2026-01-05" });
    expect(p).toMatchObject({ valid: true, caseStatus: "pwd", progressStatus: "filed" });
  });

  it("another account can't preview someone's case", async () => {
    const { t, caseId } = await seed();
    const stranger = await createAuthenticatedContext(t, "Stranger");
    await expect(stranger.query(api.cases.previewUpdate, { id: caseId, positionTitle: "X" })).rejects.toThrow();
  });
});
