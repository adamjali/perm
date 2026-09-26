import { describe, expect, it } from "vitest";

import table from "../../../scripts/data/naics_titles.json";
import { NAICS_SECTORS, naicsSectorTitle } from "../naicsSectors";

/**
 * `naicsSectors.ts` is a hand-kept copy of the two-digit rows of the Census
 * table, small enough for a browser bundle (the full table is server-only).
 * A copy is a second source, so it is held to the table here.
 */
describe("NAICS_SECTORS", () => {
  const titles = table as unknown as Record<string, [string, number]>;
  const twos = Object.keys(titles).filter((k) => k.length === 2);

  it("holds exactly the table's two-digit codes, with its titles", () => {
    expect(twos.length).toBeGreaterThan(20);
    expect(Object.keys(NAICS_SECTORS).sort()).toEqual([...twos].sort());
    for (const k of twos) expect(NAICS_SECTORS[k]).toBe(titles[k]![0]);
  });

  it("names a six-digit code's sector", () => {
    expect(naicsSectorTitle("541511")).toBe("Professional, Scientific, and Technical Services");
    expect(naicsSectorTitle("334413")).toBe("Manufacturing");
    expect(naicsSectorTitle("99")).toBeNull();
  });
});
