import { describe, expect, it } from "vitest";

import {
  FAMILY_SIZE,
  approvalRate,
  countedBefore,
  approvedByPriorityDate,
  estimateLine,
  lagMonths,
  monthIndex,
  pendingByPriorityDate,
} from "./greenCardLine";
import { lineSnapshot } from "./__tests__/greenCardLine.fixture";

/** The shared made-up EB-3 Other Workers line; see the fixture for its numbers. */
const snapshot = lineSnapshot;

const EW3_ROW = { category: "EW3" as const, country: "worldwide" as const };

describe("estimateLine: who is ahead", () => {
  it("calls a date before the final action cutoff current", () => {
    const r = estimateLine({ ...EW3_ROW, priorityDate: "2021-12-15" }, snapshot());
    expect(r.kind).toBe("current");
  });

  it("calls every date current when the chart prints C", () => {
    const r = estimateLine({ category: "EB2", country: "worldwide", priorityDate: "2025-06-01" }, snapshot());
    expect(r.kind).toBe("current");
  });

  it("puts every principal USCIS counted ahead of a date past all of them, and never more", () => {
    const r = estimateLine({ ...EW3_ROW, priorityDate: "2031-01-01" }, snapshot());
    if (r.kind !== "estimate") throw new Error(r.kind);
    // The anchor: the approved part is USCIS's own total times family size,
    // whatever the lag scenario.
    expect(r.parts.approvedWaiting.low).toBeCloseTo(5000 * FAMILY_SIZE.EW3.low, 6);
    expect(r.parts.approvedWaiting.high).toBeCloseTo(5000 * FAMILY_SIZE.EW3.high, 6);
  });

  it("puts nobody from the approved count ahead of a date in the cutoff's own month", () => {
    const r = estimateLine({ ...EW3_ROW, priorityDate: "2022-04-01" }, snapshot());
    if (r.kind !== "estimate") throw new Error(r.kind);
    expect(r.parts.approvedWaiting.high).toBe(0);
  });

  it("grows as the priority date moves later", () => {
    const at = (pd: string) => {
      const r = estimateLine({ ...EW3_ROW, priorityDate: pd }, snapshot());
      if (r.kind !== "estimate") throw new Error(r.kind);
      return r.peopleAhead.mid;
    };
    expect(at("2023-01-01")).toBeLessThan(at("2024-01-01"));
    expect(at("2024-01-01")).toBeLessThan(at("2025-01-01"));
  });

  it("counts the current-but-unfinished I-485s as a range over USCIS's withheld cells", () => {
    const r = estimateLine({ ...EW3_ROW, priorityDate: "2023-06-01" }, snapshot());
    if (r.kind !== "estimate") throw new Error(r.kind);
    expect(r.parts.currentUnfinished).toEqual({ low: 102, high: 120 });
  });

  it("divides by the visas the line actually issued, and says it cannot when there is none", () => {
    const r = estimateLine({ ...EW3_ROW, priorityDate: "2024-06-01" }, snapshot());
    if (r.kind !== "estimate") throw new Error(r.kind);
    expect(r.years!.low).toBeCloseTo(r.peopleAhead.low / 2000, 9);
    expect(r.years!.high).toBeCloseTo(r.peopleAhead.high / 2000, 9);
    const none = estimateLine({ ...EW3_ROW, priorityDate: "2024-06-01" }, snapshot({ supply: null }));
    if (none.kind !== "estimate") throw new Error(none.kind);
    expect(none.years).toBeNull();
  });

  it("draws a histogram that adds up to the mid figure less the I-485 part", () => {
    const r = estimateLine({ ...EW3_ROW, priorityDate: "2025-03-01" }, snapshot());
    if (r.kind !== "estimate") throw new Error(r.kind);
    const drawn = r.histogram.reduce((n, h) => n + h.people, 0);
    expect(drawn).toBeCloseTo(r.peopleAhead.mid - (102 + 120) / 2, 6);
    expect(r.histogram[0]!.month).toBe("2022-04");
    expect(r.histogram[r.histogram.length - 1]!.month).toBe("2025-02");
  });

  it("measures from the last dated cutoff when the chart reads U, and treats earlier dates as current", () => {
    const shut = snapshot();
    shut.latest!.finalAction.EW3.worldwide = { kind: "unavailable" };
    shut.latest!.lastDated.EW3.worldwide = { iso: "2022-04-01", month: "2026-08" };
    const before = estimateLine({ ...EW3_ROW, priorityDate: "2022-01-01" }, shut);
    expect(before.kind).toBe("current");
    const after = estimateLine({ ...EW3_ROW, priorityDate: "2024-01-01" }, shut);
    if (after.kind !== "estimate") throw new Error(after.kind);
    expect(after.front).toEqual({ iso: "2022-04-01", month: "2026-08" });
    expect(after.latestCutoff.kind).toBe("unavailable");
  });

  it("refuses rather than guessing when USCIS's counts are missing", () => {
    expect(estimateLine({ ...EW3_ROW, priorityDate: "2024-01-01" }, snapshot({ awaiting: null })).kind).toBe("no-data");
    expect(estimateLine({ ...EW3_ROW, priorityDate: "2024-01-01" }, snapshot({ i140: null })).kind).toBe("no-data");
    expect(estimateLine({ ...EW3_ROW, priorityDate: "2024-1-1" }, snapshot()).kind).toBe("no-data");
  });
});

