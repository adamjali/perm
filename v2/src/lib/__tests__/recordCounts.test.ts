import { describe, expect, it } from "vitest";

import { deriveRecordCounts, type RecordDocs } from "../recordCounts";

const docs: RecordDocs = {
  casesMeta: JSON.stringify({ totalCases: 373939, lastDecisionDate: "2026-06-30" }),
  liveRemainder: JSON.stringify({ total: 140276, pending: 96578, asOf: "2026-09-07T19:55:13Z" }),
  sweepCoverage: JSON.stringify({ finishedOn: "2026-09-07", mode: "pending" }),
  pwSummary: JSON.stringify({ rows: 634638, latestDecision: "2026-06-30" }),
  lcaSummary: JSON.stringify({ rows: 437496, latestDecision: "2026-06-30" }),
  bulletinCount: 84,
  bulletinLatest: "2026-09",
};

describe("deriveRecordCounts", () => {
  it("prints five dated figures, each with the date its own document carries", () => {
    const figures = deriveRecordCounts(docs);
    expect(figures.map((f) => [f.value, f.asOf, f.asOfKind])).toEqual([
      [373939, "2026-06-30", "through"],
      [96578, "2026-09-07", "checked"],
      [634638, "2026-06-30", "through"],
      [437496, "2026-06-30", "through"],
      [84, "2026-09", "newest"],
    ]);
    expect(new Set(figures.map((f) => f.href)).size).toBe(5);
  });

  it("dates the pending count by the SWEEP, not by the remainder doc's own stamp", () => {
    const [, pending] = deriveRecordCounts({ ...docs, sweepCoverage: JSON.stringify({ finishedOn: "2026-09-05" }) });
    expect(pending?.asOf).toBe("2026-09-05");
  });

  it("leaves a figure out when its document is missing, malformed, or undated", () => {
    expect(deriveRecordCounts({ ...docs, casesMeta: null }).map((f) => f.href)).not.toContain("/case-search");
    expect(deriveRecordCounts({ ...docs, pwSummary: "{not json" }).map((f) => f.href)).not.toContain("/pwd-cases");
    expect(deriveRecordCounts({ ...docs, lcaSummary: JSON.stringify({ rows: 10 }) }).map((f) => f.href)).not.toContain("/lca-cases");
    // A pending count with no sweep date is a number with no "when": withheld.
    expect(deriveRecordCounts({ ...docs, sweepCoverage: null }).map((f) => f.href)).not.toContain("/perm-case-status");
    expect(deriveRecordCounts({ ...docs, bulletinCount: 0 }).map((f) => f.href)).not.toContain("/visa-bulletin");
  });

  it("returns nothing at all when nothing is held", () => {
    expect(
      deriveRecordCounts({ casesMeta: null, liveRemainder: null, sweepCoverage: null, pwSummary: null, lcaSummary: null, bulletinCount: null, bulletinLatest: null }),
    ).toEqual([]);
  });
});
