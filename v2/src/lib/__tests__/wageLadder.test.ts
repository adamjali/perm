import { describe, expect, it } from "vitest";

import {
  MIN_DECIDED_FOR_BAND_RATE,
  WAGE_BAND_EDGES,
  WAGE_BAND_EDGES_FINE,
  coarsenBands,
  reversals,
  bandLabel,
  isComplete,
  isMonotonicFalling,
  ladderExtent,
  money,
  moneyShort,
  overlaps,
  toBands,
  widestStep,
  worstBand,
  type Ladder,
} from "@/lib/wageLadder";

/**
 * Fixtures are the REAL measured cells, not invented numbers.
 *
 * Two reasons. A derivation tested against numbers chosen to make it pass is
 * tested against itself, and these particular rows are the evidence for claims
 * the pages make in prose. If a future ingest changes the shape enough that
 * "the two markets do not overlap" stops being true, a test asserting it
 * against the real figures is where that shows up.
 */
const softwareDevelopers: Ladder = {
  label: "Software Developers",
  key: "15-1252.00",
  count: 73_058,
  p5: 89_565,
  p10: 98_904,
  p25: 116_938,
  p50: 139_027,
  p75: 159_810,
  p90: 184_662,
  p95: 199_779,
  mean: 140_930,
};

const meatCutters: Ladder = {
  label: "Meat, Poultry, and Fish Cutters and Trimmers",
  key: "51-3022.00",
  count: 9_214,
  p5: 22_464,
  p10: 22_464,
  p25: 23_000,
  p50: 26_000,
  p75: 30_202,
  p90: 31_200,
  p95: 31_408,
  mean: 26_800,
};

/** Georgia: poultry processing and Atlanta software through one process. */
const georgia: Ladder = {
  label: "GA",
  key: "GA",
  count: 21_597,
  p5: 19_635,
  p10: 20_571,
  p25: 24_360,
  p50: 30_202,
  p75: 100_000,
  p90: 137_000,
  p95: 150_000,
  mean: 61_620,
};

const california: Ladder = {
  label: "CA",
  key: "CA",
  count: 61_569,
  p5: 36_400,
  p10: 51_888,
  p25: 104_000,
  p50: 142_000,
  p75: 176_134,
  p90: 204_257,
  p95: 226_325,
  mean: 139_219,
};

describe("isComplete", () => {
  it("accepts a ladder with every rung resolved", () => {
    expect(isComplete(softwareDevelopers)).toBe(true);
  });

  it.each(["p5", "p50", "p95"] as const)(
    "rejects a ladder missing %s, so a partial span is never drawn as a short one",
    (rung) => {
      expect(isComplete({ ...softwareDevelopers, [rung]: null })).toBe(false);
    },
  );
});

describe("overlaps", () => {
  it("finds the two busiest pay scales disjoint", () => {
    // The claim the /perm-wages figure makes in prose. The lowest-paid 5% of
    // software developers out-earn the highest-paid 5% of meat cutters.
    expect(overlaps(softwareDevelopers, meatCutters)).toBe(false);
    expect(softwareDevelopers.p5!).toBeGreaterThan(meatCutters.p95!);
  });

  it("finds two overlapping ladders overlapping, in both argument orders", () => {
    expect(overlaps(georgia, california)).toBe(true);
    expect(overlaps(california, georgia)).toBe(true);
  });

  it("treats an unknown rung as overlap rather than as separation", () => {
    // An absent percentile is not evidence that two populations are disjoint,
    // and the page only makes the strong claim when this returns false.
    expect(overlaps({ ...softwareDevelopers, p5: null }, meatCutters)).toBe(true);
  });
});

describe("ladderExtent", () => {
  it("spans the lowest 5th and the highest 95th in the set", () => {
    expect(ladderExtent([softwareDevelopers, meatCutters])).toEqual([
      22_464, 199_779,
    ]);
  });

  it("ignores ladders with no usable end", () => {
    const extent = ladderExtent([
      { ...meatCutters, p5: null, p95: null },
      softwareDevelopers,
    ]);
    expect(extent).toEqual([89_565, 199_779]);
  });

  it("returns null rather than a degenerate domain when nothing resolves", () => {
    expect(ladderExtent([])).toBeNull();
    expect(ladderExtent([{ ...meatCutters, p5: null, p95: null }])).toBeNull();
  });
});

