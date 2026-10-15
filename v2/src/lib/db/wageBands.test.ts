import { describe, expect, it } from "vitest";

import { isMonotonic, peakBand, type WageBand, type WageDenialBands } from "./wageBands";

/**
 * These two functions exist to stop the page making a claim the data does not
 * support. An earlier draft of the wage section said the gradient "runs one
 * way and it's steep", built on five wide bands. At eleven bands it does not
 * run one way: the maximum is $40k-$50k, the rate turns back up above $160k,
 * and the coarse view produced the tidy story purely by averaging.
 *
 * So the copy branches on these, and both branches have to be right.
 */
function band(bucket: string, decided: number, denied: number): WageBand {
  return {
    bucket,
    decided,
    denied,
    withdrawn: 0,
    denialRate: decided > 0 ? Number(((denied / decided) * 100).toFixed(2)) : null,
  };
}

/** The real shape, as measured on the current corpus. */
const FINE: WageBand[] = [
  band("Under $40k", 80118, 3970), // 4.96
  band("$40k to $50k", 16436, 1193), // 7.26  <- the maximum
  band("$50k to $60k", 15857, 700), // 4.41
  band("$60k to $70k", 12690, 880), // 6.93
  band("$70k to $80k", 13013, 460), // 3.53
  band("$80k to $90k", 15920, 435), // 2.73
  band("$90k to $100k", 18561, 557), // 3.00
  band("$100k to $115k", 30188, 680), // 2.25
  band("$115k to $130k", 33022, 611), // 1.85
  band("$130k to $160k", 65782, 891), // 1.35  <- the minimum
  band("$160k and above", 52851, 850), // 1.61  <- turns back up
];

const COARSE: WageBand[] = [
  band("Under $60K", 112411, 5863), // 5.22
  band("$60K-$80K", 25703, 1340), // 5.21
  band("$80K-$100K", 34481, 992), // 2.88
  band("$100K-$130K", 63210, 1291), // 2.04
  band("Over $130K", 118633, 1741), // 1.47
];

const BANDS: WageDenialBands = {
  fine: FINE,
  coarse: COARSE,
  unbandedDecided: 692,
  sourceFiles: ["PERM_Disclosure_Data_FY2026_Q3.xlsx"],
};

describe("isMonotonic", () => {
  it("reports the real wage curve as NOT monotonic", () => {
    // This is the assertion that retracts the earlier claim. If it ever flips
    // to true the copy switches to "it falls at every step", which is only
    // correct when this is.
    expect(isMonotonic(FINE)).toBe(false);
  });

  it("reports a genuinely descending series as monotonic", () => {
    // The control. A predicate that only ever returns false is not measuring.
    expect(
      isMonotonic([band("a", 100, 10), band("b", 100, 5), band("c", 100, 1)]),
    ).toBe(true);
  });

  it("treats a flat step as still monotonic", () => {
    // Non-increasing, not strictly decreasing: two equal bands are not a
    // reversal and should not be reported as one.
    expect(isMonotonic([band("a", 100, 10), band("b", 100, 10)])).toBe(true);
  });
});

describe("peakBand", () => {
  it("finds the maximum the coarse bands hide", () => {
    const p = peakBand(BANDS);
    expect(p).not.toBeNull();
    expect(p!.fine.bucket).toBe("$40k to $50k");
    expect(p!.fine.denialRate).toBe(7.26);
    // The coarse view's own maximum is a DIFFERENT, lower number covering the
    // same cases. That gap is the finding.
    expect(p!.coarse.bucket).toBe("Under $60K");
    expect(p!.coarse.denialRate).toBe(5.22);
    expect(p!.hiddenByCoarse).toBe(true);
  });

  it("does not claim the coarse view hides anything when it agrees", () => {
    // Control. If the two resolutions land within a point of each other there
    // is no bin-sensitivity story and the page must not tell one.
    const agreeing: WageDenialBands = {
      ...BANDS,
      fine: [band("a", 1000, 50), band("b", 1000, 40)],
      coarse: [band("wide", 2000, 90)],
    };
    expect(peakBand(agreeing)!.hiddenByCoarse).toBe(false);
  });

  it("returns null rather than inventing a peak from nothing", () => {
    expect(peakBand({ ...BANDS, fine: [], coarse: [] })).toBeNull();
  });

  it("the fine bands sum to the coarse ones", () => {
    // The build script asserts this too. Restating it here means a hand-edit
    // to either fixture that breaks the correspondence fails loudly, rather
    // than leaving a test suite that agrees with itself and not the data.
    const sum = (b: WageBand[]) => b.reduce((n, x) => n + x.decided, 0);
    expect(sum(FINE)).toBe(sum(COARSE));
    const denied = (b: WageBand[]) => b.reduce((n, x) => n + x.denied, 0);
    expect(denied(FINE)).toBe(denied(COARSE));
  });
});
