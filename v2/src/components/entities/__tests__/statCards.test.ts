import { describe, expect, it } from "vitest";

import { approvalCard, medianDaysCard, yearTrend, type EntityStanding } from "@/components/entities/EntityPageParts";
import { rateReliability } from "@/components/tools/EntityContext";

const yr = (fy: number, n: number) => ({ fy, certified: n, denied: 0, withdrawn: 0 });

describe("yearTrend", () => {
  it("compares the last two complete fiscal years, leaving out a partial one", () => {
    expect(yearTrend([yr(2024, 288), yr(2025, 653), yr(2026, 937)], 2026)).toEqual({ text: "Up 127% in FY2025", dir: "up", tone: "info" });
  });

  it("says a drop, and calls a change under 5% level", () => {
    expect(yearTrend([yr(2024, 100), yr(2025, 60)], null)).toEqual({ text: "Down 40% in FY2025", dir: "down", tone: "info" });
    expect(yearTrend([yr(2024, 100), yr(2025, 103)], null)?.dir).toBe("level");
  });

  it("says nothing over a gap year or a base too small for a share", () => {
    expect(yearTrend([yr(2022, 100), yr(2025, 60)], null)).toBeUndefined();
    expect(yearTrend([yr(2024, 12), yr(2025, 60)], null)).toBeUndefined();
    expect(yearTrend([yr(2025, 60)], null)).toBeUndefined();
  });
});

describe("approvalCard", () => {
  it("reads above the field as good and below as bad, naming the field's rate", () => {
    expect(approvalCard(rateReliability(1859, 4, 3.2), 3.2).trend).toEqual({ text: "Above the field's 96.8%", dir: "up", tone: "good" });
    expect(approvalCard(rateReliability(900, 100, 3.2), 3.2).trend).toMatchObject({ dir: "down", tone: "bad" });
  });

  it("draws no chip when the rate is withheld", () => {
    expect(approvalCard(rateReliability(3, 0, 3.2), 3.2).trend).toBeUndefined();
  });
});

describe("medianDaysCard", () => {
  const standing = (daysDelta: number | null, fieldDays: number | null): EntityStanding => ({
    reliability: rateReliability(500, 5, 3.2),
    inCohort: true,
    daysDelta,
    fieldDays,
    thinMedian: false,
  });

  it("calls a wait within 5% of the field's near it, in a neutral chip", () => {
    expect(medianDaysCard(482, standing(16, 466)).trend).toEqual({ text: "Near the field's 466", dir: "level", tone: "neutral" });
  });

  it("calls a much longer wait bad and a much shorter one good", () => {
    expect(medianDaysCard(600, standing(134, 466)).trend).toMatchObject({ text: "134 slower than the field's 466", tone: "bad" });
    expect(medianDaysCard(300, standing(-166, 466)).trend).toMatchObject({ text: "166 faster than the field's 466", tone: "good" });
  });
});
