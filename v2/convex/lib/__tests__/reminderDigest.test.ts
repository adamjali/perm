import { describe, it, expect } from "vitest";
import type { Id } from "../../_generated/dataModel";
import {
  reminderToDigestItem,
  groupRemindersByUser,
  type DigestReminderInput,
} from "../reminderDigest";

const uid = (s: string) => s as unknown as Id<"users">;
const cid = (s: string) => s as unknown as Id<"cases">;

function makeReminder(over: Partial<DigestReminderInput> = {}): DigestReminderInput {
  return {
    userId: uid("u1"),
    to: "a@b.com",
    userName: "Jake",
    caseId: cid("c1"),
    employerName: "Acme",
    beneficiaryIdentifier: "B1",
    deadlineType: "pwd_expiration",
    deadlineDate: "2026-07-10",
    daysUntil: 7,
    ...over,
  };
}

describe("reminderToDigestItem", () => {
  it("formats the raw deadline type for display", () => {
    expect(reminderToDigestItem(makeReminder({ deadlineType: "pwd_expiration" })).deadlineType).toBe(
      "PWD Expiration"
    );
    expect(reminderToDigestItem(makeReminder({ deadlineType: "rfi_due" })).deadlineType).toBe(
      "RFI Response Due"
    );
    // Recruitment types the cron emits must be formatted, not shown raw.
    expect(
      reminderToDigestItem(makeReminder({ deadlineType: "recruitment_window_closes" })).deadlineType
    ).toBe("Recruitment Window Closes");
    expect(
      reminderToDigestItem(makeReminder({ deadlineType: "first_sunday_ad_deadline" })).deadlineType
    ).toBe("First Sunday Ad");
  });

  it("derives urgency from daysUntil", () => {
    expect(reminderToDigestItem(makeReminder({ daysUntil: -1 })).urgency).toBe("overdue");
    expect(reminderToDigestItem(makeReminder({ daysUntil: 1 })).urgency).toBe("urgent");
    expect(reminderToDigestItem(makeReminder({ daysUntil: 10 })).urgency).toBe("upcoming");
    // The 30-day interval must NOT be dropped — it maps to "later", not lost.
    expect(reminderToDigestItem(makeReminder({ daysUntil: 30 })).urgency).toBe("later");
  });

  it("carries through case identity and date", () => {
    const item = reminderToDigestItem(
      makeReminder({ caseId: cid("c9"), employerName: "Globex", beneficiaryIdentifier: "Jane", deadlineDate: "2026-08-01" })
    );
    expect(item).toMatchObject({ caseId: "c9", employerName: "Globex", beneficiaryIdentifier: "Jane", deadlineDate: "2026-08-01" });
  });
});

describe("groupRemindersByUser", () => {
  it("collapses one user's many reminders into a single digest (the cap fix)", () => {
    // Mirrors the real incident: one attorney, 3 cases all due in 1 day.
    const reminders = [
      makeReminder({ userId: uid("jake"), to: "jake@firm.com", caseId: cid("c1"), daysUntil: 1 }),
      makeReminder({ userId: uid("jake"), to: "jake@firm.com", caseId: cid("c2"), daysUntil: 1 }),
      makeReminder({ userId: uid("jake"), to: "jake@firm.com", caseId: cid("c3"), daysUntil: 1 }),
    ];
    const digests = groupRemindersByUser(reminders);
    expect(digests).toHaveLength(1); // ONE email, not three
    expect(digests[0]!.to).toBe("jake@firm.com");
    expect(digests[0]!.items).toHaveLength(3);
  });

  it("keeps separate users in separate digests", () => {
    const digests = groupRemindersByUser([
      makeReminder({ userId: uid("a"), to: "a@x.com" }),
      makeReminder({ userId: uid("b"), to: "b@x.com" }),
    ]);
    expect(digests).toHaveLength(2);
    expect(digests.map((d) => d.to).sort()).toEqual(["a@x.com", "b@x.com"]);
  });

  it("sorts each user's items overdue-first, then soonest date", () => {
    const digests = groupRemindersByUser([
      makeReminder({ caseId: cid("c1"), daysUntil: 7, deadlineDate: "2026-07-10" }),
      makeReminder({ caseId: cid("c2"), daysUntil: -2, deadlineDate: "2026-06-27" }),
      makeReminder({ caseId: cid("c3"), daysUntil: 1, deadlineDate: "2026-06-30" }),
    ]);
    expect(digests[0]!.items.map((i) => i.daysUntil)).toEqual([-2, 1, 7]);
  });

  it("returns an empty array when nothing is due", () => {
    expect(groupRemindersByUser([])).toEqual([]);
  });
});
