import { describe, expect, it } from "vitest";

import {
  asOfQuarterLabel,
  awaitingMoves,
  classApprovals,
  countryOrder,
  groupByState,
  monthLabel,
  monthsLabel,
  pivotAwaiting,
  quarterLabel,
  quartersOfWork,
  rankOffices,
  shareOf,
  splitOffices,
  sumMeasure,
  yearsFor,
  type OfficeRow,
} from "../uscisQuarterlyShape";

/**
 * The pure half of the USCIS quarterly pages. Every figure on those pages is
 * USCIS's own, rearranged, so what can go wrong is the rearranging: a
 * withheld cell ranked as zero, Q1 labelled with the wrong calendar year, a
 * movement computed against a cell the previous snapshot never had.
 */

function office(partial: Partial<OfficeRow> & { code: string }): OfficeRow {
  const base: OfficeRow = {
    state: "Texas", office: "Office", code: "X", suppressed: 0,
    famReceived: 0, famApproved: 0, famDenied: 0, famPending: 0,
    empReceived: 0, empApproved: 0, empDenied: 0, empPending: 0,
    humReceived: 0, humApproved: 0, humDenied: 0, humPending: 0,
    othReceived: 0, othApproved: 0, othDenied: 0, othPending: 0,
    allReceived: 0, allApproved: 0, allDenied: 0, allPending: 0,
  };
  return { ...base, ...partial };
}

describe("labels", () => {
  it("names a fiscal quarter with the calendar year its months fall in", () => {
    // USCIS's fiscal year starts in October: Q1 of FY2026 is Oct to Dec 2025.
    expect(quarterLabel(2026, 1)).toBe("FY2026 Q1 (Oct to Dec 2025)");
    expect(quarterLabel(2026, 3)).toBe("FY2026 Q3 (Apr to Jun 2026)");
    expect(quarterLabel(2026, 4)).toBe("FY2026 Q4 (Jul to Sep 2026)");
    expect(quarterLabel(2026, 9)).toBe("FY2026 Q9");
  });

  it("spells a month and a quarter as-of", () => {
    expect(monthLabel("2026-06")).toBe("June 2026");
    expect(monthLabel("June 2026")).toBe("June 2026");
    expect(asOfQuarterLabel("2026-Q3")).toBe("FY2026 Q3");
  });

  it("prints months the way USCIS does, and N/A for a withheld figure", () => {
    expect(monthsLabel(3.9)).toBe("3.9");
    expect(monthsLabel(7)).toBe("7");
    expect(monthsLabel(25.6)).toBe("25.6");
    expect(monthsLabel(null)).toBe("n/a");
  });
});

describe("awaiting a visa", () => {
  const cells = [
    { country: "TOTAL", category: "EB2", count: 391296 },
    { country: "India", category: "EB2", count: 356360 },
    { country: "China", category: "EB2", count: 34936 },
    { country: "Rest of the World", category: "EB2", count: 0 },
    { country: "TOTAL", category: "TOTAL", count: 856662 },
    { country: "India", category: "TOTAL", count: 491773 },
    { country: "China", category: "TOTAL", count: 71779 },
    { country: "Rest of the World", category: "TOTAL", count: 243954 },
  ];

  it("pivots in the page's order with India first and the total last", () => {
    const t = pivotAwaiting(cells);
    expect(t.countries).toEqual(["India", "China", "Rest of the World", "TOTAL"]);
    expect(t.categories).toEqual(["EB2", "TOTAL"]);
    expect(t.cells.India!.EB2).toBe(356360);
  });

  it("computes a share against USCIS's own TOTAL row, or nothing when it is zero", () => {
    const t = pivotAwaiting(cells);
    expect(shareOf(t, "India", "EB2")).toBeCloseTo(356360 / 391296, 6);
    expect(shareOf(t, "Rest of the World", "EB2")).toBe(0);
    expect(shareOf(pivotAwaiting([{ country: "TOTAL", category: "EB5S", count: 0 }, { country: "India", category: "EB5S", count: 0 }]), "India", "EB5S")).toBeNull();
    expect(shareOf(t, "Mexico", "EB2")).toBeNull();
  });

  it("ranks movement by size and skips a cell the previous snapshot never had", () => {
    const previous = [
      { country: "India", category: "EB2", count: 350000 },
      { country: "China", category: "EB2", count: 35000 },
    ];
    const moves = awaitingMoves(cells, previous);
    expect(moves.map((m) => `${m.country} ${m.delta}`)).toEqual(["India 6360", "China -64"]);
    expect(moves.every((m) => m.category === "EB2")).toBe(true);
  });
});

