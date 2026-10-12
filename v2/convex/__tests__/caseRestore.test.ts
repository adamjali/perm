/**
 * caseRestore.fromDeletedCopy fills a re-entered case from the change log's
 * copy of the one its owner deleted, and never overwrites what they entered
 * since (Oct 12 2026: a chat "success" that hadn't saved led a user to delete
 * a case and lose its recruitment record).
 */
import { describe, expect, it } from "vitest";
import {
  createAuthenticatedContext,
  createTestContext,
  finishScheduledFunctions,
  setupSchedulerTests,
} from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { isUnset } from "../caseRestore";

const RECRUITMENT = [
  { method: "local_newspaper", date: "2026-07-29", description: "THE DAILY HERALD" },
  { method: "employer_website", date: "", description: "", startDate: "2026-06-29", endDate: "2026-07-29" },
  { method: "job_website_ad", date: "", description: "", startDate: "2026-06-28", endDate: "2026-07-27" },
];

async function seed() {
  const t = createTestContext();
  const owner = await createAuthenticatedContext(t, "Owner");
  const old = await owner.mutation(api.cases.create, {
    employerName: "Acme Corp",
    beneficiaryIdentifier: "",
    positionTitle: "DevOps Engineer",
    isProfessionalOccupation: true,
    pwdWageLevel: "Level IV",
    additionalRecruitmentMethods: RECRUITMENT,
  });
  await t.run(async (ctx) => {
    await ctx.db.patch(old, { pwdWageAmount: 137000, recruitmentApplicantsCount: 1, isPinned: true });
  });
  await finishScheduledFunctions(t);
  await owner.mutation(api.cases.remove, { id: old });
  await finishScheduledFunctions(t);
  const fresh = await owner.mutation(api.cases.create, {
    employerName: "Acme Corp",
    beneficiaryIdentifier: "",
    positionTitle: "Senior DevOps Engineer",
  });
  await finishScheduledFunctions(t);
  const auditLogId = await t.run(async (ctx) => {
    const rows = await ctx.db.query("auditLogs").collect();
    const row = rows.find((r) => r.action === "delete" && r.documentId === old);
    return row!._id;
  });
  return { t, owner, old, fresh, auditLogId };
}

const FIELDS = [
  "additionalRecruitmentMethods",
  "pwdWageAmount",
  "pwdWageLevel",
  "recruitmentApplicantsCount",
  "isProfessionalOccupation",
  "isPinned",
];

describe("restoring a deleted case's fields", () => {
  setupSchedulerTests();

  it("a dry run plans the writes and changes nothing", async () => {
    const { t, fresh, auditLogId } = await seed();
    const r = await t.mutation(internal.caseRestore.fromDeletedCopy, {
      auditLogId, targetCaseId: fresh, fields: FIELDS, dryRun: true,
    });
    expect(r.applied).toBe(false);
    expect(Object.keys(r.writes).sort()).toEqual([...FIELDS].sort());
    const doc = await t.run((ctx) => ctx.db.get(fresh));
    expect(doc!.additionalRecruitmentMethods).toEqual([]);
  });

  it("fills the empty fields, keeps the owner's newer entries, and recomputes the windows", async () => {
    const { t, fresh, auditLogId } = await seed();
    const r = await t.mutation(internal.caseRestore.fromDeletedCopy, {
      auditLogId, targetCaseId: fresh, fields: [...FIELDS, "jobDescription"], dryRun: false,
    });
    await finishScheduledFunctions(t);
    expect(r.applied).toBe(true);
    const doc = await t.run((ctx) => ctx.db.get(fresh));
    expect(doc!.additionalRecruitmentMethods).toEqual(RECRUITMENT);
    expect(doc!.pwdWageAmount).toBe(137000);
    expect(doc!.pwdWageLevel).toBe("Level IV");
    expect(doc!.recruitmentApplicantsCount).toBe(1);
    expect(doc!.isProfessionalOccupation).toBe(true);
    expect(doc!.isPinned).toBe(true);
    // The owner's re-entered title is never touched.
    expect(doc!.positionTitle).toBe("Senior DevOps Engineer");
    // Derived from the restored recruitment, as cases.update would.
    expect(doc!.recruitmentEndDate).toBe("2026-07-29");
    expect(doc!.filingWindowOpens).toBeDefined();
    // The restore itself is in the change log.
    const updates = await t.run(async (ctx) =>
      (await ctx.db.query("auditLogs").collect()).filter((a) => a.action === "update" && a.documentId === fresh),
    );
    expect(updates.length).toBeGreaterThan(0);
  });

  it("never overwrites a field the owner has set since", async () => {
    const { t, fresh, auditLogId } = await seed();
    await t.run((ctx) => ctx.db.patch(fresh, { pwdWageLevel: "Level III" }));
    const r = await t.mutation(internal.caseRestore.fromDeletedCopy, {
      auditLogId, targetCaseId: fresh, fields: FIELDS, dryRun: false,
    });
    expect(r.keptBecauseAlreadySet).toContain("pwdWageLevel");
    const doc = await t.run((ctx) => ctx.db.get(fresh));
    expect(doc!.pwdWageLevel).toBe("Level III");
  });

  it("refuses another account's case, an unknown field, and an audit row that isn't a deleted case", async () => {
    const { t, fresh, auditLogId } = await seed();
    const stranger = await createAuthenticatedContext(t, "Stranger");
    const theirs = await stranger.mutation(api.cases.create, {
      employerName: "Other", beneficiaryIdentifier: "", positionTitle: "Role",
    });
    await finishScheduledFunctions(t);
    await expect(t.mutation(internal.caseRestore.fromDeletedCopy, {
      auditLogId, targetCaseId: theirs as Id<"cases">, fields: FIELDS, dryRun: true,
    })).rejects.toThrow(/different accounts/);
    await expect(t.mutation(internal.caseRestore.fromDeletedCopy, {
      auditLogId, targetCaseId: fresh, fields: ["caseStatus"], dryRun: true,
    })).rejects.toThrow(/Not restorable/);
    const createRow = await t.run(async (ctx) =>
      (await ctx.db.query("auditLogs").collect()).find((a) => a.action === "create")!._id,
    );
    await expect(t.mutation(internal.caseRestore.fromDeletedCopy, {
      auditLogId: createRow, targetCaseId: fresh, fields: FIELDS, dryRun: true,
    })).rejects.toThrow(/isn't a deleted case/);
  });

  it("treats a new case's defaults as unset", () => {
    for (const v of [undefined, null, "", false, 0, []]) expect(isUnset(v)).toBe(true);
    for (const v of ["x", true, 1, [1]]) expect(isUnset(v)).toBe(false);
  });
});
