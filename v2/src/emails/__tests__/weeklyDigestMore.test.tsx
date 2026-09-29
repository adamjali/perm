import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";

import { WeeklyDigest } from "../WeeklyDigest";
import type { DigestContent, DigestCaseUpdate } from "../../../convex/lib/digestHelpers";
import type { Id } from "../../../convex/_generated/dataModel";

/**
 * The "+N more" line counts every update this week, not the list the server
 * already cut to 10: 30 updates used to read as "+5 more" (Sep 29 2026 audit).
 */
const update = (i: number): DigestCaseUpdate => ({
  caseId: `case${i}` as Id<"cases">,
  employerName: `Employer ${i}`,
  beneficiaryIdentifier: `B${i}`,
  caseStatus: "pwd",
  updatedAt: 1_790_000_000_000 - i,
  changeDescription: "Status changed",
});

const content = (total: number | undefined): DigestContent => ({
  userName: "Test",
  userEmail: "t@example.com",
  weekStartDate: "2026-09-28",
  weekEndDate: "2026-10-04",
  stats: { totalActiveCases: 30, overdueCount: 0, urgentCount: 0, unreadNotificationCount: 0 },
  overdueDeadlines: [],
  next7DaysDeadlines: [],
  next14DaysDeadlines: [],
  recentCaseUpdates: Array.from({ length: 10 }, (_, i) => update(i)),
  recentCaseUpdateTotal: total,
  isEmpty: false,
  emptyMessage: "",
});

describe("weekly digest: more updates", () => {
  it("counts from the week's total, and links where the rest are", async () => {
    const html = await render(WeeklyDigest({ digestContent: content(30) }));
    expect(html).toContain("25 more updates this week");
    expect(html).toContain("https://permtracker.app/cases");
  });

  it("falls back to the list's own length for a digest built before the total existed", async () => {
    const html = await render(WeeklyDigest({ digestContent: content(undefined) }));
    expect(html).toContain("5 more updates this week");
  });
});
