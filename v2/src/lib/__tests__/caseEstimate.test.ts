import { describe, expect, it } from "vitest";

import { buildCaseEstimate } from "../caseEstimate";
import type { EstimatorData } from "../turso/estimate";

/**
 * The per-case estimate: the composite that finally answers "when could MY
 * case be decided" on the case-status page.
 *
 * The pieces are all tested elsewhere (queueEstimate's models, queueForecast's
 * stage placement); what this file pins is the COMPOSITION - which piece wins
 * for which case, and above all where it refuses. A wrong refusal is invisible
 * on the page (the block simply doesn't render) and a wrong answer looks
 * exactly like a right one, which is why every branch gets a test.
 */

const TODAY = "2026-08-28";

const ESTIMATOR: EstimatorData = {
  frontier: {
    analystQueueMonth: "2025-09",
    officialAvgDays: 372,
    asOf: "2026-08-20",
  },
  cohorts: [
    {
      cohortMonth: "2024-06",
      decided: 8200,
      totalReceived: 8400,
      p25: 410,
      p50: 455,
      p75: 505,
      p90: 540,
    },
  ],
  frontierAdvance: { rate: 1.8, slowest: 1.05, fastest: 2.0 },
  frontierHistory: [],
  disclosure: null,
} as unknown as EstimatorData;

describe("buildCaseEstimate", () => {
  it("returns null for a decided case: there is nothing left to estimate", () => {
    expect(
      buildCaseEstimate({
        filingDate: "2024-06-15",
        status: "CERTIFIED",
        isFinal: true,
        estimator: ESTIMATOR,
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("returns null without a filing date or estimator data", () => {
    expect(
      buildCaseEstimate({
        filingDate: null,
        status: "ANALYST REVIEW",
        isFinal: false,
        estimator: ESTIMATOR,
        today: TODAY,
      }),
    ).toBeNull();
    expect(
      buildCaseEstimate({
        filingDate: "2025-06-15",
        status: "ANALYST REVIEW",
        isFinal: false,
        estimator: null,
        today: TODAY,
      }),
    ).toBeNull();
  });

  it("gives an analyst-review case the cohort estimate at the median, unshifted", () => {
    const e = buildCaseEstimate({
      filingDate: "2025-06-15",
      status: "ANALYST REVIEW",
      isFinal: false,
      estimator: ESTIMATOR,
      today: TODAY,
    });
    expect(e).not.toBeNull();
    if (e?.kind !== "date") throw new Error("expected a dated estimate");
    expect(e.stage?.percentile).toBe(50);
    // Median placement multiplies by 1.0: the date is the model's own.
    expect(e.estimatedDate).toBe(e.modelDate);
  });

  it("shifts an RFI case to its cohort's p90, later than the median read", () => {
    const median = buildCaseEstimate({
      filingDate: "2025-06-15",
      status: "ANALYST REVIEW",
      isFinal: false,
      estimator: ESTIMATOR,
      today: TODAY,
    });
    const rfi = buildCaseEstimate({
      filingDate: "2025-06-15",
      status: "RFI ISSUED",
      isFinal: false,
      estimator: ESTIMATOR,
      today: TODAY,
    });
    if (median?.kind !== "date" || rfi?.kind !== "date") {
      throw new Error("expected dated estimates");
    }
    expect(rfi.stage?.percentile).toBe(90);
    expect(rfi.totalDays).toBeGreaterThan(median.totalDays);
    // p90 factor is 1.029: a shift measured in days, not a rewrite.
    expect(rfi.totalDays - median.totalDays).toBeLessThan(median.totalDays * 0.05);
  });

  it("refuses a date for an appeal, with the measured age instead", () => {
    const e = buildCaseEstimate({
      filingDate: "2024-01-15",
      status: "BALCA APPEALS",
      isFinal: false,
      estimator: ESTIMATOR,
      today: TODAY,
    });
    expect(e).not.toBeNull();
    if (e?.kind !== "no-date") throw new Error("expected a refusal with context");
    expect(e.observedAgeDays).toBeGreaterThan(600);
    expect(e.note.toLowerCase()).toContain("appeal");
  });

  it("keeps the cohort estimate for an unmeasured status, flagged as unadjusted", () => {
    const e = buildCaseEstimate({
      filingDate: "2025-06-15",
      status: "SOME STATUS DOL INVENTED ON TUESDAY",
      isFinal: false,
      estimator: ESTIMATOR,
      today: TODAY,
    });
    if (e?.kind !== "date") throw new Error("expected a dated estimate");
    expect(e.stage).toBeNull();
    expect(e.caveats.join(" ").toLowerCase()).toContain("hasn't been measured");
  });
});

describe("statuses where a decision already exists", () => {
  it("refuses to estimate a case at DETERMINATION ISSUED", () => {
    // The decision has been made; only the published outcome lags. An
    // estimate for an event that already happened is checkably wrong.
    expect(
      buildCaseEstimate({
        filingDate: "2026-05-05",
        status: "Determination Issued",
        isFinal: false,
        estimator: ESTIMATOR,
        today: TODAY,
      }),
    ).toBeNull();
  });
});
