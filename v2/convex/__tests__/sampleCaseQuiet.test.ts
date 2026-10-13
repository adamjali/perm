/**
 * The onboarding sample case is demo data: it never makes a notification, an
 * email, an auto-closure or a Google Calendar event (Oct 12 2026). Each test
 * puts a real case beside it with the same dates, so a rule that stopped
 * everything would fail as surely as one that let the sample through.
 */
import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
  finishScheduledFunctions,
} from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { getTodayInTimezone } from "../lib/perm/deadlines/timezones";
import { addDays, formatISO } from "../../test-utils/dashboard-fixtures";

/** Days from today in Eastern time, the day the reminder rules count from (after 8 PM EDT the UTC date is tomorrow). */
function daysFromNow(days: number): string {
  return formatISO(addDays(new Date(getTodayInTimezone("America/New_York") + "T00:00:00Z"), days));
}

async function userWithProfile(
  t: ReturnType<typeof createTestContext>,
  name: string,
  overrides: { emailStatusUpdates?: boolean; autoDeadlineEnforcementEnabled?: boolean } = {},
) {
  const authT = await createAuthenticatedContext(t, name);
  const userId = authT.userId as Id<"users">;
  const email = `${name.toLowerCase().replace(/\s/g, ".")}@example.com`;
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { email });
    await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: email, emailVerified: email });
    const now = Date.now();
    await ctx.db.insert("userProfiles", {
      userId,
      userType: "individual",
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      pushNotificationsEnabled: false,
      urgentDeadlineDays: 7,
      reminderDaysBefore: [1, 3, 7, 14, 30],
      emailDeadlineReminders: true,
      emailStatusUpdates: overrides.emailStatusUpdates ?? false,
      emailRfeAlerts: true,
      emailWeeklyDigest: true,
      quietHoursEnabled: false,
      timezone: "America/New_York",
      calendarSyncEnabled: false,
      calendarSyncPwd: false,
      calendarSyncEta9089: false,
      calendarSyncI140: false,
      calendarSyncRfe: false,
      calendarSyncRfi: false,
      calendarSyncRecruitment: false,
      calendarSyncFilingWindow: false,
      googleCalendarConnected: false,
      gmailConnected: false,
      casesSortBy: "updatedAt",
      casesSortOrder: "desc",
      casesPerPage: 12,
      dismissedDeadlines: [],
      darkModeEnabled: false,
      autoDeadlineEnforcementEnabled: overrides.autoDeadlineEnforcementEnabled ?? false,
      createdAt: now,
      updatedAt: now,
    });
  });
  return { authT, userId };
}

/** A real case and a sample case with the same dates. */
async function pair(
  t: ReturnType<typeof createTestContext>,
  authT: Awaited<ReturnType<typeof createAuthenticatedContext>>,
  pwdExpirationDate: string,
) {
  const make = (employerName: string, isSample: boolean) =>
    authT.mutation(api.cases.create, {
      employerName,
      beneficiaryIdentifier: `${employerName} worker`,
      positionTitle: "Software Engineer",
      caseStatus: "pwd",
      pwdExpirationDate,
      rfiEntries: [],
      rfeEntries: [],
      ...(isSample ? { isSample: true } : {}),
    });
  const real = await make("Real Co", false);
  const sample = await make("Sample Co", true);
  await finishScheduledFunctions(t);
  return { real, sample };
}

const notificationsFor = (t: ReturnType<typeof createTestContext>, caseId: Id<"cases">) =>
  t.run(async (ctx) =>
    (await ctx.db.query("notifications").collect()).filter((n) => n.caseId === caseId),
  );