describe("widestStep", () => {
  it("finds Georgia's median-to-75th jump, the signature of two populations", () => {
    const step = widestStep(georgia);
    expect(step).not.toBeNull();
    expect(step!.from).toBe("p50");
    expect(step!.to).toBe("p75");
    expect(step!.ratio).toBeCloseTo(3.31, 2);
  });

  it("finds California's widest step far smaller, on the same measure", () => {
    // Same seven rungs, same units. CA's largest jump is p10 to p25 at 2.00x,
    // and its median-to-75th is only 1.24x, which is what "one population"
    // looks like next to Georgia's 3.31x.
    expect(widestStep(california)!.ratio).toBeLessThan(
      widestStep(georgia)!.ratio,
    );
    expect(california.p75! / california.p50!).toBeCloseTo(1.24, 2);
  });

  it("skips a rung pair it cannot divide instead of returning Infinity", () => {
    const zeroed: Ladder = { ...georgia, p5: 0, p10: 0 };
    const step = widestStep(zeroed);
    expect(step).not.toBeNull();
    expect(Number.isFinite(step!.ratio)).toBe(true);
  });

  it("returns null when no adjacent pair resolves", () => {
    expect(
      widestStep({
        ...georgia,
        p5: null,
        p10: null,
        p25: null,
        p50: null,
        p75: null,
        p90: null,
        p95: null,
      }),
    ).toBeNull();
  });
});

describe("money formatting", () => {
  it("rounds to whole dollars", () => {
    expect(money(139_026.51)).toBe("$139,027");
  });

  it("abbreviates for an axis", () => {
    expect(moneyShort(139_027)).toBe("$139k");
    expect(moneyShort(1_250_000)).toBe("$1.3m");
  });
});

describe("bandLabel", () => {
  it("names the open ends without inventing an edge", () => {
    expect(bandLabel(0, 60_000)).toBe("Under $60k");
    expect(bandLabel(130_000, null)).toBe("$130k and up");
    expect(bandLabel(60_000, 80_000)).toBe("$60k to $80k");
  });
});

describe("toBands", () => {
  /** The real FY2026 counts: the year where the hump is largest. */
  const fy2026 = [
    { from: 0, decided: 32_654, denied: 1_613 },
    { from: 60_000, decided: 8_755, denied: 580 },
    { from: 80_000, decided: 9_906, denied: 341 },
    { from: 130_000, decided: 37_726, denied: 845 },
    { from: 100_000, decided: 18_634, denied: 455 },
  ];

  it("emits every band in wage order, whatever order the rows arrive in", () => {
    const bands = toBands(fy2026, WAGE_BAND_EDGES);
    expect(bands.map((b) => b.from)).toEqual([0, 60_000, 80_000, 100_000, 130_000]);
  });

  it("emits a band the query returned nothing for, rather than closing the gap", () => {
    // A missing band that simply vanishes lets its neighbours sit next to each
    // other on the axis and read as adjacent when they are not.
    const bands = toBands([{ from: 0, decided: 500, denied: 10 }], WAGE_BAND_EDGES);
    expect(bands).toHaveLength(5);
    expect(bands[2]).toMatchObject({ decided: 0, denied: 0, deniedPct: null });
  });

  it("withholds a rate under the floor instead of publishing it", () => {
    const thin = MIN_DECIDED_FOR_BAND_RATE - 1;
    const [band] = toBands([{ from: 0, decided: thin, denied: thin }], WAGE_BAND_EDGES);
    expect(band!.decided).toBe(thin);
    expect(band!.deniedPct).toBeNull();
  });

  it("publishes a rate exactly at the floor", () => {
    const [band] = toBands(
      [{ from: 0, decided: MIN_DECIDED_FOR_BAND_RATE, denied: 5 }],
      WAGE_BAND_EDGES,
    );
    expect(band!.deniedPct).toBeCloseTo(5, 6);
  });

  it("reproduces the measured FY2026 rates", () => {
    const bands = toBands(fy2026, WAGE_BAND_EDGES);
    expect(bands.map((b) => Number(b.deniedPct!.toFixed(2)))).toEqual([
      4.94, 6.62, 3.44, 2.44, 2.24,
    ]);
  });
});

