import { describe, expect, it } from "vitest";

import {
  DECIDED_FILTER_FIELDS,
  anyDecidedFilter,
  applyDecidedFilters,
  facetOptions,
} from "../decidedFilter";
import type { DecidedCase } from "@/lib/turso/decidedDays";

function c(over: Partial<DecidedCase>): DecidedCase {
  return {
    caseNumber: "A-1", program: "perm", status: "certified", decidedOn: "2021-03-01",
    receivedOn: null, employerName: "ACME", employerSlug: "acme", jobTitle: "Engineer",
    socCode: "15-1252.00", socTitle: "Software Developers", state: "WA", wage: 120000,
    wageUnit: null, attorneyName: null, attorneySlug: null, worksiteCity: null, naics: null,
    citizenship: null, visaClass: null, education: null, ...over,
  };
}

const field = (k: string) => DECIDED_FILTER_FIELDS.find((f) => f.key === k)!;

describe("decided-half filters", () => {
  const rows = [
    c({ caseNumber: "1", citizenship: "INDIA", worksiteCity: "Seattle", state: "WA", wage: 150000 }),
    c({ caseNumber: "2", citizenship: "INDIA", worksiteCity: "Portland", state: "OR", wage: null }),
    c({ caseNumber: "3", citizenship: "CHINA", worksiteCity: "Portland", state: "ME", wage: 90000 }),
  ];

  it("offers only values the rows hold, busiest first", () => {
    expect(facetOptions(rows, field("citizenship"))).toEqual([
      { value: "INDIA", n: 2 },
      { value: "CHINA", n: 1 },
    ]);
  });

  it("keeps two Portlands apart by state", () => {
    expect(facetOptions(rows, field("city")).map((o) => o.value)).toEqual([
      "Portland, ME", "Portland, OR", "Seattle, WA",
    ]);
  });

  it("combines filters, and a wage bound drops a row with no wage", () => {
    expect(applyDecidedFilters(rows, { citizenship: "INDIA" }).map((r) => r.caseNumber)).toEqual(["1", "2"]);
    expect(applyDecidedFilters(rows, { citizenship: "INDIA", wageMin: 100000 }).map((r) => r.caseNumber)).toEqual(["1"]);
    expect(applyDecidedFilters(rows, { city: "Portland, OR" }).map((r) => r.caseNumber)).toEqual(["2"]);
  });

  it("knows when nothing is set", () => {
    expect(anyDecidedFilter({})).toBe(false);
    expect(anyDecidedFilter({ wageMax: 1 })).toBe(true);
  });
});