describe("the I-485 by office", () => {
  const offices = [
    office({ code: "NYC", office: "New York", state: "New York", empPending: 5679, empApproved: 1133, empDenied: 42 }),
    office({ code: "SFR", office: "San Francisco", state: "California", empPending: 9000, empApproved: 0, empDenied: 0 }),
    office({ code: "TUC", office: "Tucson", state: "Arizona", empPending: null, suppressed: 1, empApproved: 101, empDenied: 3 }),
    office({ code: "NBC", office: "National Benefits Center", state: "Service Center", empPending: 0, empApproved: 3531, empDenied: 993 }),
    office({ code: "ALL", office: "Total", state: "", empPending: 268408 }),
  ];

  it("separates field offices from service centers and drops the Total row from both", () => {
    const { fieldOffices, serviceCenters } = splitOffices(offices);
    expect(fieldOffices.map((o) => o.code)).toEqual(["NYC", "SFR", "TUC"]);
    expect(serviceCenters.map((o) => o.code)).toEqual(["NBC"]);
  });

  it("ranks by a measure and never treats a withheld cell as a small number", () => {
    const ranked = rankOffices(splitOffices(offices).fieldOffices, "empPending");
    expect(ranked.map((o) => o.code)).toEqual(["SFR", "NYC"]);
    expect(ranked.some((o) => o.code === "TUC")).toBe(false);
  });

  it("measures quarters of work only where the office decided something", () => {
    expect(quartersOfWork(offices[0]!)).toBeCloseTo(5679 / 1175, 6);
    expect(quartersOfWork(offices[1]!)).toBeNull();      // nothing decided: not a wait
    expect(quartersOfWork(offices[2]!)).toBeNull();      // pending withheld
  });

  it("sums a measure and says how many cells USCIS withheld", () => {
    expect(sumMeasure(splitOffices(offices).fieldOffices, "empPending")).toEqual({ total: 14679, withheld: 1 });
  });

  it("groups by state alphabetically with the service centers last", () => {
    const groups = groupByState(offices);
    expect(groups.map((g) => g.state)).toEqual(["Arizona", "California", "New York", "Service Center"]);
    expect(groups.find((g) => g.state === "New York")!.offices.map((o) => o.code)).toEqual(["NYC"]);
    expect(groups.some((g) => g.offices.some((o) => o.code === "ALL"))).toBe(false);
  });
});

describe("I-140 by class and country", () => {
  const cells = [
    { country: "India", preference: "ALL", measure: "total", fy: 2025, count: 100 },
    { country: "India", preference: "ALL", measure: "approved", fy: 2025, count: 60 },
    { country: "India", preference: "ALL", measure: "denied", fy: 2025, count: 15 },
    { country: "India", preference: "ALL", measure: "pending", fy: 2025, count: 25 },
    { country: "India", preference: "ALL", measure: "total", fy: 2024, count: 80 },
    { country: "India", preference: "ALL", measure: "approved", fy: 2024, count: 0 },
    { country: "India", preference: "ALL", measure: "denied", fy: 2024, count: 0 },
    { country: "India", preference: "ALL", measure: "pending", fy: 2024, count: 80 },
    { country: "India", preference: "EB2", measure: "approved_E21", fy: 2025, count: 40 },
    { country: "India", preference: "EB2", measure: "approved_NIW", fy: 2025, count: 10 },
    { country: "India", preference: "EB1", measure: "approved_E11", fy: 2025, count: 10 },
  ];

  it("lines up a country's years oldest first with shares that admit an undecided year", () => {
    const years = yearsFor(cells, "India", "ALL");
    expect(years.map((y) => y.fy)).toEqual([2024, 2025]);
    expect(years[1]).toMatchObject({ total: 100, approved: 60, denied: 15, pending: 25, pendingShare: 0.25, denialRate: 0.2 });
    expect(years[0]!.denialRate).toBeNull();
    expect(years[0]!.pendingShare).toBe(1);
  });

  it("returns class approvals in USCIS's class order with plain labels", () => {
    expect(classApprovals(cells, "India", 2025)).toEqual([
      { code: "E11", label: "Extraordinary ability", approved: 10 },
      { code: "E21", label: "Advanced degree or exceptional ability", approved: 40 },
      { code: "NIW", label: "National interest waiver", approved: 10 },
    ]);
    expect(classApprovals(cells, "India", 2024)).toEqual([]);
  });

  it("orders country sheets total-first then USCIS's top five, unknowns after", () => {
    expect(countryOrder(["Vietnam", "Zed", "India", "All Countries"])).toEqual(["All Countries", "India", "Vietnam", "Zed"]);
  });
});
