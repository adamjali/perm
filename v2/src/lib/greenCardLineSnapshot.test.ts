import { describe, expect, it } from "vitest";

import { buildLineSnapshot, lastDatedCutoff, type RawLineInputs } from "./greenCardLineSnapshot";
import type { BulletinMonth } from "@/lib/perm";

const bulletins: BulletinMonth[] = [
  { bulletinMonth: "2026-05", finalAction: { EB2: { india: "01JAN13" }, EW3: { worldwide: "01JAN22" } }, datesForFiling: {} },
  { bulletinMonth: "2026-06", finalAction: { EB2: { india: "U" }, EW3: { worldwide: "01MAR22" } }, datesForFiling: {} },
  { bulletinMonth: "2026-09", finalAction: { EB2: { india: "U", worldwide: "C" }, EW3: { worldwide: "01APR22" } }, datesForFiling: { EW3: { worldwide: "01AUG22" } } },
];

function raw(over: Partial<RawLineInputs> = {}): RawLineInputs {
  return {
    awaiting: {
      asOf: "2026-06",
      cells: [
        { country: "Rest of the World", category: "EW3", count: 43689 },
        { country: "India", category: "EB2", count: 356360 },
        { country: "TOTAL", category: "EW3", count: 57743 },
        { country: "India", category: "EB1", count: 17861 },
      ],
    },
    i140: {
      asOf: "2026-Q3",
      cells: [
        { country: "All Countries", preference: "EB3", measure: "approved_EW3", fy: 2025, count: 22587 },
        { country: "China", preference: "EB3", measure: "approved_EW3", fy: 2025, count: 221 },
        { country: "India", preference: "EB3", measure: "approved_EW3", fy: 2025, count: 29 },
        { country: "Philippines", preference: "EB3", measure: "approved_EW3", fy: 2025, count: 2252 },
        { country: "Brazil", preference: "EB3", measure: "approved_EW3", fy: 2025, count: 900 },
        { country: "All Countries", preference: "EB3", measure: "pending", fy: 2025, count: 19166 },
        { country: "India", preference: "EB2", measure: "approved_NIW", fy: 2024, count: 4011 },
      ],
    },
    i485Available: {
      asOf: "2026-08-05",
      rows: [{ country: "Rest of the World", category: "EW3", counted: 3940, suppressed: 36 }],
    },
    tableV: {
      fiscal_year: 2024,
      family: {},
      employment: {},
      grand_total: 0,
      family_base: 0,
      family_unused: 0,
      source: "",
      employment_by_chargeability: {
        china: { "2nd": 6556, "3rd": 5964, "3rd_other_workers": 177 },
        india: { "2nd": 3916, "3rd": 3643, "3rd_other_workers": 12 },
        mexico: { "2nd": 1314, "3rd": 1684, "3rd_other_workers": 2207 },
        philippines: { "2nd": 379, "3rd": 9111, "3rd_other_workers": 1047 },
        row: { "2nd": 34149, "3rd": 18164, "3rd_other_workers": 5281 },
      },
    },
    bulletins,
    ...over,
  };
}

describe("buildLineSnapshot", () => {
  it("maps USCIS's country spellings and drops the TOTAL row and other categories", () => {
    const s = buildLineSnapshot(raw());
    expect(s.awaiting!.counts.EW3.worldwide).toBe(43689);
    expect(s.awaiting!.counts.EB2.india).toBe(356360);
    expect(JSON.stringify(s.awaiting!.counts)).not.toContain("57743");
    expect(JSON.stringify(s.awaiting!.counts)).not.toContain("17861");
  });

  it("dates the count by the final action chart of the count's own month, walking back past a U", () => {
    const s = buildLineSnapshot(raw());
    expect(s.awaiting!.cutoffIso.EW3.worldwide).toBe("2022-03-01"); // June's chart, not September's
    expect(s.awaiting!.cutoffIso.EB2.india).toBe("2013-01-01"); // June read U; May's date stands
  });

  it("takes Mexico and the rest of the world as All Countries less China, India and the Philippines", () => {
    const s = buildLineSnapshot(raw());
    // Brazil stays inside: it is rest-of-world chargeability.
    expect(s.i140!.approved.EW3.rowmex[2025]).toBe(22587 - 221 - 29 - 2252);
    expect(s.i140!.approved.EW3.india[2025]).toBe(29);
    expect(s.i140!.approved.NIW.india[2024]).toBe(4011);
    expect(s.i140!.pending.EB3.rowmex[2025]).toBe(19166);
    expect(s.i140!.currentFy).toBe(2026);
    expect(s.i140!.throughQuarter).toBe(3);
  });

  it("reads each line's own Table V column, and the rest of the world's row", () => {
    const s = buildLineSnapshot(raw());
    expect(s.supply!.fy).toBe(2024);
    expect(s.supply!.perYear.EW3.worldwide).toBe(5281);
    expect(s.supply!.perYear.EB2.india).toBe(3916);
    expect(s.supply!.perYear.EB3.philippines).toBe(9111);
  });

  it("has no supply at all from a Table V written before the per-country rows existed", () => {
    const old = raw();
    delete old.tableV!.employment_by_chargeability;
    expect(buildLineSnapshot(old).supply).toBeNull();
  });

  it("keeps the newest chart as printed and the newest dated cutoff beside it", () => {
    const s = buildLineSnapshot(raw());
    expect(s.latest!.bulletinMonth).toBe("2026-09");
    expect(s.latest!.finalAction.EB2.india).toEqual({ kind: "unavailable" });
    expect(s.latest!.lastDated.EB2.india).toEqual({ iso: "2013-01-01", month: "2026-05" });
    expect(s.latest!.finalAction.EB2.worldwide).toEqual({ kind: "current" });
    expect(s.latest!.datesForFiling.EW3.worldwide).toEqual({ kind: "date", iso: "2022-08-01" });
  });

  it("returns empty parts, not a crash, when a source is missing", () => {
    const s = buildLineSnapshot(raw({ awaiting: null, i140: null, i485Available: null, tableV: null, bulletins: [] }));
    expect(s).toEqual({ awaiting: null, i140: null, i485Available: null, i485Filed: null, supply: null, latest: null });
  });

  it("finds the last dated cutoff at or before a month", () => {
    expect(lastDatedCutoff(bulletins, "EW3", "worldwide", "2026-05")).toEqual({ iso: "2022-01-01", month: "2026-05" });
    expect(lastDatedCutoff(bulletins, "EB2", "worldwide")).toBeNull();
  });
});

describe("buildLineSnapshot: the filed I-485 cells", () => {
  it("keys each cell by its priority-date month, prior years first", () => {
    const s = buildLineSnapshot(raw({
      i485Filed: {
        asOf: "2026-08-05",
        rows: [
          { country: "India", category: "EB2", pdYear: "prior", pdMonth: 0, counted: 7, suppressed: 1 },
          { country: "India", category: "EB2", pdYear: "2014", pdMonth: 3, counted: 2000, suppressed: 0 },
          { country: "India", category: "EB1", pdYear: "2022", pdMonth: 1, counted: 99, suppressed: 0 },
        ],
      },
    }));
    expect(s.i485Filed!.cells.EB2.india).toEqual([[0, 7, 1], [2014 * 12 + 2, 2000, 0]]);
    expect(JSON.stringify(s.i485Filed!.cells)).not.toContain("99");
  });
});
