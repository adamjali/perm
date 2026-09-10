import { describe, expect, it } from "vitest";

import { placeCaseInCohort, COHORT_PERCENTILE_FACTOR } from "../queueForecast";
import { ageByStatusFrom, exitMixFor, type StageStats } from "../turso/stageStats";

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
