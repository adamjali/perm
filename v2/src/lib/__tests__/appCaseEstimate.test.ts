/**
 * The pure wrapper that turns a saved case + the shared corpus into its
 * estimate (src/lib/appCaseEstimate.ts). The estimator internals are covered
 * by caseEstimate's own tests; this proves the WIRING: the queue inputs come
 * from the backlog and the case's filing day, and the composition is pure.
 *
 * @module
 */

import { describe, it, expect } from "vitest";
import { appCaseEstimate } from "../appCaseEstimate";
import type { AppCaseCorpus } from "../db/appCaseCorpus";

function corpus(overrides: Partial<AppCaseCorpus> = {}): AppCaseCorpus {
  return {
    backlog: [
      { month: "2025-06", total: 100, pending: 0, decided: 100, decidedPct: 1, analystReview: 0 },
      { month: "2026-01", total: 200, pending: 150, decided: 50, decidedPct: 0.25, analystReview: 140 },
    ],
    estimator: {
      frontier: { analystQueueMonth: "2025-06", officialAvgDays: 336, asOf: "2026-10-28" },
      cohorts: [],
      frontierHistory: [],
      frontierAdvance: {
        rate: 1,
        fromMonth: "2025-01",
        toMonth: "2025-06",
        pointsUsed: 6,
        slowest: 0.5,
        fastest: 1.5,
      },
      disclosure: null,
    },
    decisionPace: null,
    sweepFinishedOn: "2026-10-28",
    stragglers: null,
    rangeCoverage: null,
    rfiClock: null,
    byDay: null,
    stageStats: null,
    ...overrides,
  };
}

const TODAY = "2026-10-29";

describe("appCaseEstimate wiring", () => {
  it("counts cases ahead from the backlog and the case's own filing day", () => {
    const res = appCaseEstimate({
      corpus: corpus(),
      filingDate: "2026-01-15",
      status: "ANALYST REVIEW",
      isFinal: false,
      today: TODAY,
    });
    // 140 analyst-review cases in the reader's own month; a mid-month filing is
    // behind the earlier part of it, so some are ahead.
    expect(res.casesAhead).not.toBeNull();
    expect(res.casesAhead!).toBeGreaterThan(0);
    expect(res.lineAhead).not.toBeNull();
    expect(Array.isArray(res.lineAhead)).toBe(true);
  });

  it("withholds the queue inputs when the case has no filing date", () => {
    const res = appCaseEstimate({
      corpus: corpus(),
      filingDate: null,
      status: null,
      isFinal: false,
      today: TODAY,
    });
    expect(res.casesAhead).toBeNull();
    expect(res.lineAhead).toBeNull();
    // Still returns an estimate object (a no-date reading), never throws.
    expect(res.estimate === null || typeof res.estimate.kind === "string").toBe(true);
  });

  it("is pure and deterministic for the same inputs", () => {
    const a = appCaseEstimate({ corpus: corpus(), filingDate: "2026-01-15", status: "ANALYST REVIEW", isFinal: false, today: TODAY });
    const b = appCaseEstimate({ corpus: corpus(), filingDate: "2026-01-15", status: "ANALYST REVIEW", isFinal: false, today: TODAY });
    expect(b).toEqual(a);
  });

  it("handles a final status, a pending status and an empty corpus without throwing", () => {
    expect(() =>
      appCaseEstimate({ corpus: corpus(), filingDate: "2026-01-15", status: "CERTIFIED", isFinal: true, today: TODAY }),
    ).not.toThrow();
    expect(() =>
      appCaseEstimate({ corpus: corpus(), filingDate: "2026-01-15", status: "RFI ISSUED", isFinal: false, today: TODAY }),
    ).not.toThrow();
    const empty = appCaseEstimate({
      corpus: corpus({ backlog: [], estimator: null, sweepFinishedOn: null }),
      filingDate: "2026-01-15",
      status: "ANALYST REVIEW",
      isFinal: false,
      today: TODAY,
    });
    expect(empty.estimate === null || typeof empty.estimate.kind === "string").toBe(true);
  });
});
