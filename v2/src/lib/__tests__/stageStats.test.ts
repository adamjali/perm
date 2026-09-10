import { describe, expect, it } from "vitest";

import { placeCaseInCohort, COHORT_PERCENTILE_FACTOR } from "../queueForecast";
import {
  ageByStatusFrom,
  exitMixFor,
  stageDurationFor,
  type StageStats,
} from "../turso/stageStats";

/**
 * Stage ages are MEASURED; what a stage MEANS stays in code.
 *
 * `queueForecast.STAGE_PLACEMENT` had its `observedAgeDays` typed once and
 * never revisited. Against the live table on 2026-09-10 every one had drifted
 * and RECONSIDERATION APPEALS by 85 days, while REQUEST FOR REVIEW (506 days,
 * 7 cases) was absent from the table entirely.
 *
 * The percentile is the half that must NOT become a nightly aggregate: it says
 * an RFI sits in the slow tail of its filing month and an appeal is a separate
 * proceeding no percentile describes. That is judgement about meaning, and a
 * measurement cannot make it.
 */
const STATS: StageStats = {
  asOf: "2026-09-10",
  source: "flag.dol.gov (DOL, direct)",
  stages: [
    { status: "ANALYST REVIEW", pending: 89292, meanAgeDays: 162 },
    { status: "RECONSIDERATION APPEALS", pending: 2390, meanAgeDays: 539 },
    { status: "RFI ISSUED", pending: 1000, meanAgeDays: 362 },
  ],
  durations: [
    // Real 2026-09-10 shape: a 14-day observation window, so nothing slow can
    // have been observed. Curves are (days, eligible, left).
    {
      stage: "RFI ISSUED",
      entered: 422,
      observedDays: 14,
      curve: [
        { days: 1, eligible: 400, left: 1 },
        { days: 7, eligible: 300, left: 2 },
        { days: 14, eligible: 120, left: 3 },
      ],
    },
    {
      stage: "ANALYST REVIEW",
      entered: 345,
      observedDays: 14,
      curve: [
        // Genuinely crosses 50%, and must STILL be withheld: these are
        // re-entries, and 4 days beside a 162-day mean age would mislead.
        { days: 4, eligible: 200, left: 120 },
      ],
    },
  ],
  exits: [
    { from: "RFI ISSUED", to: "ANALYST REVIEW", n: 327 },
    { from: "RFI ISSUED", to: "CERTIFIED", n: 23 },
    { from: "RFI ISSUED", to: "WITHDRAWN", n: 9 },
    { from: "NORD ISSUED", to: "DENIED", n: 37 },
  ],
};

describe("measured stage ages", () => {
  it("prefers the measurement over the hardcoded table", () => {
    const ages = ageByStatusFrom(STATS);
    const withLive = placeCaseInCohort("RECONSIDERATION APPEALS", ages);
    const fromTable = placeCaseInCohort("RECONSIDERATION APPEALS");
    expect(fromTable?.observedAgeDays).toBe(624); // what was typed
    expect(withLive?.observedAgeDays).toBe(539); // what is true
  });

  it("falls back to the table when nothing was measured", () => {
    // The doc can be missing or stale; that must degrade, never blank out.
    expect(placeCaseInCohort("RFI ISSUED", ageByStatusFrom(null))?.observedAgeDays).toBe(375);
    expect(placeCaseInCohort("RFI ISSUED")?.observedAgeDays).toBe(375);
  });

  it("never lets a measurement change what a stage MEANS", () => {
    const ages = ageByStatusFrom(STATS);
    for (const status of ["ANALYST REVIEW", "RFI ISSUED", "RECONSIDERATION APPEALS"]) {
      const live = placeCaseInCohort(status, ages);
      const table = placeCaseInCohort(status);
      expect(live?.percentile, status).toBe(table?.percentile);
      expect(live?.note, status).toBe(table?.note);
    }
    // ...and an appeal still has no percentile at all, measured or not.
    expect(placeCaseInCohort("RECONSIDERATION APPEALS", ages)?.percentile).toBeNull();
  });

  it("ignores a status the table does not know", () => {
    // REQUEST FOR REVIEW is measurable but carries no editorial placement, so
    // it stays unplaced rather than inheriting somebody else's percentile.
    const ages = new Map([["REQUEST FOR REVIEW", 506]]);
    expect(placeCaseInCohort("REQUEST FOR REVIEW", ages)).toBeNull();
  });

  it("keeps the percentile factors untouched", () => {
    expect(COHORT_PERCENTILE_FACTOR[50]).toBe(1.0);
  });
});

