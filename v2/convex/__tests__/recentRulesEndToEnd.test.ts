/**
 * The two newest PERM rules, through the real jobs and queries.
 *
 * Oct 17 2026: a PWD's expiry stops limiting a case once recruitment began
 * inside its validity (20 CFR 656.40(c); Karl Storz, BALCA en banc 2011).
 * Oct 19 2026: a denied ETA 9089 owes a reconsideration or BALCA request
 * within 30 days of the letter.
 *
 * The unit tests hold the rules themselves. These hold every place a person
 * meets them, from a case saved through the form's own mutation: the daily
 * reminder job, the dashboard, auto-close, the notification wording and what
 * Google Calendar sync reads. On Oct 21 2026 the dashboard (and so the case
 * list and cards) and Google Calendar sync were found reading copies of the
 * case that left out the determination date and the denial dates.
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
import { extractCalendarEvents, getDefaultCalendarPreferences } from "../lib/calendarEventExtractor";
import { generateNotificationTitle } from "../lib/notificationHelpers";
import { buildDefaultProfile } from "../lib/userDefaults";

const today = () => new Date(getTodayInTimezone("America/New_York") + "T00:00:00Z");
const day = (offset: number) => formatISO(addDays(today(), offset));

async function userWithProfile(t: ReturnType<typeof createTestContext>, name: string, enforce = false) {
  const authT = await createAuthenticatedContext(t, name);
  const userId = authT.userId as Id<"users">;
  const email = `${name.toLowerCase().replace(/\s/g, ".")}@example.com`;
  await t.run(async (ctx) => {
    await ctx.db.patch(userId, { email });
    await ctx.db.insert("authAccounts", { userId, provider: "password", providerAccountId: email, emailVerified: email });
    await ctx.db.insert("userProfiles", {
      ...buildDefaultProfile(userId, { fullName: name }),
      timezone: "America/New_York",
      reminderDaysBefore: [1, 3, 7, 14, 30],
      autoDeadlineEnforcementEnabled: enforce,
    });
  });
  return { authT, userId };
}

/** The Sunday on or before `offset` days from today, as an offset. */
function sundayOnOrBefore(offset: number): number {
  const weekday = addDays(today(), offset).getUTCDay();
  return offset - weekday;
}

/** The first recruitment step: a Sunday ad about 150 days ago. */
const FIRST = () => sundayOnOrBefore(-150);
/** The filing window closes 180 days after the first step. */
const CLOSES_IN = () => FIRST() + 180;

/** Recruitment that began inside a PWD that expired yesterday. */
const beganInside = () => ({
  employerName: "Inside Co",
  beneficiaryIdentifier: "Inside worker",
  positionTitle: "Software Engineer",
  caseStatus: "recruitment" as const,
  pwdFilingDate: day(-300),
  pwdDeterminationDate: day(-200),
  pwdExpirationDate: day(-1),
  jobOrderStartDate: day(FIRST()),
  jobOrderEndDate: day(FIRST() + 30),
  sundayAdFirstDate: day(FIRST()),
  sundayAdSecondDate: day(FIRST() + 7),
  noticeOfFilingStartDate: day(FIRST()),
  noticeOfFilingEndDate: day(FIRST() + 20),
  rfiEntries: [],
  rfeEntries: [],
});

/** The same, but recruitment began before the determination: the expiry still binds. */
const beganBefore = () => ({
  ...beganInside(),
  employerName: "Before Co",
  beneficiaryIdentifier: "Before worker",
  pwdDeterminationDate: day(FIRST() + 10),
});

/** An ETA 9089 denied 23 days ago: the request for review is due in 7 days. */
const denied = () => ({
  employerName: "Denied Co",
  beneficiaryIdentifier: "Denied worker",
  positionTitle: "Software Engineer",
  caseStatus: "eta9089" as const,
  eta9089FilingDate: day(-200),
  eta9089DenialDate: day(-23),
  rfiEntries: [],
  rfeEntries: [],
});

