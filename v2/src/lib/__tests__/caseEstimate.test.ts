import { describe, expect, it } from "vitest";

import { buildCaseEstimate } from "../caseEstimate";
import type { EstimatorData } from "../db/estimate";

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
      filingDate: "2025-12-15",
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
      filingDate: "2025-12-15",
      status: "ANALYST REVIEW",
      isFinal: false,
      estimator: ESTIMATOR,
      today: TODAY,
    });
    const rfi = buildCaseEstimate({
      filingDate: "2025-12-15",
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
    // A measured stage, so the number is the POPULATION mean and the panel is
    // allowed to call it an average.
    expect(e.age.of).toBe("stage");
    expect(e.age.days).toBeGreaterThan(600);
    expect(e.note.toLowerCase()).toContain("appeal");
  });

  it("keeps the cohort estimate for an unmeasured status, flagged as unadjusted", () => {
    const e = buildCaseEstimate({
      filingDate: "2025-12-15",
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

describe("a filing month the frontier has already passed", () => {
  it("refuses a date and says the case is out of filing order", () => {
    // Filed Nov 2024 against a Sep 2025 frontier: every filing-anchored model
    // has elapsed, so the calculator withholds them all. The honest output is
    // the overdue explanation with the measured age - never a past-dated
    // window, which is what this case rendered before the rule existed.
    const e = buildCaseEstimate({
      filingDate: "2024-11-05",
      status: "ANALYST REVIEW",
      isFinal: false,
      estimator: ESTIMATOR,
      today: TODAY,
    });
    expect(e).not.toBeNull();
    if (e?.kind !== "no-date") throw new Error("expected the overdue refusal");
    expect(e.note.toLowerCase()).toContain("passed this filing month");
    // THE DISTINCTION THIS FILE EXISTS TO HOLD. The overdue branch has no
    // measured stage to average, so the number is this case's own wait. The
    // panel called it "a measured average" for both shapes until 2026-09-10,
    // and it read as true because both land in the same range.
    expect(e.age.of).toBe("this-case");
    expect(e.age.days).toBeGreaterThan(600);
  });
});

describe("a case still in line behind DOL's queue, with the straggler rate", () => {
  const STRAGGLERS = {
    asOf: TODAY, frontierMonth: "2025-09", windowDays: 14, pending: 1242, pool: 4408,
    decided: 2952, dailyRate: 0.088, medianDays: 8, p80Days: 18,
  };

  it("dates it from how fast DOL is deciding that group, not from the filing month", () => {
    const e = buildCaseEstimate({
      filingDate: "2024-11-05",
      status: "ANALYST REVIEW",
      isFinal: false,
      estimator: ESTIMATOR,
      stragglers: STRAGGLERS,
      today: TODAY,
    });
    if (e?.kind !== "date") throw new Error("expected a dated estimate");
    expect(e.modelId).toBe("stragglers");
    expect(e.estimatedDate).toBe("2026-09-05"); // today + the median, 8 days
    expect(e.earliestDate).toBe("2026-08-29");
    expect(e.latestDate).toBe("2026-09-15"); // today + eight in ten, 18 days
    expect(e.basis).toContain("2,952 of the 4,408");
    expect(e.estimatedDate > TODAY).toBe(true);
  });

  it("prefers the rate to DOL's published average, even while that average still names a future day", () => {
    // Filed Aug 25 2025 against a Sep 2025 frontier: filed + 372 days is
    // Sep 1 2026, after TODAY, so the average would still answer. Backtested
    // Oct 7 2026, that average ran typically 29 days late for exactly these
    // cases and the measured rate about 6.
    const e = buildCaseEstimate({
      filingDate: "2025-08-25",
      status: "ANALYST REVIEW",
      isFinal: false,
      estimator: ESTIMATOR,
      stragglers: STRAGGLERS,
      today: TODAY,
    });
    if (e?.kind !== "date") throw new Error("expected a dated estimate");
    expect(e.modelId).toBe("stragglers");
    expect(e.estimatedDate).toBe("2026-09-05");
  });

  it("keeps the refusal for a case out of line (an RFI, a hold): the rate is about the line", () => {
    const e = buildCaseEstimate({
      filingDate: "2024-11-05",
      status: "RFI ISSUED",
      isFinal: false,
      estimator: ESTIMATOR,
      stragglers: STRAGGLERS,
      today: TODAY,
    });
    expect(e?.kind === "date" && e.modelId === "stragglers").toBe(false);
  });

  it("keeps the refusal when there is no usable rate", () => {
    const e = buildCaseEstimate({
      filingDate: "2024-11-05",
      status: "ANALYST REVIEW",
      isFinal: false,
      estimator: ESTIMATOR,
      stragglers: null,
      today: TODAY,
    });
    expect(e?.kind).toBe("no-date");
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

describe("an RFI case is dated from its own RFI day (Oct 8 2026)", () => {
  const clock = {
    leaveDays: { p25: 31, p50: 31, p75: 31 },
    afterLeaveDays: { p25: 2, p50: 4, p75: 7, p90: null },
    slowEndDays: 14,
    slowEndFrom: "an immigration attorney's estimate" as const,
    watched: 1021,
    watchedFrom: "2026-08-27",
    test: null,
  };
  const base = {
    filingDate: "2025-10-15",
    status: "RFI ISSUED",
    isFinal: false,
    estimator: ESTIMATOR,
    today: "2026-10-08",
  };

  it("names the RFI clock, the day and the range", () => {
    const e = buildCaseEstimate({ ...base, rfi: { enteredOn: "2026-10-01", clock } });
    expect(e?.kind).toBe("date");
    if (e?.kind !== "date") return;
    expect(e.modelId).toBe("rfi-clock");
    expect([e.earliestDate, e.estimatedDate, e.latestDate]).toEqual(["2026-11-03", "2026-11-05", "2026-11-15"]);
    expect(e.basis).toContain("October 1, 2026");
    expect(e.caveats.join(" ")).toContain("an immigration attorney's estimate");
  });

  it("says an RFI past its window can't be dated, instead of guessing", () => {
    const e = buildCaseEstimate({ ...base, today: "2026-10-20", rfi: { enteredOn: "2026-08-28", clock } });
    expect(e?.kind).toBe("no-date");
  });

  it("falls to what it did before when the RFI day isn't known", () => {
    const withUnknown = buildCaseEstimate({ ...base, rfi: { enteredOn: null, clock } });
    const without = buildCaseEstimate(base);
    expect(withUnknown).toEqual(without);
  });

  it("leaves a case in analyst review alone", () => {
    const e = buildCaseEstimate({ ...base, status: "ANALYST REVIEW", rfi: { enteredOn: "2026-10-01", clock } });
    expect(e?.kind === "date" && e.modelId).not.toBe("rfi-clock");
  });
});

describe("in another language (Oct 28 2026)", () => {
  const PACE = { pace: 640, fast: 800, slow: 500, weekdayMean: 800, weekendMean: 240, weekdaysUsed: 20, daysUsed: 28 };
  const paced = {
    filingDate: "2025-12-15",
    status: "ANALYST REVIEW",
    isFinal: false,
    estimator: ESTIMATOR,
    casesAhead: 9000,
    decisionPace: PACE,
    sweepAgeDays: 0,
    today: TODAY,
  };

  it("keeps English the default, word for word", () => {
    expect(buildCaseEstimate({ ...paced, lang: "en" })).toEqual(buildCaseEstimate(paced));
  });

  it("words the model and every caveat in Spanish from the same figures", () => {
    const en = buildCaseEstimate(paced);
    const es = buildCaseEstimate({ ...paced, lang: "es" });
    if (en?.kind !== "date" || es?.kind !== "date") throw new Error("expected dated estimates");
    // Same answer, other words.
    expect([es.estimatedDate, es.earliestDate, es.latestDate]).toEqual([en.estimatedDate, en.earliestDate, en.latestDate]);
    expect(es.modelLabel).toBe("Casos delante del suyo, al ritmo medido del DOL");
    expect(es.basis).toContain("9000 casos de la fila normal del DOL");
    expect(es.basis).toContain("unos 640 casos al día");
    expect(es.stage?.note).toBe("El camino normal. El centro de su mes de presentación es la lectura correcta.");
    expect(es.caveats).toHaveLength(en.caveats.length);
    for (const c of es.caveats) expect(en.caveats).not.toContain(c);
    expect(es.caveats.join(" ")).toContain("El DOL no decide los casos en un orden estricto.");
  });

  it("writes months and DOL's date in the reader's language, never raw ISO", () => {
    const pt = buildCaseEstimate({ ...paced, casesAhead: null, lang: "pt-br" });
    if (pt?.kind !== "date") throw new Error("expected a dated estimate");
    expect(pt.modelId).toBe("queue-advance");
    expect(pt.basis).toContain("O DOL está trabalhando em setembro de 2025");
    expect(pt.basis).toContain("1,80 meses");
    expect(pt.source).toBe("Avanço da fila medido no FLAG do DOL, em 20 de agosto de 2026");
    expect(pt.caveats.join(" ")).toContain("não foi possível contar, com os dados de hoje");
    expect(pt.caveats.join(" ")).not.toMatch(/\d{4}-\d{2}/);
  });

  it("dates a case behind the queue in Chinese, with the reader's own number format", () => {
    const zh = buildCaseEstimate({
      filingDate: "2024-11-05",
      status: "ANALYST REVIEW",
      isFinal: false,
      estimator: ESTIMATOR,
      stragglers: {
        asOf: TODAY, frontierMonth: "2025-09", windowDays: 14, pending: 1242, pool: 4408,
        decided: 2952, dailyRate: 0.088, medianDays: 8, p80Days: 18,
      },
      today: TODAY,
      lang: "zh",
    });
    if (zh?.kind !== "date") throw new Error("expected a dated estimate");
    expect(zh.modelLabel).toBe("已被劳工部队列越过的案件");
    expect(zh.basis).toContain("劳工部判定了处境相同的 4,408 个案件中的 2,952 个");
    expect(zh.caveats[0]).toMatch(/^案件仍可能因审计/);
  });

  it("explains an appeal and an RFI past its window in Korean", () => {
    const balca = buildCaseEstimate({
      filingDate: "2024-01-15",
      status: "BALCA APPEALS",
      isFinal: false,
      estimator: ESTIMATOR,
      today: TODAY,
      lang: "ko",
    });
    expect(balca?.kind === "no-date" && balca.note).toMatch(/^BALCA 항소는/);
    const rfi = buildCaseEstimate({
      filingDate: "2025-10-15",
      status: "RFI ISSUED",
      isFinal: false,
      estimator: ESTIMATOR,
      today: "2026-10-20",
      rfi: {
        enteredOn: "2026-08-28",
        clock: {
          leaveDays: { p25: 31, p50: 31, p75: 31 },
          afterLeaveDays: { p25: 2, p50: 4, p75: 7, p90: null },
          slowEndDays: 14,
          slowEndFrom: "measured",
          watched: 1021,
          watchedFrom: "2026-08-27",
          test: null,
        },
      },
      lang: "ko",
    });
    expect(rfi?.kind === "no-date" && rfi.note).toMatch(/^이 RFI는 53일째로/);
  });

  it("has a stage note in every language for every stage the table places", async () => {
    const { STAGE_KEYS, ESTIMATE_TEXT } = await import("../caseEstimate.messages");
    const { placeCaseInCohort } = await import("../queueForecast");
    for (const key of STAGE_KEYS) {
      const place = placeCaseInCohort(key);
      expect(place, key).not.toBeNull();
      for (const t of Object.values(ESTIMATE_TEXT)) {
        expect(t.stage[key]).toBeTruthy();
        expect(t.stage[key]).not.toBe(place!.note);
      }
    }
  });
});
