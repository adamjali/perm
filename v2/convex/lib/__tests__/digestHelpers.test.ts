import { describe, it, expect } from "vitest";
import { buildDigestContent } from "../digestHelpers";
import type { RawDeadlineData, RawCaseUpdateData } from "../digestHelpers";
import type { Id } from "../../_generated/dataModel";

// FIXTURES

const CASE_ID = "case-1" as Id<"cases">;
// isEmpty is independent of "today" (it reads pre-computed daysUntil), but a fixed
// date keeps weekStart/weekEnd deterministic.
const FIXED_TODAY = new Date("2026-06-08T00:00:00Z");

function deadline(daysUntil: number): RawDeadlineData {
  return {
    caseId: CASE_ID,
    employerName: "Acme Corp",
    beneficiaryIdentifier: "BEN-1",
    deadlineType: "pwd_expiration",
    deadlineDate: "2026-06-20",
    daysUntil,
  };
}

function caseUpdate(): RawCaseUpdateData {
  return {
    caseId: CASE_ID,
    employerName: "Acme Corp",
    beneficiaryIdentifier: "BEN-1",
    caseStatus: "pwd",
    updatedAt: 1_700_000_000_000,
  };
}

function build(overrides: {
  rawDeadlines?: RawDeadlineData[];
  rawCaseUpdates?: RawCaseUpdateData[];
  unreadNotificationCount?: number;
  totalActiveCases?: number;
}) {
  return buildDigestContent({
    userName: "Tester",
    userEmail: "tester@example.com",
    totalActiveCases: overrides.totalActiveCases ?? 1,
    unreadNotificationCount: overrides.unreadNotificationCount ?? 0,
    rawDeadlines: overrides.rawDeadlines ?? [],
    rawCaseUpdates: overrides.rawCaseUpdates ?? [],
    today: FIXED_TODAY,
  });
}

// buildDigestContent — isEmpty: the canonical flag the A2 cost-control gate keys on.
// sendWeeklyDigest skips the email when isEmpty === true, so isEmpty MUST be false
// whenever the user has any actionable content (a deadline in any bucket OR a recent
// case update) and true only when there is none. Each signal is isolated so a future
// narrowing of the gate (e.g. forgetting the case-update term) fails loudly here.

describe("buildDigestContent — isEmpty (A2 weekly-digest gate)", () => {
  const SENDS_WHEN: Array<[string, Parameters<typeof build>[0]]> = [
    ["an overdue deadline (daysUntil < 0)", { rawDeadlines: [deadline(-3)] }],
    ["an upcoming deadline (next 7 days)", { rawDeadlines: [deadline(5)] }],
    ["a later deadline (days 8-14)", { rawDeadlines: [deadline(12)] }],
    ["only a recent case update (no deadline)", { rawCaseUpdates: [caseUpdate()] }],
  ];

  it.each(SENDS_WHEN)("is false (sends) when the user has %s", (_label, overrides) => {
    expect(build(overrides).isEmpty).toBe(false);
  });

  it("is true (skips) when there are no deadlines and no case updates", () => {
    expect(build({}).isEmpty).toBe(true);
  });

  it("is true (skips) when the user only has unread notifications", () => {
    // Documents the deliberate exclusion of unreadNotificationCount from isEmpty —
    // an unread badge alone is not strong enough to earn a (Resend-cap-spending) send.
    const content = build({ unreadNotificationCount: 5, totalActiveCases: 2 });
    expect(content.stats.unreadNotificationCount).toBe(5);
    expect(content.isEmpty).toBe(true);
  });

  it("routes deadlines into the three buckets that feed isEmpty", () => {
    const content = build({ rawDeadlines: [deadline(-3), deadline(5), deadline(12)] });
    expect(content.overdueDeadlines).toHaveLength(1);
    expect(content.next7DaysDeadlines).toHaveLength(1);
    expect(content.next14DaysDeadlines).toHaveLength(1);
    expect(content.isEmpty).toBe(false);
  });
});
