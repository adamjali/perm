import { describe, expect, it } from "vitest";

import { placeOffer, type OfferPayload } from "@/lib/wageStats";

const stats = { n: 100, avg: 100_000, p5: 60_000, p25: 80_000, p50: 100_000, p75: 120_000, p95: 150_000 };
// Ten bins of 10,000 from 50,000 to 150,000, ten rows each; 0 clipped either side.
const payload: OfferPayload = {
  stats,
  binWidth: 10_000,
  below: 0,
  above: 0,
  bins: Array.from({ length: 10 }, (_, i) => ({ from: 50_000 + i * 10_000, count: 10 })),
};

describe("placeOffer", () => {
  it("counts whole bins below the offer and interpolates inside its own bin", () => {
    // 50k..100k is five full bins (50 rows); 105k is halfway through the sixth (5 more).
    expect(placeOffer(payload, 105_000)?.percentile).toBe(55);
    expect(placeOffer(payload, 100_000)?.percentile).toBe(50);
    expect(placeOffer(payload, 50_000)?.percentile).toBe(0);
  });

  it("counts rows clipped below the first bin, and caps at 100 above the last", () => {
    expect(placeOffer({ ...payload, below: 20, stats: { ...stats, n: 120 } }, 50_000)?.percentile).toBe(17);
    expect(placeOffer(payload, 999_999)?.percentile).toBe(100);
  });

  it("refuses under the median floor, and on a zero-width histogram", () => {
    expect(placeOffer({ ...payload, stats: { ...stats, n: 29 } }, 100_000)).toBeNull();
    expect(placeOffer({ ...payload, binWidth: 0 }, 100_000)).toBeNull();
  });

  it("carries the ladder through so the caller can print the middle half", () => {
    const r = placeOffer(payload, 90_000);
    expect(r).toMatchObject({ n: 100, p25: 80_000, p50: 100_000, p75: 120_000 });
  });
});