describe("the Oct 17 PWD rule and the Oct 19 denial path, end to end", () => {
  setupSchedulerTests();

  it("the reminder job reminds of the filing window's close, never a passed PWD, when recruitment began inside it", async () => {
    const t = createTestContext();
    const { authT, userId } = await userWithProfile(t, "Inside Person");
    // Remind on the day count the window's close falls on, whatever weekday today is.
    await t.run(async (ctx) => {
      const profile = await ctx.db.query("userProfiles").withIndex("by_user_id", (q) => q.eq("userId", userId)).first();
      await ctx.db.patch(profile!._id, { reminderDaysBefore: [1, 3, 7, 14, 30, CLOSES_IN()] });
    });
    await authT.mutation(api.cases.create, beganInside());
    await finishScheduledFunctions(t);
    const reminders = (await t.query(internal.scheduledJobs.getCasesNeedingReminders, {})).filter(
      (r: { employerName: string }) => r.employerName === "Inside Co",
    );
    const types = reminders.map((r: { deadlineType: string }) => r.deadlineType);
    expect(types).not.toContain("pwd_expiration");
    // The window closes 180 days from the first step, not at the PWD's expiry.
    expect(reminders).toContainEqual(expect.objectContaining({ deadlineType: "filing_window_closes", daysUntilDeadline: CLOSES_IN() }));
  });

  it("the reminder job still flags a passed PWD when recruitment began before the determination", async () => {
    const t = createTestContext();
    const { authT } = await userWithProfile(t, "Before Person");
    await authT.mutation(api.cases.create, beganBefore());
    await finishScheduledFunctions(t);
    const reminders = (await t.query(internal.scheduledJobs.getCasesNeedingReminders, {})).filter(
      (r: { employerName: string }) => r.employerName === "Before Co",
    );
    expect(reminders.some((r: { daysUntilDeadline: number }) => r.daysUntilDeadline < 0)).toBe(true);
  });

  it("the dashboard shows no overdue PWD for recruitment begun inside it, and the window's close ahead", async () => {
    const t = createTestContext();
    const { authT } = await userWithProfile(t, "Dash Person");
    await authT.mutation(api.cases.create, beganInside());
    await finishScheduledFunctions(t);
    const groups = await authT.query(api.dashboard.getDeadlines, {});
    const all = [...groups.overdue, ...groups.thisWeek, ...groups.thisMonth, ...groups.later];
    expect(groups.overdue).toEqual([]);
    expect(all.map((d: { type: string }) => d.type)).not.toContain("pwd_expiration");
    expect(all).toContainEqual(expect.objectContaining({ daysUntil: CLOSES_IN() }));
  });

  it("auto-close leaves a case open when recruitment began inside the PWD, and closes one where it didn't", async () => {
    const t = createTestContext();
    const { authT } = await userWithProfile(t, "Close Person", true);
    const inside = await authT.mutation(api.cases.create, beganInside());
    const before = await authT.mutation(api.cases.create, beganBefore());
    await finishScheduledFunctions(t);
    await authT.mutation(api.deadlineEnforcement.checkAndEnforceDeadlines, {});
    await finishScheduledFunctions(t);
    const [a, b] = await t.run(async (ctx) => [await ctx.db.get(inside), await ctx.db.get(before)]);
    expect(a?.caseStatus).not.toBe("closed");
    expect(b?.caseStatus).toBe("closed");
  });

  it("a denial reaches the reminder job, the dashboard and the notification wording", async () => {
    const t = createTestContext();
    const { authT } = await userWithProfile(t, "Denial Person");
    await authT.mutation(api.cases.create, denied());
    await finishScheduledFunctions(t);

    const reminders = (await t.query(internal.scheduledJobs.getCasesNeedingReminders, {})).filter(
      (r: { employerName: string }) => r.employerName === "Denied Co",
    );
    expect(reminders).toContainEqual(expect.objectContaining({ deadlineType: "denial_review_due", daysUntilDeadline: 7 }));

    const groups = await authT.query(api.dashboard.getDeadlines, {});
    const all = [...groups.overdue, ...groups.thisWeek, ...groups.thisMonth, ...groups.later];
    expect(all).toContainEqual(expect.objectContaining({ type: "denial_review_due", daysUntil: 7 }));

    const title = generateNotificationTitle("deadline_reminder", { deadlineType: "denial_review_due", daysUntilDeadline: 7 });
    expect(title).toMatch(/^Reconsideration or BALCA request due in 7 days$/);
  });

  it("Google Calendar sync reads the denial and the determination date", async () => {
    const t = createTestContext();
    const { authT } = await userWithProfile(t, "Sync Person");
    const deniedId = await authT.mutation(api.cases.create, denied());
    const insideId = await authT.mutation(api.cases.create, beganInside());
    await finishScheduledFunctions(t);

    const d = await t.query(internal.googleCalendarSync.getCaseForCalendarSync, { caseId: deniedId });
    const dEvents = extractCalendarEvents(d!, getDefaultCalendarPreferences()).events.map((e) => `${e.eventType}@${e.date}`);
    expect(dEvents).toContain(`denial_review_due@${day(7)}`);

    const i = await t.query(internal.googleCalendarSync.getCaseForCalendarSync, { caseId: insideId });
    expect(i?.pwdDeterminationDate).toBe(day(-200));
    const iEvents = extractCalendarEvents(i!, getDefaultCalendarPreferences()).events.map((e) => e.eventType);
    expect(iEvents).toContain("filing_window_closes");
    expect(iEvents).not.toContain("pwd_expiration");
  });
});