describe("placing approvals on the priority-date axis", () => {
  it("moves a PERM-based receipt back by the measured PERM time plus the filing delay", () => {
    // Received in November 2024 (FY2025 Q1): 455 days of PERM, plus 0 to 6 months.
    const r = monthIndex("2024-11-01");
    expect(lagMonths(r, "EW3", "low")).toBeCloseTo(455 / 30.4375, 6);
    expect(lagMonths(r, "EW3", "high")).toBeCloseTo(455 / 30.4375 + 6, 6);
  });

  it("uses the stated assumption before DOL decisions are held, and zero for a national interest waiver", () => {
    const r = monthIndex("2019-05-01");
    expect(lagMonths(r, "E21", "low")).toBe(6);
    expect(lagMonths(r, "E21", "high")).toBe(12);
    expect(lagMonths(r, "NIW", "high")).toBe(0);
  });

  it("keeps every approval: shifting moves them, it never adds or drops any", () => {
    const s = snapshot();
    for (const sc of ["low", "mid", "high"] as const) {
      const m = approvedByPriorityDate(s.i140!, "EW3", "rowmex", sc);
      const total = [...m.values()].reduce((n, v) => n + v, 0);
      expect(total).toBeCloseTo(1200 * 5 + 900, 6);
    }
  });

  it("spreads a part-year across only the months it covers", () => {
    const s = snapshot();
    s.i140!.approved.EW3.rowmex = { 2026: 900 };
    const m = approvedByPriorityDate(s.i140!, "EW3", "rowmex", "low");
    // Nine months of 100 (October to June), not twelve of 75. The newest
    // receipt is June 2026, decided-quarter lag 440 days (14.46 months), so
    // nothing may land after April 2025; spread over twelve months it would
    // reach July 2025.
    const total = [...m.values()].reduce((n, v) => n + v, 0);
    expect(total).toBeCloseTo(900, 6);
    const last = Math.max(...[...m.keys()]);
    expect(last).toBe(monthIndex("2025-04-01"));
  });

  it("takes the approval rate from complete years only", () => {
    // 2021-2023: 3,600 approved, 1,200 denied.
    expect(approvalRate(snapshot().i140!, "EB3", "rowmex")).toBeCloseTo(0.75, 9);
  });

  it("counts pending petitions at the approval rate, in this line's share of the preference", () => {
    const s = snapshot();
    const m = pendingByPriorityDate(s.i140!, "EW3", "rowmex", "mid");
    const total = [...m.values()].reduce((n, v) => n + v, 0);
    // All approvals are EW3 here, so the share is 1: (120 + 300) x 0.75.
    expect(total).toBeCloseTo(420 * 0.75, 6);
    // And an EB-3 line with no approvals of its own takes none of it.
    expect([...pendingByPriorityDate(s.i140!, "EB3", "rowmex", "mid").values()].length).toBe(0);
  });
});

