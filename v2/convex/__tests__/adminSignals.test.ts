import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { api } from "../_generated/api";

// requireAdmin() reads ADMIN_EMAIL from process.env at call time. Pin it so
// the admin-path test asserts the real authorization flow instead of silently
// no-opping where ADMIN_EMAIL is unset (e.g. CI).
const TEST_ADMIN_EMAIL = "admin@signals-test.com";

describe("adminSignals.getSignals", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAIL", TEST_ADMIN_EMAIL);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refuses everyone who is not the admin", async () => {
    const t = createTestContext();
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "stranger@example.com" }),
    );
    const auth = t.withIdentity({
      subject: userId,
      email: "stranger@example.com",
    });
    await expect(auth.query(api.adminSignals.getSignals, {})).rejects.toThrow(
      /Admin access required/,
    );
  });

  it("shapes signups, subscriptions and case additions for the panel", async () => {
    const t = createTestContext();
    const adminId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: TEST_ADMIN_EMAIL }),
    );
    const memberId = await t.run(async (ctx) =>
      ctx.db.insert("users", { email: "member@example.com" }),
    );
    const now = Date.now();
    await t.run(async (ctx) => {
      await ctx.db.insert("caseStatusAlerts", {
        email: "sub@example.com",
        caseNumber: "G-100-25324-425560",
        createdAt: now,
        confirmedAt: now,
        lastSeenStatus: "ANALYST REVIEW",
      });
      await ctx.db.insert("dolQueueAlerts", {
        email: "sub@example.com",
        filingMonth: "2025-11",
        queue: "pwd-oews",
        createdAt: now,
      });
      await ctx.db.insert("newsSubscribers", {
        email: "sub@example.com",
        createdAt: now,
        unsubscribedAt: now,
      });
      // The cases table carries the whole case-management shape; only the
      // fields this panel reads are interesting, the rest are the minimal
      // valid skeleton (mirrors chatCaseData.test.ts's factory).
      await ctx.db.insert("cases", {
        userId: memberId,
        employerName: "ACME Robotics",
        positionTitle: "Engineer",
        caseNumber: "G-100-26100-111111",
        caseStatus: "pwd",
        progressStatus: "working",
        rfiEntries: [],
        rfeEntries: [],
        notes: [],
        isProfessionalOccupation: false,
        isFavorite: false,
        priorityLevel: "normal",
        tags: [],
        calendarSyncEnabled: true,
        documents: [],
        recruitmentApplicantsCount: 0,
        additionalRecruitmentMethods: [],
        createdAt: now,
        updatedAt: now,
      });
    });

    const auth = t.withIdentity({ subject: adminId, email: TEST_ADMIN_EMAIL });
    const s = await auth.query(api.adminSignals.getSignals, {});

    expect(s.totals.users).toBe(2);
    expect(s.recentUsers.map((u) => u.email)).toContain("member@example.com");

    expect(s.subscriptions.caseAlerts).toHaveLength(1);
    expect(s.subscriptions.caseAlerts[0]).toMatchObject({
      subject: "G-100-25324-425560",
      status: "confirmed",
    });
    // A pending (unconfirmed) row must SAY pending - an admin reading
    // "1 subscriber" for a typo'd address that never confirmed would be
    // reading a number that is not true.
    expect(s.subscriptions.queueAlerts[0]).toMatchObject({
      subject: "PWD OEWS · 2025-11",
      status: "pending",
    });
    expect(s.subscriptions.news[0]?.status).toBe("unsubscribed");

    expect(s.recentCases[0]).toMatchObject({
      email: "member@example.com",
      employerName: "ACME Robotics",
      caseNumber: "G-100-26100-111111",
    });
  });
});
