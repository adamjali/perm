import { describe, expect, it } from "vitest";

import {
  FLAG_FILTER_FIELDS,
  anyFlagFilter,
  flagFacetOptions,
  passesFlagFilters,
  type FlagFilterItem,
} from "../flagFilter";
import type { FlagDisclosedRow } from "@/lib/turso/flagCases";

function file(over: Partial<FlagDisclosedRow>): FlagDisclosedRow {
  return {
    caseNumber: "I-200-25001-000001", status: "Certified", receivedDate: "2025-01-01",
    decisionDate: "2025-01-08", employerName: "ACME", employerSlug: "acme", jobTitle: "Engineer",
    socCode: "15-1252.00", socTitle: "Software Developers", wage: 120000, wageUnit: "Year",
    worksiteState: "WA", visaClass: "H-1B", fiscalYear: 2025, attorneyName: null, attorneySlug: null,
    ...over,
  };
}

const live: FlagFilterItem = { status: "IN PROCESS", file: null };
const decided: FlagFilterItem = { status: "Certified", file: file({ attorneyName: "Fragomen" }) };
const other: FlagFilterItem = { status: "Certified", file: file({ worksiteState: "CA", visaClass: "E-3", wage: 90000 }) };

describe("FLAG search filters", () => {
  it("drops a pending row on a field only the quarterly file carries", () => {
    expect(passesFlagFilters(live, { state: "WA" })).toBe(false);
    expect(passesFlagFilters(decided, { state: "WA" })).toBe(true);
    // The status lives on both halves, so a status filter can keep a pending row.
    expect(passesFlagFilters(live, { status: "IN PROCESS" })).toBe(true);
  });

  it("applies every filter together, and a wage bound drops a row with no wage", () => {
    expect(passesFlagFilters(decided, { state: "WA", firm: "Fragomen", wageMin: 100000 })).toBe(true);
    expect(passesFlagFilters(other, { visa: "E-3", wageMax: 100000 })).toBe(true);
    expect(passesFlagFilters(other, { visa: "E-3", wageMin: 100000 })).toBe(false);
    expect(passesFlagFilters(live, { wageMin: 0 })).toBe(false);
  });

  it("lists a field's values busiest first, and skips rows without one", () => {
    const state = FLAG_FILTER_FIELDS.find((f) => f.key === "state")!;
    expect(flagFacetOptions([live, decided, decided, other], state)).toEqual([
      { value: "WA", n: 2 },
      { value: "CA", n: 1 },
    ]);
  });

  it("knows when nothing is set", () => {
    expect(anyFlagFilter({})).toBe(false);
    expect(anyFlagFilter({ state: "" })).toBe(false);
    expect(anyFlagFilter({ wageMin: 0 })).toBe(true);
  });
});
