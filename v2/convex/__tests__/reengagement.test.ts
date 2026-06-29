import { describe, it, expect } from "vitest";
import {
  createTestContext,
  createAuthenticatedContext,
} from "../../test-utils/convex";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Create a verified user + profile in a given re-engagement state.
 * lastActiveDaysAgo / nudgedDaysAgo are relative to now (undefined = unset).
 */
async function makeUser(
  t: ReturnType<typeof createTestContext>,
  name: string,
  opts: {
    emailWeeklyDigest: boolean;
    lastActiveDaysAgo?: number;
    nudgedDaysAgo?: number;
    suppressed?: boolean;
  }
) {
  const authT = await createAuthenticatedContext(t, name);
  const userId = await authT.run(
    async (ctx) => (await ctx.auth.getUserIdentity())!.subject as Id<"users">
  );
  const email = `${name.toLowerCase().replace(/\s/g, ".")}@example.com`;
  const now = Date.now();

  const profileId = await authT.run(async (ctx) => {
    await ctx.db.patch(userId, { email });
    await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: email,
      emailVerified: email,
    });
    return await ctx.db.insert("userProfiles", {
      userId,
      userType: "individual",
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      pushNotificationsEnabled: false,
      urgentDeadlineDays: 7,
      reminderDaysBefore: [1, 3, 7, 14, 30],
      emailDeadlineReminders: true,
      emailStatusUpdates: false,
      emailRfeAlerts: true,
      emailWeeklyDigest: opts.emailWeeklyDigest,
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
      autoDeadlineEnforcementEnabled: false,
      lastActiveAt:
        opts.lastActiveDaysAgo !== undefined
          ? now - opts.lastActiveDaysAgo * DAY
          : undefined,
      reengagementNudgeSentAt:
        opts.nudgedDaysAgo !== undefined ? now - opts.nudgedDaysAgo * DAY : undefined,
      weeklyDigestSuppressedAt: opts.suppressed ? now : undefined,
      createdAt: now - 300 * DAY, // old account so createdAt fallback is inactive
      updatedAt: now,
    });
  });

  return { userId, authT, profileId, email };
}

async function getProfile(authT: Awaited<ReturnType<typeof makeUser>>["authT"], profileId: Id<"userProfiles">) {
  return await authT.run(async (ctx) => ctx.db.get(profileId));
}

describe("runReengagementCheck", () => {
  it("nudges an inactive user with the weekly digest on (first time)", async () => {
    const t = createTestContext();
    const u = await makeUser(t, "Inactive Ann", {
      emailWeeklyDigest: true,
      lastActiveDaysAgo: 90,
    });

    const result = await t.action(internal.reengagement.runReengagementCheck, {});

    expect(result.nudged).toBe(1);
    expect(result.suppressed).toBe(0);
    const profile = await getProfile(u.authT, u.profileId);
    expect(profile?.reengagementNudgeSentAt).toBeTypeOf("number");
    // Still on — only nudged, not yet paused.
    expect(profile?.emailWeeklyDigest).toBe(true);
    expect(profile?.weeklyDigestSuppressedAt).toBeUndefined();
  });

  it("pauses the weekly digest when a nudge goes unanswered past the grace period", async () => {
    const t = createTestContext();
    const u = await makeUser(t, "Ghost Gary", {
      emailWeeklyDigest: true,
      lastActiveDaysAgo: 90,
      nudgedDaysAgo: 20, // > 14-day grace, and no activity since
    });

    const result = await t.action(internal.reengagement.runReengagementCheck, {});

    expect(result.suppressed).toBe(1);
    expect(result.nudged).toBe(0);
    const profile = await getProfile(u.authT, u.profileId);
    expect(profile?.emailWeeklyDigest).toBe(false);
    expect(profile?.weeklyDigestSuppressedAt).toBeTypeOf("number");
  });

  it("does NOT touch an active user", async () => {
    const t = createTestContext();
    const u = await makeUser(t, "Active Amy", {
      emailWeeklyDigest: true,
      lastActiveDaysAgo: 2,
    });

    const result = await t.action(internal.reengagement.runReengagementCheck, {});

    expect(result.nudged).toBe(0);
    expect(result.suppressed).toBe(0);
    const profile = await getProfile(u.authT, u.profileId);
    expect(profile?.reengagementNudgeSentAt).toBeUndefined();
  });

  it("ignores users who don't have the weekly digest on", async () => {
    const t = createTestContext();
    const u = await makeUser(t, "Optout Otto", {
      emailWeeklyDigest: false,
      lastActiveDaysAgo: 90,
    });

    const result = await t.action(internal.reengagement.runReengagementCheck, {});

    expect(result.nudged).toBe(0);
    const profile = await getProfile(u.authT, u.profileId);
    expect(profile?.reengagementNudgeSentAt).toBeUndefined();
  });

  it("does not pause again if already suppressed", async () => {
    const t = createTestContext();
    await makeUser(t, "Already Al", {
      emailWeeklyDigest: false, // already paused → not a candidate
      lastActiveDaysAgo: 90,
      nudgedDaysAgo: 30,
      suppressed: true,
    });

    const result = await t.action(internal.reengagement.runReengagementCheck, {});

    expect(result.nudged).toBe(0);
    expect(result.suppressed).toBe(0);
  });
});
