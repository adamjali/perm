import { describe, expect, it } from "vitest";

import { approvalRate, RECENT_MIN_DECISIONS, type DecidedDay } from "../approvalRate";

// perm_docs['cases_meta'] as it read on Nov 4 2026.
const META = {
  totalCases: 373939,
  firstDecisionDate: "2023-10-01",
  lastDecisionDate: "2026-06-30",
  byStatus: [
    { status: "certified", count: 343773 },
    { status: "denied", count: 11357 },
    { status: "withdrawn", count: 18809 },
  ],
};

const days = (n: number, per: DecidedDay = { date: "", total: 600, certified: 560, denied: 20, withdrawn: 20 }): DecidedDay[] =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2026, 10, 3 - i));
    return { ...per, date: d.toISOString().slice(0, 10) };
  });

describe("approvalRate", () => {
  it("says DOL's share with its count, its dates and what withdrawals do to it", () => {
    const r = approvalRate(META, [])!;
    expect(r.rate).toBe("91.9%");
    expect(r.files).toBe(
      "91.9% of the 373,939 PERM cases DOL decided from October 1, 2023 to June 30, 2026 were certified, by DOL's own disclosure files, withdrawals included: 3.0% were denied and 5.0% withdrawn.",
    );
    expect(r.recent).toBeNull();
  });

  it("adds the last 30 days our check saw, counting only those 30 days", () => {
    const r = approvalRate(META, days(40))!;
    expect(r.recent).toBe(
      "In the 30 days to November 3, 2026, our daily check of DOL's case status saw 18,000 PERM decisions, and 93.3% of them were certified.",
    );
  });

  it("quotes no recent share from too few decisions", () => {
    const thin = days(30, { date: "", total: Math.floor(RECENT_MIN_DECISIONS / 30) - 1, certified: 10, denied: 1, withdrawn: 1 });
    expect(approvalRate(META, thin)!.recent).toBeNull();
  });

  it("hands the homepage's bar its parts: each outcome's count and share, the window, the last 30 days", () => {
    const r = approvalRate(META, days(40))!;
    expect(r.parts).toEqual({
      total: 373939,
      from: "2023-10-01",
      to: "2026-06-30",
      outcomes: [
        { key: "certified", n: 343773, share: "91.9%" },
        { key: "denied", n: 11357, share: "3.0%" },
        { key: "withdrawn", n: 18809, share: "5.0%" },
      ],
      recent: { to: "2026-11-03", n: 18000, share: "93.3%" },
    });
    expect(approvalRate(META, [])!.parts.recent).toBeNull();
  });

  it("reads a renamed or missing field as no figure, never a NaN", () => {
    expect(approvalRate(null, [])).toBeNull();
    expect(approvalRate({ ...META, totalCases: "373939" }, [])).toBeNull();
    expect(approvalRate({ ...META, byStatus: [{ status: "approved", count: 1 }] }, [])).toBeNull();
    expect(approvalRate({ ...META, lastDecisionDate: "June 2026" }, [])).toBeNull();
  });
});
