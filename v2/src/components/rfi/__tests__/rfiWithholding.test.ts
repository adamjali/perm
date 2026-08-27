/**
 * The two rules that decide what this page refuses to publish.
 *
 * Both were written because the unguarded version produced a specific, wrong,
 * publishable-looking answer, so the cases below are the real ones rather than
 * invented ones. `bandIsPublishable` and `occupationIsPublishable` are exported
 * from the read layer purely so they can be probed here: a guard that only
 * exists inside an async database call is a guard nobody ever tests.
 */
import { describe, expect, it } from "vitest";

import {
  MIN_BAND_N,
  MIN_EMPLOYERS,
  MIN_RFI,
  bandIsPublishable,
  occupationIsPublishable,
} from "@/lib/turso/rfi";

describe("bandIsPublishable", () => {
  it("publishes a band measured from most of its own stage", () => {
    // RFI ISSUED: 905 of 906 cases carry both dates.
    expect(bandIsPublishable(905, 906)).toBe(true);
    // ANALYST REVIEW: 82,555 of 94,432, which is 87%.
    expect(bandIsPublishable(82_555, 94_432)).toBe(true);
  });

  it("withholds a band computed from a small slice of its stage", () => {
    // IN PROCESS holds 71 cases and only 3 have both a filing date and an
    // observation date. Without the ratio test this renders a 10th-to-90th
    // band under the stage's own name while describing 4% of it, and nothing
    // about the numbers themselves reveals that.
    expect(bandIsPublishable(3, 71)).toBe(false);

    // THE REAL CASE FOR THE RATIO, and the first draft of this file did not
    // have it. Deleting the ratio entirely left every assertion above green,
    // because 3 is under the case floor and was being caught by that instead.
    // A test that passes for two reasons only tells you about one of them.
    // Here the case floor is satisfied and coverage is the only thing left:
    // 30 measurable cases in a 100-case stage.
    expect(bandIsPublishable(30, 100)).toBe(false);
    expect(bandIsPublishable(51, 100)).toBe(true);
  });

  it("withholds a band over a handful of cases even at full coverage", () => {
    // REQUEST FOR REVIEW: 2 of 2. Complete coverage, and a 10th and 90th
    // percentile over two cases is those two cases wearing the clothes of a
    // distribution.
    expect(bandIsPublishable(2, 2)).toBe(false);
    expect(bandIsPublishable(6, 6)).toBe(false);
  });

  it("treats the two floors as independent", () => {
    // Enough cases, bad coverage.
    expect(bandIsPublishable(MIN_BAND_N, MIN_BAND_N * 2 + 1)).toBe(false);
    // Good coverage, too few cases.
    expect(bandIsPublishable(MIN_BAND_N - 1, MIN_BAND_N - 1)).toBe(false);
    // Both satisfied, exactly at the boundary.
    expect(bandIsPublishable(MIN_BAND_N, MIN_BAND_N * 2)).toBe(true);
  });

  it("withholds when nothing could be measured at all", () => {
    expect(bandIsPublishable(0, 40)).toBe(false);
    expect(bandIsPublishable(0, 0)).toBe(false);
  });
});

describe("occupationIsPublishable", () => {
  it("withholds a title only one employer uses", () => {
    // Both of these cleared the case floor and were the top two "at risk"
    // occupations in PERM before this guard existed: DISHWASHERS at 100% (7
    // of 7) and FACILITIES AND GROUND SUPPORT MECHANIC at 90% (9 of 10). Each
    // is one company's batch of filings wearing an occupation's name.
    expect(occupationIsPublishable(1, 1)).toBe(false);
  });

  it("withholds when only the RFI side is thin", () => {
    // LANDSCAPE LABORER: 7 RFIs from 2 employers, against 321 filings from 47.
    // The denominator looks like an occupation and the numerator does not, so
    // only the numerator floor can catch it. Dropping that floor turns both of
    // these green, which is what makes them worth asserting.
    expect(occupationIsPublishable(2, 47)).toBe(false);
    // CASHIER: 6 RFIs from 4 employers, one short of the floor.
    expect(occupationIsPublishable(4, 34)).toBe(false);
  });

  it("withholds when only the population side is thin", () => {
    expect(occupationIsPublishable(6, 2)).toBe(false);
  });

  it("publishes a title used by many employers on both sides", () => {
    // NAIL TECHNICIAN: 15 RFIs from 10 employers, 51 filings from 22.
    expect(occupationIsPublishable(10, 22)).toBe(true);
    // SOFTWARE ENGINEER, the other end of the range: 14 from 12, 1,848 from 656.
    expect(occupationIsPublishable(12, 656)).toBe(true);
  });

  it("holds the floor at exactly the boundary", () => {
    expect(occupationIsPublishable(MIN_EMPLOYERS, MIN_EMPLOYERS)).toBe(true);
    expect(occupationIsPublishable(MIN_EMPLOYERS - 1, MIN_EMPLOYERS)).toBe(false);
    expect(occupationIsPublishable(MIN_EMPLOYERS, MIN_EMPLOYERS - 1)).toBe(false);
  });
});

describe("the floors themselves", () => {
  it("keeps a title off the ranking until it has enough RFIs to rank", () => {
    // Guards the constant rather than the function: dropping MIN_RFI to 1
    // repopulates the ranking with every one-case title in the mirror, and the
    // top of the list becomes a list of 100% rates.
    expect(MIN_RFI).toBeGreaterThanOrEqual(5);
  });

  it("keeps a day band off the chart until it has enough cases", () => {
    expect(MIN_BAND_N).toBeGreaterThanOrEqual(10);
  });
});
