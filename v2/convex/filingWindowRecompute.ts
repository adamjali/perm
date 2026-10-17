/**
 * One-time: recompute every case's saved filing and recruitment windows under
 * the corrected PWD rule (convex/lib/perm/dates/pwdValidity.ts, Oct 16 2026).
 *
 * The windows are saved on each case when it's edited, and the deadline rules
 * prefer a saved value, so a case nobody edits would keep the old cap at the
 * PWD expiry. This writes only the windows that change, leaves `updatedAt`
 * alone (nobody edited the case) and resyncs Google Calendar for live cases
 * whose window moved.
 *
 *   npx convex run filingWindowRecompute:recompute '{"dryRun":true}' --prod
 *   npx convex run filingWindowRecompute:recompute '{}' --prod
 *
 * And, read-only: cases the old rule closed for an expired PWD although
 * recruitment had begun inside its validity. Reopening one is the owner's call.
 *
 *   npx convex run filingWindowRecompute:closedUnderOldRule '{}' --prod
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { getFirstRecruitmentStepForPwd, pwdBearingFromCase } from "./lib/perm/dates/pwdValidity";
import { calculateDerivedDates } from "./lib/derivedCalculations";
import { scheduleCalendarSync } from "./lib/calendarSyncHelpers";
import { recordError } from "./lib/errorRecording";

const FIELDS = ["filingWindowOpens", "filingWindowCloses", "recruitmentWindowCloses"] as const;

export const recompute = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  returns: v.object({
    dryRun: v.boolean(),
    scanned: v.number(),
    changed: v.number(),
    cases: v.array(
      v.object({
        caseId: v.string(),
        caseStatus: v.string(),
        deleted: v.boolean(),
        changes: v.record(v.string(), v.object({ from: v.union(v.string(), v.null()), to: v.union(v.string(), v.null()) })),
        calendar: v.string(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    let scanned = 0;
    const changed: Array<{
      caseId: string;
      caseStatus: string;
      deleted: boolean;
      changes: Record<string, { from: string | null; to: string | null }>;
      calendar: string;
    }> = [];

    for await (const c of ctx.db.query("cases")) {
      scanned++;
      const derived = calculateDerivedDates({
        sundayAdFirstDate: c.sundayAdFirstDate,
        sundayAdSecondDate: c.sundayAdSecondDate,
        jobOrderStartDate: c.jobOrderStartDate,
        jobOrderEndDate: c.jobOrderEndDate,
        noticeOfFilingStartDate: c.noticeOfFilingStartDate,
        noticeOfFilingEndDate: c.noticeOfFilingEndDate,
        additionalRecruitmentStartDate: c.additionalRecruitmentStartDate,
        additionalRecruitmentEndDate: c.additionalRecruitmentEndDate,
        additionalRecruitmentMethods: c.additionalRecruitmentMethods,
        pwdExpirationDate: c.pwdExpirationDate,
        pwdDeterminationDate: c.pwdDeterminationDate,
        isProfessionalOccupation: c.isProfessionalOccupation ?? false,
      });

      const changes: Record<string, { from: string | null; to: string | null }> = {};
      const patch: Record<string, string | undefined> = {};
      for (const f of FIELDS) {
        const from = c[f] ?? null;
        const to = derived[f] ?? null;
        if (from !== to) {
          changes[f] = { from, to };
          patch[f] = to ?? undefined;
        }
      }
      if (Object.keys(changes).length === 0) continue;

      const deleted = c.deletedAt !== undefined;
      let calendar = "not scheduled: deleted or sync off for this case";
      if (!dryRun) await ctx.db.patch(c._id, patch);
      if (!deleted && c.calendarSyncEnabled !== false && !c.isSample) {
        if (dryRun) {
          calendar = "would schedule if the user has sync on";
        } else {
          try {
            const r = await scheduleCalendarSync(ctx, c.userId, c._id);
            calendar = r.scheduled ? "scheduled" : `not scheduled: ${r.reason ?? "unknown"}`;
          } catch (e) {
            calendar = "schedule failed";
            await recordError(ctx, "mutation", "filingWindowRecompute.recompute.calendar", e, {
              userId: c.userId,
              resourceId: c._id.toString(),
            });
          }
        }
      }
      changed.push({ caseId: c._id, caseStatus: c.caseStatus, deleted, changes, calendar });
    }

    return { dryRun, scanned, changed: changed.length, cases: changed };
  },
});

export const closedUnderOldRule = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      caseId: v.string(),
      closedAt: v.union(v.number(), v.null()),
      deleted: v.boolean(),
      isSample: v.boolean(),
      pwdDeterminationDate: v.union(v.string(), v.null()),
      pwdExpirationDate: v.union(v.string(), v.null()),
      firstRecruitmentStep: v.union(v.string(), v.null()),
      filingWindowCloses: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const out = [];
    for await (const c of ctx.db.query("cases")) {
      if (c.closureReason !== "pwd_expired") continue;
      if (pwdBearingFromCase(c) !== "began-inside") continue;
      const first = getFirstRecruitmentStepForPwd(c);
      const derived = calculateDerivedDates({
        sundayAdFirstDate: c.sundayAdFirstDate,
        sundayAdSecondDate: c.sundayAdSecondDate,
        jobOrderStartDate: c.jobOrderStartDate,
        jobOrderEndDate: c.jobOrderEndDate,
        noticeOfFilingStartDate: c.noticeOfFilingStartDate,
        noticeOfFilingEndDate: c.noticeOfFilingEndDate,
        additionalRecruitmentStartDate: c.additionalRecruitmentStartDate,
        additionalRecruitmentEndDate: c.additionalRecruitmentEndDate,
        additionalRecruitmentMethods: c.additionalRecruitmentMethods,
        pwdExpirationDate: c.pwdExpirationDate,
        pwdDeterminationDate: c.pwdDeterminationDate,
        isProfessionalOccupation: c.isProfessionalOccupation ?? false,
      });
      out.push({
        caseId: c._id as string,
        closedAt: c.closedAt ?? null,
        deleted: c.deletedAt !== undefined,
        isSample: c.isSample === true,
        pwdDeterminationDate: c.pwdDeterminationDate ?? null,
        pwdExpirationDate: c.pwdExpirationDate ?? null,
        firstRecruitmentStep: first ?? null,
        filingWindowCloses: derived.filingWindowCloses ?? null,
      });
    }
    return out;
  },
});
