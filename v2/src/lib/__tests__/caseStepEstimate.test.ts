import { describe, expect, it } from "vitest";

import { caseStepEstimate } from "@/lib/caseStepEstimate";
import type { AppCaseCorpus } from "@/lib/db/appCaseCorpus";

const TODAY = "2026-10-30";

// A corpus rich enough to yield both a PERM decision estimate (a filing ahead of
// the Dec-2025 frontier) and a wage-determination estimate.
const CORPUS: AppCaseCorpus = {
  backlog: [
    { month: "2025-06", total: 14000, pending: 200, decided: 13800, decidedPct: 0.99, analystReview: 150 },
    { month: "2025-12", total: 18000, pending: 9000, decided: 9000, decidedPct: 0.5, analystReview: 8000 },
    { month: "2026-01", total: 17000, pending: 14000, decided: 3000, decidedPct: 0.18, analystReview: 13000 },
    { month: "2026-02", total: 16000, pending: 15000, decided: 1000, decidedPct: 0.06, analystReview: 14000 },
  ],
  estimator: {
    frontier: { analystQueueMonth: "2025-12", officialAvgDays: 336, asOf: "2026-10-28" },
    cohorts: [],
    frontierHistory: [],
    frontierAdvance: { rate: 1, fromMonth: "2025-06", toMonth: "2025-12", pointsUsed: 6, slowest: 0.5, fastest: 1.5 },
    disclosure: null,
  },
  decisionPace: { pace: 620, fast: 780, slow: 480, weekdayMean: 790, weekendMean: 210, weekdaysUsed: 20, daysUsed: 28 },
  sweepFinishedOn: "2026-10-28",
  stragglers: null,
  rangeCoverage: null,
  rfiClock: null,
  byDay: null,
  stageStats: null,
  pwdDay: {
    queue: {
      asOf: "2026-10-28",
      byDay: [
        ["2026-09-01", 500],
        ["2026-09-15", 400],
        ["2026-10-01", 300],
      ],
      pace: { perWorkday: 250, fast: 300, slow: 200, workdaysUsed: 20 },
    },
    measuredRange: [],
    tested: null,
  },
};

describe("caseStepEstimate", () => {
  it("estimates the PERM decision from the ETA-9089 filing date, no number needed", () => {
    const r = caseStepEstimate({ corpus: CORPUS, caseStatus: "eta9089", eta9089FilingDate: "2026-01-15", today: TODAY });
    expect(r.step).toBe("perm");
    if (r.step === "perm") {
      expect(r.filingDate).toBe("2026-01-15");
      expect(r.perm.estimate).not.toBeNull();
    }
  });

  it("estimates the wage determination from the PWD filing date at the PWD step", () => {
    const r = caseStepEstimate({ corpus: CORPUS, caseStatus: "pwd", pwdFilingDate: "2026-10-10", today: TODAY });
    expect(r.step).toBe("pwd");
    if (r.step === "pwd") {
      expect(r.filingDate).toBe("2026-10-10");
      expect(r.pwd.kind).toBe("estimate");
    }
  });

  it("estimates the PERM step when both dates exist (the case is further along)", () => {
    const r = caseStepEstimate({
      corpus: CORPUS,
      caseStatus: "eta9089",
      pwdFilingDate: "2025-10-01",
      eta9089FilingDate: "2026-01-15",
      today: TODAY,
    });
    expect(r.step).toBe("perm");
  });

  it("falls back to the case number's decoded filing date when no date is entered", () => {
    const r = caseStepEstimate({ corpus: CORPUS, caseNumber: "G-100-26015-123456", today: TODAY });
    expect(r.step).toBe("perm");
    if (r.step === "perm") expect(r.filingDate).toBe("2026-01-15");
  });

  it("carries DOL's live status onto the PERM estimate when the watched number is a PERM one", () => {
    const r = caseStepEstimate({
      corpus: CORPUS,
      caseNumber: "G-100-26015-123456",
      liveStatus: "ANALYST REVIEW",
      today: TODAY,
    });
    expect(r.step).toBe("perm");
    if (r.step === "perm") expect(r.liveStatus).toBe("ANALYST REVIEW");
  });

  it("gives no estimate when nothing is filed with DOL", () => {
    expect(caseStepEstimate({ corpus: CORPUS, caseStatus: "pwd", today: TODAY }).step).toBeNull();
  });

  it("gives no estimate once the wage determination is in and the PERM is not yet filed", () => {
    const r = caseStepEstimate({
      corpus: CORPUS,
      caseStatus: "recruitment",
      pwdFilingDate: "2026-10-10",
      pwdDeterminationDate: "2026-10-25",
      today: TODAY,
    });
    expect(r.step).toBeNull();
  });

  it("returns nothing with no corpus", () => {
    expect(caseStepEstimate({ corpus: null, eta9089FilingDate: "2026-01-15", today: TODAY }).step).toBeNull();
  });
});