describe("exit mix", () => {
  it("says where a stage's cases actually go", () => {
    const mix = exitMixFor(STATS, "RFI ISSUED");
    // The useful fact nobody is told: an RFI is a detour back into the queue,
    // not an endpoint. 327 of 359 observed exits.
    expect(mix?.to).toBe("ANALYST REVIEW");
    expect(mix?.observed).toBe(359);
    expect(mix!.share).toBeGreaterThan(0.9);
  });

  it("refuses to describe a pattern from too few exits", () => {
    // NORD ISSUED clears the count floor at 37 but has exactly ONE surviving
    // destination, so its "100%" is the writer's n>=3 cutoff talking, not a
    // finding. A share needs something to be a share of.
    expect(exitMixFor(STATS, "NORD ISSUED")).toBeNull();
    expect(exitMixFor(STATS, "APPLICATION ON HOLD")).toBeNull();
    expect(exitMixFor(null, "RFI ISSUED")).toBeNull();
  });
});

describe("stage duration, which switches itself on", () => {
  it("says nothing while the window is shorter than the stage", () => {
    // THE ONE THAT MATTERS. 422 cases watched entering an RFI, 3 seen leaving.
    // 327 RFI exits HAVE been observed and say nothing about duration: those
    // cases were already at an RFI when the log opened, so their start is
    // unknown.
    expect(stageDurationFor(STATS, "RFI ISSUED")).toBeNull();
  });

  it("withholds a stage a case never visibly ARRIVES at", () => {
    // ANALYST REVIEW crosses 50% at 4 days, and the number is real: it is the
    // time from RE-entering analyst review to the next change. Against a mean
    // pending age of 162 days a reader would read it as their own wait.
    expect(stageDurationFor(STATS, "ANALYST REVIEW")).toBeNull();
    expect(stageDurationFor(STATS, "IN PROCESS")).toBeNull();
  });

  it("turns on by itself once the curve crosses, with no flag anywhere", () => {
    const withCurve = (curve: Array<{ days: number; eligible: number; left: number }>) =>
      ({ ...STATS, durations: [{ stage: "RFI ISSUED", entered: 400, observedDays: 200, curve }] });
    // Never reaches half: silent.
    expect(stageDurationFor(withCurve([{ days: 90, eligible: 300, left: 100 }]), "RFI ISSUED")).toBeNull();
    // Crosses at 120 days: answers, and takes the FIRST crossing.
    const on = stageDurationFor(
      withCurve([
        { days: 90, eligible: 300, left: 100 },
        { days: 120, eligible: 240, left: 130 },
        { days: 150, eligible: 180, left: 140 },
      ]),
      "RFI ISSUED",
    );
    expect(on?.p50).toBe(120);
    expect(on?.eligible).toBe(240);
  });

  it("ignores a crossing supported by too few eligible cases", () => {
    const thin = { ...STATS, durations: [{ stage: "RFI ISSUED", entered: 400, observedDays: 200,
      curve: [{ days: 30, eligible: 12, left: 11 }, { days: 200, eligible: 300, left: 60 }] }] };
    // 11 of 12 is not a finding; and the later point never reaches half.
    expect(stageDurationFor(thin, "RFI ISSUED")).toBeNull();
  });

  it("says nothing at all with no document", () => {
    expect(stageDurationFor(null, "RFI ISSUED")).toBeNull();
    expect(stageDurationFor({ ...STATS, durations: [] }, "RFI ISSUED")).toBeNull();
  });
});
