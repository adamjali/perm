import { describe, expect, it } from "vitest";

import { EMPLOYER_MIN_DECISIONS, summariseWaits } from "./waitSummary";

// Noon Eastern on 1 September 2026.
const NOON = Date.parse("2026-09-01T16:00:00Z");
const filedDaysBefore = (d: number) =>
  new Date(Date.parse("2026-09-01T00:00:00Z") - d * 86_400_000).toISOString().slice(0, 10);

describe("summariseWaits", () => {
  it("gives quartiles over the decisions, in days", () => {
    const s = summariseWaits([290, 300, 302, 310, 400].map((d) => ({ filed: filedDaysBefore(d), stamp: NOON })));
    expect(s).toEqual({ n: 5, p25: 300, p50: 302, p75: 310 });
  });

  it("withholds the median under the minimum, and still counts", () => {
    const s = summariseWaits([300, 301].map((d) => ({ filed: filedDaysBefore(d), stamp: NOON })));
    expect(EMPLOYER_MIN_DECISIONS).toBeGreaterThan(2);
    expect(s).toEqual({ n: 2, p25: null, p50: null, p75: null });
  });

  it("dates the decision in Eastern time", () => {
    // 1 AM UTC on 2 September is still 1 September in the East.
    const late = Date.parse("2026-09-02T01:00:00Z");
    const s = summariseWaits(Array.from({ length: 5 }, () => ({ filed: filedDaysBefore(300), stamp: late })));
    expect(s.p50).toBe(300);
  });
});