describe("USCIS's own I-485 count as a floor and a check", () => {
  const withFiled = (cells: Array<[string, number, number]>) => {
    const s = snapshot();
    s.latest!.datesForFiling.EW3.worldwide = { kind: "date", iso: "2022-08-01" };
    s.i485Filed = {
      asOf: "2026-08-05",
      cells: { EB2: {}, EB3: {}, EW3: { worldwide: cells.map(([m, n, sup]) => [monthIndex(`${m}-01`), n, sup] as [number, number, number]) } },
    };
    return s;
  };

  it("counts only cells before the reader's month, with USCIS's withheld cells as 1 to 10", () => {
    const s = withFiled([["2022-05", 800, 2], ["2022-07", 900, 0]]);
    expect(countedBefore(s, "EW3", "worldwide", monthIndex("2022-06-01"))).toEqual({ low: 802, high: 820 });
    expect(countedBefore(s, "EW3", "worldwide", monthIndex("2022-08-01"))).toEqual({ low: 1702, high: 1720 });
    expect(countedBefore(snapshot(), "EW3", "worldwide", monthIndex("2022-08-01"))).toBeNull();
  });

  it("never lets the range sit below what USCIS counted", () => {
    const s = withFiled([["2022-05", 90000, 0]]);
    const r = estimateLine({ ...EW3_ROW, priorityDate: "2022-06-15" }, s);
    if (r.kind !== "estimate") throw new Error(r.kind);
    expect(r.counted).toEqual({ low: 90000, high: 90000 });
    expect(r.peopleAhead.low).toBeGreaterThanOrEqual(90000);
    expect(r.peopleAhead.mid).toBeGreaterThanOrEqual(r.peopleAhead.low);
    expect(r.peopleAhead.mid).toBeLessThanOrEqual(r.peopleAhead.high);
  });

  it("compares the estimate with the count at the filing cutoff, and flags a disagreement past 2x", () => {
    const agree = estimateLine({ ...EW3_ROW, priorityDate: "2024-01-01" }, withFiled([["2022-05", 1250, 0]]));
    if (agree.kind !== "estimate") throw new Error(agree.kind);
    expect(agree.check!.at).toBe("2022-08-01");
    expect(agree.check!.counted).toEqual({ low: 1250, high: 1250 });
    // The ratio is the estimate's middle scenario over the count, so it sits
    // inside the estimate's own range divided by the count.
    expect(agree.check!.ratio).toBeGreaterThanOrEqual(agree.check!.estimate.low / 1250);
    expect(agree.check!.ratio).toBeLessThanOrEqual(agree.check!.estimate.high / 1250);
    expect(agree.check!.disagrees).toBe(false);
    // Other Workers mostly get their visas abroad, so a gap is expected there
    // and is never called a disagreement.
    const far = estimateLine({ ...EW3_ROW, priorityDate: "2024-01-01" }, withFiled([["2022-05", 40, 0]]));
    if (far.kind !== "estimate") throw new Error(far.kind);
    expect(far.check!.comparable).toBe(false);
    expect(far.check!.disagrees).toBe(false);
    expect(far.check!.scaled).toBeNull();
  });

  it("calls a comparable line's gap past 2x a disagreement, and scales the range by it", () => {
    // The same made-up line relabelled EB-2 India, a category that mostly
    // adjusts inside the US.
    const s = withFiled([["2022-05", 40, 0]]);
    const move = <T,>(r: Record<string, Record<string, T>>) => { r.EB2 = { india: r.EW3!.worldwide! }; };
    move(s.awaiting!.counts as never); move(s.awaiting!.cutoffIso as never);
    move(s.latest!.finalAction as never); move(s.latest!.datesForFiling as never); move(s.latest!.lastDated as never);
    move(s.i485Filed!.cells as never); move(s.i485Available!.counts as never); move(s.supply!.perYear as never);
    s.i140!.approved.E21 = { ...s.i140!.approved.E21, india: s.i140!.approved.EW3.rowmex };
    s.i140!.pending.EB2 = { ...s.i140!.pending.EB2, india: s.i140!.pending.EB3.rowmex };
    s.i140!.denied.EB2 = { ...s.i140!.denied.EB2, india: s.i140!.denied.EB3.rowmex };
    const r = estimateLine({ category: "EB2", country: "india", priorityDate: "2024-01-01" }, s);
    if (r.kind !== "estimate") throw new Error(r.kind);
    expect(r.check!.comparable).toBe(true);
    expect(r.check!.disagrees).toBe(true);
    expect(r.check!.scaled!.low).toBeCloseTo(Math.max(r.counted!.low, r.peopleAhead.low / r.check!.ratio), 6);
    expect(r.check!.scaled!.high).toBeCloseTo(Math.max(r.counted!.low, r.peopleAhead.high / r.check!.ratio), 6);
  });

  it("makes no check where the filing chart is not past the final action date", () => {
    const s = withFiled([["2022-05", 800, 0]]);
    s.latest!.datesForFiling.EW3.worldwide = { kind: "date", iso: "2022-04-01" };
    const r = estimateLine({ ...EW3_ROW, priorityDate: "2024-01-01" }, s);
    if (r.kind !== "estimate") throw new Error(r.kind);
    expect(r.check).toBeNull();
  });
});