describe("isMonotonicFalling", () => {
  const rates = (xs: number[]) =>
    toBands(
      xs.map((pct, i) => ({
        from: [0, 60_000, 80_000, 100_000, 130_000][i]!,
        decided: 10_000,
        denied: Math.round(100 * pct),
      })),
      WAGE_BAND_EDGES,
    );

  it("is true for FY2024, which falls at every step", () => {
    expect(isMonotonicFalling(rates([9.44, 5.65, 3.87, 2.7, 1.47]))).toBe(true);
  });

  it("is false for FY2025 and FY2026, which peak in the middle", () => {
    expect(isMonotonicFalling(rates([2.57, 3.61, 1.53, 1.2, 0.82]))).toBe(false);
    expect(isMonotonicFalling(rates([4.94, 6.62, 3.44, 2.44, 2.24]))).toBe(false);
  });

  it("is true for the pooled window, which is why pooling hides the finding", () => {
    // The whole reason the figure is drawn per year. Pooled, FY2024's very
    // high bottom band almost exactly cancels the later years' hump.
    expect(isMonotonicFalling(rates([5.22, 5.21, 2.88, 2.04, 1.47]))).toBe(true);
  });

  it("skips withheld bands rather than reading them as zero", () => {
    // A withheld band treated as 0% would look like a fall and turn a humped
    // series into a monotonic one.
    const bands = toBands(
      [
        { from: 0, decided: 10_000, denied: 250 },
        { from: 60_000, decided: 5, denied: 5 },
        { from: 80_000, decided: 10_000, denied: 400 },
      ],
      WAGE_BAND_EDGES,
    );
    expect(bands[1]!.deniedPct).toBeNull();
    expect(isMonotonicFalling(bands)).toBe(false);
  });
});

describe("worstBand", () => {
  it("finds the middle band worst in FY2026", () => {
    const bands = toBands(
      [
        { from: 0, decided: 32_654, denied: 1_613 },
        { from: 60_000, decided: 8_755, denied: 580 },
        { from: 130_000, decided: 37_726, denied: 845 },
      ],
      WAGE_BAND_EDGES,
    );
    expect(worstBand(bands)!.from).toBe(60_000);
  });

  it("returns null when every band is withheld", () => {
    expect(
      worstBand(toBands([{ from: 0, decided: 3, denied: 3 }], WAGE_BAND_EDGES)),
    ).toBeNull();
  });
});

/**
 * The measured pooled corpus at fine resolution, 373,162 decided rows with a
 * wage.
 *
 * REAL DENIED COUNTS, NOT ONES BACK-COMPUTED FROM THE ROUNDED PERCENTAGES.
 * The first version of this fixture derived `denied` from the published rates
 * and was off by 1 to 3 per bucket, which broke the exact-derivation test for
 * a reason that had nothing to do with the code under test. A fixture that
 * cannot survive an equality check is not a fixture.
 */
const POOLED_FINE = [
  { from: 0, decided: 80_118, denied: 3_970 },
  { from: 40_000, decided: 16_436, denied: 1_193 },
  { from: 50_000, decided: 15_857, denied: 700 },
  { from: 60_000, decided: 12_690, denied: 880 },
  { from: 70_000, decided: 13_013, denied: 460 },
  { from: 80_000, decided: 15_920, denied: 435 },
  { from: 90_000, decided: 18_561, denied: 557 },
  { from: 100_000, decided: 30_188, denied: 680 },
  { from: 115_000, decided: 33_022, denied: 611 },
  { from: 130_000, decided: 65_782, denied: 891 },
  { from: 160_000, decided: 52_851, denied: 850 },
];

