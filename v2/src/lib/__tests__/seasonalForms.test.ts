import { describe, expect, it } from "vitest";

import { seasonalForm, seasonalVisas } from "../seasonalForms";

describe("seasonalForm", () => {
  it.each([
    ["H-300-26100-000001", "H-2A application", "H-2A"],
    ["JO-A-300-26100-000002", "H-2A job order", "H-2A"],
    ["H-400-25300-000003", "H-2B application", "H-2B"],
    ["P-400-25300-000004", "H-2B wage request", "H-2B"],
    ["C-500-25200-000005", "CW-1 application", "CW-1"],
    ["P-500-25200-000006", "CW-1 wage request", "CW-1"],
  ])("names %s", (cn, label, visa) => {
    expect(seasonalForm(cn)).toMatchObject({ label, visa });
  });

  it("is null for a PERM, wage-request or LCA number", () => {
    for (const cn of ["G-100-26100-000001", "P-100-26100-000001", "I-200-26100-000001"]) {
      expect(seasonalForm(cn)).toBeNull();
    }
  });
});

describe("seasonalVisas", () => {
  it.each([
    [{ h2a: 0, h2b: 634, cw1: 0 }, "H-2B"],
    [{ h2a: 3, h2b: 1, cw1: 0 }, "H-2A and H-2B"],
    [{ h2a: 0, h2b: 5, cw1: 69 }, "H-2B and CW-1"],
    [{ h2a: 1, h2b: 1, cw1: 1 }, "H-2A, H-2B and CW-1"],
  ])("names only the visas filed: %o", (counts, want) => {
    expect(seasonalVisas(counts)).toBe(want);
  });

  it("falls back to all three when no count is known", () => {
    expect(seasonalVisas({ h2a: 0, h2b: 0, cw1: 0 })).toBe("H-2A, H-2B and CW-1");
  });
});
