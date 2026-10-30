import { describe, it, expect } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { buildDefaultProfile } from "../lib/userDefaults";
import { getAdminDashboardDataHelper } from "../lib/admin";

// "Active" on the admin page means the person used the app in the last 30
// days (owner, Oct 30 2026), read from sign-ins and the app's heartbeat. It had
// counted every undeleted account: 266 of 267.

const DAY = 24 * 60 * 60 * 1000;
type Use = { login?: number; heartbeat?: number; touched?: number };

/** The dashboard for one account with this role and this use. */
async function dashboardFor(role: string, use: Use) {
  const t = createTestContext();
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: role, email: "one@example.com" });
    const now = Date.now();
    await ctx.db.insert("userProfiles", {
      ...buildDefaultProfile(userId),
      jobTitle: role,
      lastLoginAt: now - (use.login ?? 200) * DAY,
      ...(use.heartbeat !== undefined ? { lastActiveAt: now - use.heartbeat * DAY } : {}),
      updatedAt: now - (use.touched ?? 200) * DAY,
    });
    return await getAdminDashboardDataHelper(ctx);
  });
}

describe("admin dashboard: active in 30 days", () => {
  it("counts a sign-in in the last 30 days, practice accounts on their own line", async () => {
    const d = await dashboardFor("Immigration Attorney", { login: 5 });
    expect([d.activeUsers, d.activePracticeUsers, d.practiceUsers]).toEqual([1, 1, 1]);
  });

  it("counts the app's heartbeat when the last sign-in is older", async () => {
    const d = await dashboardFor("Paralegal", { login: 90, heartbeat: 2 });
    expect([d.activeUsers, d.activePracticeUsers]).toEqual([1, 1]);
  });

  it("never counts a background write to the profile (a token refresh, an email link)", async () => {
    const d = await dashboardFor("Immigration Attorney", { login: 90, touched: 1 });
    expect([d.activeUsers, d.activePracticeUsers, d.practiceUsers]).toEqual([0, 0, 1]);
  });

  it("counts someone tracking their own case as active, but not in practice", async () => {
    const d = await dashboardFor("Waiting on my own case", { login: 1 });
    expect([d.activeUsers, d.activePracticeUsers]).toEqual([1, 0]);
  });
});