describe("coarsenBands", () => {
  it("reproduces the direct coarse grouping exactly, bucket for bucket", () => {
    // The whole point of deriving rather than querying twice: a summary that
    // could disagree with its own detail is worse than no summary. These
    // targets come from a direct SQL GROUP BY on the coarse edges.
    const coarse = coarsenBands(toBands(POOLED_FINE, WAGE_BAND_EDGES_FINE));
    expect(coarse.map((b) => [b.from, b.decided, b.denied])).toEqual([
      [0, 112_411, 5_863],
      [60_000, 25_703, 1_340],
      [80_000, 34_481, 992],
      [100_000, 63_210, 1_291],
      [130_000, 118_633, 1_741],
    ]);
  });

  it("refuses a coarse edge that is not also a fine edge", () => {
    // A coarse bucket straddling a fine one would silently under-count. The
    // guard is the reason this cannot become a quiet arithmetic error.
    const fine = toBands(POOLED_FINE, WAGE_BAND_EDGES_FINE);
    expect(() => coarsenBands(fine, [75_000])).toThrow(/not a fine band edge/);
  });

  it("keeps the total decided count intact", () => {
    const fine = toBands(POOLED_FINE, WAGE_BAND_EDGES_FINE);
    const sum = (bs: { decided: number }[]) => bs.reduce((a, b) => a + b.decided, 0);
    expect(sum(coarsenBands(fine))).toBe(sum(fine));
  });
});

describe("the retracted finding", () => {
  it("shows the coarse view manufacturing a plateau the fine view does not have", () => {
    // The retraction, pinned. Coarse: 5.22 then 5.21, a dead tie that reads as
    // "the bottom two are equally bad". Fine: the bottom of the range holds a
    // 7.26% band and two near 4.7, and the maximum is NOT the lowest band.
    const fine = toBands(POOLED_FINE, WAGE_BAND_EDGES_FINE);
    const coarse = coarsenBands(fine);
    const pct = (b: (typeof coarse)[number]) => Number((b.deniedPct as number).toFixed(2));
    expect(pct(coarse[0]!)).toBeCloseTo(5.21, 1);
    expect(pct(coarse[1]!)).toBeCloseTo(5.21, 1);

    const peak = worstBand(fine)!;
    expect(peak.from).toBe(40_000);
    expect(peak.deniedPct).toBeCloseTo(7.26, 1);
    // And the peak is NOT the lowest band, which is what the coarse view implies.
    expect(peak.from).not.toBe(0);
  });

  it("finds the rise at the TOP that a single 'over $130k' band erases", () => {
    // Measured in every fiscal year: 1.63 vs 1.37, 0.91 vs 0.74, 2.38 vs 2.11,
    // on tens of thousands of cases each, so it is not noise.
    const fine = toBands(POOLED_FINE, WAGE_BAND_EDGES_FINE);
    const mid = fine.find((b) => b.from === 130_000)!;
    const top = fine.find((b) => b.from === 160_000)!;
    expect(top.deniedPct as number).toBeGreaterThan(mid.deniedPct as number);
    expect(coarsenBands(fine).find((b) => b.from === 130_000)!.decided).toBe(
      mid.decided + top.decided,
    );
  });
});

describe("reversals", () => {
  it("names every pair that goes the wrong way, low to high", () => {
    const fine = toBands(POOLED_FINE, WAGE_BAND_EDGES_FINE);
    const r = reversals(fine);
    expect(r.length).toBeGreaterThan(0);
    expect(r.map((x) => x.higher.from)).toContain(40_000);
    expect(r.map((x) => x.higher.from)).toContain(160_000);
    for (const { lower, higher } of r) {
      expect(higher.from).toBeGreaterThan(lower.from);
      expect(higher.deniedPct as number).toBeGreaterThan(lower.deniedPct as number);
    }
  });

  it("returns nothing for a series that really does fall at every step", () => {
    const falling = toBands(
      [0, 60_000, 80_000, 100_000, 130_000].map((from, i) => ({
        from,
        decided: 10_000,
        denied: 500 - i * 100,
      })),
      WAGE_BAND_EDGES,
    );
    expect(reversals(falling)).toEqual([]);
  });

  it("skips a withheld band rather than reading it as zero", () => {
    const bands = toBands(
      [
        { from: 0, decided: 10_000, denied: 250 },
        { from: 60_000, decided: 5, denied: 5 },
        { from: 80_000, decided: 10_000, denied: 400 },
      ],
      WAGE_BAND_EDGES,
    );
    expect(reversals(bands).map((r) => r.higher.from)).toEqual([80_000]);
  });
});
