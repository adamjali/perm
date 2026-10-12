/**
 * Put back fields of a case its owner deleted, from the change log's copy.
 *
 * Deleting a case erases it (cases.remove), but logDelete keeps every field of
 * the old document in auditLogs. When an owner deletes a case by mistake and
 * enters it again by hand, this copies the fields they lost onto the new case.
 *
 * It only FILLS: a field is written when the new case holds nothing there (or
 * the field's default), never over what the owner has entered since. It reads
 * one audit row and one case, checks both belong to the same account, and
 * recalculates the derived dates and the calendar the way cases.update does.
 *
 * Support tool, run by hand, dry run first:
 *   npx convex run caseRestore:fromDeletedCopy '{"auditLogId":"...","targetCaseId":"...","fields":[...],"dryRun":true}' --prod
 *
 * Oct 12 2026: a user deleted a case after the chat said an update had saved
 * when it hadn't, and lost its recruitment record and wage.
 */
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { calculateDerivedDates } from "./lib/derivedCalculations";
import { logUpdate } from "./lib/audit";
import { scheduleCalendarSync } from "./lib/calendarSyncHelpers";

/** Fields this tool may write: the owner's own entries, never status, ids or derived dates. */
export const RESTORABLE_FIELDS = [
  "additionalRecruitmentMethods",
  "additionalRecruitmentEndDate",
  "sundayAdFirstDate",
  "sundayAdSecondDate",
  "sundayAdNewspaper",
  "jobOrderStartDate",
  "jobOrderEndDate",
  "jobOrderState",
  "noticeOfFilingStartDate",
  "noticeOfFilingEndDate",
  "pwdFilingDate",
  "pwdDeterminationDate",
  "pwdExpirationDate",
  "pwdCaseNumber",
  "pwdWageAmount",
  "pwdWageLevel",
  "recruitmentApplicantsCount",
  "recruitmentNotes",
  "isProfessionalOccupation",
  "isPinned",
  "socCode",
  "socTitle",
  "jobDescription",
  "tags",
] as const;

type Restorable = (typeof RESTORABLE_FIELDS)[number];

/** Holds nothing the owner entered: empty, or the value a new case starts with. */
export function isUnset(value: unknown): boolean {
  if (value === undefined || value === null || value === "" || value === false || value === 0) return true;
  return Array.isArray(value) && value.length === 0;
}

export const fromDeletedCopy = internalMutation({
  args: {
    auditLogId: v.id("auditLogs"),
    targetCaseId: v.id("cases"),
    fields: v.array(v.string()),
    dryRun: v.boolean(),
  },
  returns: v.object({
    applied: v.boolean(),
    writes: v.any(),
    keptBecauseAlreadySet: v.array(v.string()),
    notInDeletedCopy: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.auditLogId);
    if (!row || row.action !== "delete" || row.tableName !== "cases") {
      throw new Error("That audit row isn't a deleted case.");
    }
    const target = await ctx.db.get(args.targetCaseId);
    if (!target || target.deletedAt !== undefined) throw new Error("The target case doesn't exist.");
    if (!row.userId || row.userId !== target.userId) {
      throw new Error("The deleted case and the target case belong to different accounts.");
    }

    const unknown = args.fields.filter((f) => !(RESTORABLE_FIELDS as readonly string[]).includes(f));
    if (unknown.length > 0) throw new Error(`Not restorable: ${unknown.join(", ")}`);

    const old = new Map<string, unknown>();
    for (const c of row.changes ?? []) {
      if (c.oldValue === undefined) continue;
      try {
        old.set(c.field, JSON.parse(c.oldValue));
      } catch {
        old.set(c.field, c.oldValue);
      }
    }

    const writes: Partial<Record<Restorable, unknown>> = {};
    const kept: string[] = [];
    const absent: string[] = [];
    for (const field of args.fields as Restorable[]) {
      const was = old.get(field);
      if (isUnset(was)) {
        absent.push(field);
        continue;
      }
      if (!isUnset((target as Record<string, unknown>)[field])) {
        kept.push(field);
        continue;
      }
      writes[field] = was;
    }

    const plan = { writes, keptBecauseAlreadySet: kept, notInDeletedCopy: absent };
    if (args.dryRun || Object.keys(writes).length === 0) return { applied: false, ...plan };

    const merged = { ...target, ...writes } as Doc<"cases">;
    const derived = calculateDerivedDates({
      sundayAdFirstDate: merged.sundayAdFirstDate,
      sundayAdSecondDate: merged.sundayAdSecondDate,
      jobOrderStartDate: merged.jobOrderStartDate,
      jobOrderEndDate: merged.jobOrderEndDate,
      noticeOfFilingStartDate: merged.noticeOfFilingStartDate,
      noticeOfFilingEndDate: merged.noticeOfFilingEndDate,
      additionalRecruitmentEndDate: merged.additionalRecruitmentEndDate,
      additionalRecruitmentMethods: merged.additionalRecruitmentMethods,
      pwdExpirationDate: merged.pwdExpirationDate,
      isProfessionalOccupation: merged.isProfessionalOccupation,
    });

    await ctx.db.patch(args.targetCaseId, {
      ...(writes as Partial<Doc<"cases">>),
      recruitmentStartDate: derived.recruitmentStartDate ?? undefined,
      recruitmentEndDate: derived.recruitmentEndDate ?? undefined,
      filingWindowOpens: derived.filingWindowOpens ?? undefined,
      filingWindowCloses: derived.filingWindowCloses ?? undefined,
      recruitmentWindowCloses: derived.recruitmentWindowCloses ?? undefined,
      updatedAt: Date.now(),
    });
    const after = await ctx.db.get(args.targetCaseId);
    // Logged under the case's own account: auditLogs.userId must name a user, and
    // this runs on the owner's behalf with no signed-in identity.
    await logUpdate(
      ctx,
      "cases",
      args.targetCaseId,
      target as Record<string, unknown>,
      after as Record<string, unknown>,
      undefined,
      target.userId,
    );
    if (after?.calendarSyncEnabled !== false) {
      await scheduleCalendarSync(ctx, target.userId, args.targetCaseId);
    }
    return { applied: true, ...plan };
  },
});
