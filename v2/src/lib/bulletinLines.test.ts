import { describe, expect, it } from "vitest";

import {
  LINE_PAGE_COUNTRIES,
  fiscalYearMoves,
  inventoryRange,
  lineSlug,
  lineSlugs,
  parseLineSlug,
  uscisCode,
} from "./bulletinLines";
import type { Cutoff } from "@/lib/perm";

const d = (iso: string): Cutoff => ({ kind: "date", iso });
const C: Cutoff = { kind: "current" };
const U: Cutoff = { kind: "unavailable" };

describe("line slugs", () => {
  it("reads as the category then the country, in words people search", () => {
    expect(lineSlug("EB2", "india")).toBe("eb2-india");
    expect(lineSlug("EW3", "worldwide")).toBe("eb3-other-workers-rest-of-world");
    expect(lineSlug("EB5HU", "china")).toBe("eb5-high-unemployment-china");
  });

  it("round-trips every line the archive can hold", () => {
    for (const slug of lineSlugs(["EB1", "EB2", "EB3", "EW3", "EB4", "EB5", "EB5R", "EB5HU", "EB5I"])) {
      const p = parseLineSlug(slug);
      expect(p, slug).not.toBeNull();
      expect(lineSlug(p!.category, p!.country)).toBe(slug);
    }
  });

  it("lists five countries for each category the archive holds, and skips codes it has no name for", () => {
    const all = lineSlugs(["EB2", "EW3", "XX9"]);
    expect(all).toHaveLength(2 * LINE_PAGE_COUNTRIES.length);
    expect(all.some((s) => s.startsWith("xx9"))).toBe(false);
  });

  it("refuses anything that isn't a line, including a bulletin month", () => {
    for (const bad of ["2026-09", "eb2", "eb2-canada", "eb9-india", "EB2-INDIA", "eb2-india-extra", ""]) {
      expect(parseLineSlug(bad), bad).toBeNull();
    }
  });
});

describe("fiscalYearMoves", () => {
  it("takes each fiscal year from its first bulletin to its last, October to September", () => {
    const rows = fiscalYearMoves([
      { month: "2024-09", cutoff: d("2012-01-01") },
      { month: "2024-10", cutoff: d("2012-06-01") },
      { month: "2025-03", cutoff: d("2012-05-01") },
      { month: "2025-09", cutoff: d("2013-01-01") },
      { month: "2025-10", cutoff: d("2013-02-01") },
    ]);
    expect(rows.map((r) => r.fy)).toEqual([2026, 2025, 2024]); // newest first
    const fy25 = rows.find((r) => r.fy === 2025)!;
    expect(fy25.start).toEqual({ month: "2024-10", cutoff: d("2012-06-01") });
    expect(fy25.end).toEqual({ month: "2025-09", cutoff: d("2013-01-01") });
    expect(fy25.movedDays).toBe(214);
    expect(fy25.backwards).toBe(1);
    expect(fy25.partial).toBe(false);
    // One bulletin of FY2024 and one of FY2026: both partial.
    expect(rows.find((r) => r.fy === 2024)!.partial).toBe(true);
    expect(rows.find((r) => r.fy === 2026)!.partial).toBe(true);
  });

  it("gives no day count when either end isn't a date", () => {
    const [row] = fiscalYearMoves([
      { month: "2022-10", cutoff: C },
      { month: "2023-09", cutoff: d("2019-01-01") },
    ]);
    expect(row!.movedDays).toBeNull();
  });

  it("counts a shut line as a step backwards, and reopening as none", () => {
    const [row] = fiscalYearMoves([
      { month: "2022-10", cutoff: d("2019-01-01") },
      { month: "2023-06", cutoff: U },
      { month: "2023-09", cutoff: d("2019-02-01") },
    ]);
    expect(row!.backwards).toBe(1);
  });
});

describe("inventoryRange", () => {
  it("counts each withheld cell as 1 to 10 people", () => {
    expect(inventoryRange(100, 2)).toEqual({ low: 102, high: 120 });
    expect(inventoryRange(0, 0)).toEqual({ low: 0, high: 0 });
  });
});

describe("uscisCode", () => {
  it("maps the bulletin's unreserved EB-5 row to USCIS's EB5U, and the rest to themselves", () => {
    expect(uscisCode("EB5")).toBe("EB5U");
    expect(uscisCode("EW3")).toBe("EW3");
    expect(uscisCode("EB5R")).toBe("EB5R");
  });
});
