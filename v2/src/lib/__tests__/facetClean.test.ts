import { describe, expect, it } from "vitest";

import { cleanPapers, realCities } from "@/lib/facetClean";

const row = (label: string, n: number) => ({ key: label.toLowerCase(), label, code: null, n, certified: n, denied: 0 });

describe("cleanPapers", () => {
  it("joins one paper typed four ways and drops the note, keeping every count", () => {
    const out = cleanPapers([
      row("Wisconsin State Journal", 1623),
      row("Wisconsin State Journalv", 2),
      row("Note: The mandatory recruitment ste", 1),
      row("Wisconsin StateJournal", 1),
    ]);
    expect(out).toEqual([{ key: "wisconsin state journal", label: "Wisconsin State Journal", code: null, n: 1626, certified: 1626, denied: 0 }]);
  });

  it("keeps two different papers apart, short names included", () => {
    const out = cleanPapers([row("The Seattle Times", 40), row("Seattle Weekly", 3), row("Star", 2), row("Stars", 1)]);
    expect(out.map((r) => r.label)).toEqual(["The Seattle Times", "Seattle Weekly", "Star", "Stars"]);
  });

  it("drops a form note the filer typed after the name, and joins the bare name", () => {
    const out = cleanPapers([row("The San Bernardino Sun; See Box E.5", 202), row("The San Bernardino Sun", 3)]);
    expect(out).toEqual([{ key: "the san bernardino sun; see box e.5", label: "The San Bernardino Sun", code: null, n: 205, certified: 205, denied: 0 }]);
  });

  it("joins 'The' and a bracketed publisher with the bare name", () => {
    const out = cleanPapers([row("The Mercury News (Bay Area News Group)", 5), row("Mercury News", 4)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.n).toBe(9);
  });
});

describe("realCities", () => {
  it("drops a street address typed into the city field", () => {
    expect(realCities([row("Stoughton, WI", 1877), row("1111 Veterans Dr., WI", 1)]).map((r) => r.label)).toEqual(["Stoughton, WI"]);
  });
});