describe("the sample case stays quiet", () => {
  setupSchedulerTests();

  it("gets no deadline reminders, while a real case with the same date does", async () => {
    const t = createTestContext();
    const { authT } = await userWithProfile(t, "Reminder Person");
    await pair(t, authT, daysFromNow(7));
    const reminders = await t.query(internal.scheduledJobs.getCasesNeedingReminders, {});
    const employers = new Set(reminders.map((r: { employerName: string }) => r.employerName));
    expect(employers.has("Real Co")).toBe(true);
    expect(employers.has("Sample Co")).toBe(false);
  });

  it("is left out of the weekly summary's deadlines, updates and case count", async () => {
    const t = createTestContext();
    const { authT, userId } = await userWithProfile(t, "Summary Person");
    await pair(t, authT, daysFromNow(5));
    const deadlines = await t.query(internal.scheduledJobs.getDeadlinesForDigest, { userId });
    const updates = await t.query(internal.scheduledJobs.getRecentlyUpdatedCases, { userId });
    const count = await t.query(internal.scheduledJobs.getActiveCaseCountForUser, { userId });
    expect(deadlines.map((d) => d.employerName)).toContain("Real Co");
    expect(deadlines.map((d) => d.employerName)).not.toContain("Sample Co");
    expect(updates.map((u) => u.employerName)).toEqual(["Real Co"]);
    expect(count).toBe(1);
  });

  it("never gets a notification, whoever asks for one", async () => {
    const t = createTestContext();
    const { authT, userId } = await userWithProfile(t, "Notice Person");
    const { real, sample } = await pair(t, authT, daysFromNow(60));
    const base = { userId, type: "system" as const, title: "t", message: "m", priority: "low" as const };
    expect(await t.mutation(internal.notifications.createNotification, { ...base, caseId: sample })).toBeNull();
    expect(await t.mutation(internal.notifications.createNotification, { ...base, caseId: real })).not.toBeNull();
    expect(await notificationsFor(t, sample)).toHaveLength(0);
    expect(await notificationsFor(t, real)).toHaveLength(1);
  });

  it("makes no status-change notice or email when its stage changes", async () => {
    const t = createTestContext();
    const { authT } = await userWithProfile(t, "Status Person", { emailStatusUpdates: true });
    const { real, sample } = await pair(t, authT, daysFromNow(60));
    const before = {
      real: (await notificationsFor(t, real)).length,
      sample: (await notificationsFor(t, sample)).length,
    };
    await authT.mutation(api.cases.bulkUpdateStatus, { ids: [real, sample], status: "closed" });
    await finishScheduledFunctions(t);
    expect(before.sample).toBe(0);
    expect((await notificationsFor(t, sample)).length).toBe(0);
    expect((await notificationsFor(t, real)).length).toBeGreaterThan(before.real);
  });

  it("is never closed for a missed deadline, while a real case is", async () => {
    const t = createTestContext();
    const { authT } = await userWithProfile(t, "Enforce Person", { autoDeadlineEnforcementEnabled: true });
    const { real, sample } = await pair(t, authT, daysFromNow(-10));
    await authT.mutation(api.deadlineEnforcement.checkAndEnforceDeadlines, {});
    await finishScheduledFunctions(t);
    const [r, s] = await t.run(async (ctx) => [await ctx.db.get(real), await ctx.db.get(sample)]);
    expect(r?.caseStatus).toBe("closed");
    expect(s?.caseStatus).not.toBe("closed");
    expect(await notificationsFor(t, sample)).toHaveLength(0);
  });

  it("puts no events in Google Calendar", async () => {
    const t = createTestContext();
    const { authT, userId } = await userWithProfile(t, "Calendar Person");
    const { real, sample } = await pair(t, authT, daysFromNow(60));
    const s = await t.query(internal.googleCalendarSync.getCaseForCalendarSync, { caseId: sample });
    const r = await t.query(internal.googleCalendarSync.getCaseForCalendarSync, { caseId: real });
    expect(s?.calendarSyncEnabled).toBe(false);
    expect(r?.calendarSyncEnabled).toBe(true);
    const listed = await t.query(internal.cases.listForSync, { userId });
    expect(listed.find((c: { _id: Id<"cases"> }) => c._id === sample)?.calendarSyncEnabled).toBe(false);
  });

  it("is created with calendar sync off", async () => {
    const t = createTestContext();
    const { authT } = await userWithProfile(t, "Onboarding Person");
    const id = await authT.mutation(api.onboarding.createSampleCase, {});
    const doc = await t.run(async (ctx) => ctx.db.get(id));
    expect(doc?.isSample).toBe(true);
    expect(doc?.calendarSyncEnabled).toBe(false);
  });
});
