import { describe, expect, it } from "vitest";

import { CHARTED_CLASSES, RANKED_CLASSES, WORK_CLASSES, classRows, isWorkClass, monthsTo, nivClass, rankPosts } from "../niv";

/** Reading State's nonimmigrant issuances by post: the class names, the work visas first, the rankings. */

describe("the nonimmigrant classes", () => {
  it("names a class as people write it, with what it is", () => {
    expect(nivClass("H1B")).toEqual({ name: "H-1B", what: "specialty occupation worker" });
    expect(nivClass("K1")).toEqual({ name: "K-1", what: "fiancé(e)" });
    expect(nivClass("B1/B2").name).toBe("B-1/B-2");
  });

  it("shows a symbol State's list doesn't name as State prints it", () => {
    expect(nivClass("C4/D3")).toEqual({ name: "C4/D3", what: "as State's table prints it" });
  });

  it("counts the work visas and their families, and nothing else, as work", () => {
    for (const c of ["H1B", "H4", "L1", "L2", "H1B1", "H2A", "H2B", "H3", "E1", "E2", "E3", "O1", "P1", "R1", "TN", "CW1"]) {
      expect(isWorkClass(c), c).toBe(true);
    }
    for (const c of ["K1", "B1/B2", "F1", "J1", "BBBCC", "C1/D", "G4", "A2"]) expect(isWorkClass(c), c).toBe(false);
    expect(new Set(WORK_CLASSES).size).toBe(WORK_CLASSES.length);
    for (const c of [...WORK_CLASSES, ...CHARTED_CLASSES, ...RANKED_CLASSES]) expect(nivClass(c).what, c).not.toMatch(/State's table prints/);
  });
});

describe("a post's table", () => {
  const months = monthsTo("2026-02", 3);
  const byMonth = new Map<string, Record<string, number>>([
    ["2025-12", { K1: 2, H1B: 5, "B1/B2": 300 }],
    ["2026-01", { L1: 4, F1: 9 }],
    ["2026-02", { "B1/B2": 410, K1: 3, H4: 2, H1B: 7, J1: 0 }],
  ]);

  it("ends its months at State's newest table", () => {
    expect(months).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(monthsTo("2026-02", 12)[0]).toBe("2025-03");
  });

  it("lists the work visas first in their order, then the rest by the newest month", () => {
    const rows = classRows(byMonth, months);
    expect(rows.map((r) => r.symbol)).toEqual(["H1B", "H4", "L1", "B1/B2", "K1", "F1"]);
    expect(rows.find((r) => r.symbol === "K1")).toMatchObject({ name: "K-1", newest: 3, year: 5, work: false });
    expect(rows.find((r) => r.symbol === "L1")).toMatchObject({ newest: 0, year: 4, work: true });
  });

  it("leaves out a class with nothing in the months shown", () => {
    expect(classRows(byMonth, months).some((r) => r.symbol === "J1")).toBe(false);
    expect(classRows(new Map(), months)).toEqual([]);
  });
});

describe("the consulates' ranking", () => {
  const rows = [
    { post_key: "manila", post: "Manila", visa_class: "K1", n: 376 },
    { post_key: "mumbai", post: "Mumbai", visa_class: "H1B", n: 900 },
    { post_key: "london", post: "London", visa_class: "K1", n: 79 },
    { post_key: "ciudad juarez", post: "Ciudad Juarez", visa_class: "K1", n: 146 },
    { post_key: "accra", post: "Accra", visa_class: "K1", n: 0 },
  ];

  it("ranks one class, most first, and lists no post that issued none", () => {
    expect(rankPosts(rows, "K1").map((r) => [r.post, r.n])).toEqual([["Manila", 376], ["Ciudad Juarez", 146], ["London", 79]]);
    expect(rankPosts(rows, "L1")).toEqual([]);
  });
});
