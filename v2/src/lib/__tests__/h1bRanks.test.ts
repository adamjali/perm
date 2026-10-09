import { describe, expect, it } from "vitest";

import {
  concentration,
  defaultYear,
  fyLabel,
  fyShort,
  hasBasis,
  parseH1bSummary,
  parseView,
  rankedRows,
  shareWords,
  stateFromSlug,
  stateSlug,
  viewQuery,
  willfulShown,
  type H1bRankRow,
} from "@/lib/h1bRanks";

const place = (lcas: number, uscisAppr: number) => ({
  lcas, lcaEmployers: 3, lcaTop10: lcas, positions: lcas, uscisAppr, uscisEmployers: 3, uscisTop10: uscisAppr, uscisNew: 1,
});

const DOC = JSON.stringify({
  top: 100,
  years: {
    "2026": { lcaThrough: "2026-06-30", uscisThrough: "2026-06-30", places: { US: place(300, 200), TX: place(50, 10) } },
    "2025": { lcaThrough: "2025-09-30", uscisThrough: "2025-09-30", places: { US: place(500, 400), TX: place(90, 20) } },
    "2019": { lcaThrough: null, uscisThrough: "2019-09-30", places: { US: place(0, 350) } },
  },
});

function row(over: Partial<H1bRankRow>): H1bRankRow {
  return {
    slug: "x", linked: true, name: "X", rankLca: null, rankUscis: null, lcas: 0, positions: 0, transfers: 0, senior: 0,
    leveled: 0, wageMedian: null, uscisNew: 0, uscisAppr: 0, uscisDen: 0, dependent: null, willful: 0, onHold: 0,
    warn2y: 0, debarred: false, ...over,
  };
}

describe("the summary doc", () => {
  const s = parseH1bSummary(DOC)!;

  it("reads every year, newest first", () => {
    expect(s.years.map((y) => y.fy)).toEqual([2026, 2025, 2019]);
  });

  it("refuses text that isn't the doc", () => {
    expect(parseH1bSummary("not json")).toBeNull();
    expect(parseH1bSummary("{}")).toBeNull();
  });

  it("opens on the newest complete year DOL's LCAs cover, not the year in progress", () => {
    expect(defaultYear(s).fy).toBe(2025);
  });

  it("opens a state page on the same year from a summary holding only that state", () => {
    // The browser gets only its own place; reading the national totals there
    // opened Texas on FY2026 with no rows (caught on the dev server, Oct 9).
    const onlyTexas = { ...s, years: s.years.map((y) => ({ ...y, places: y.places.TX ? { TX: y.places.TX } : {} })) };
    expect(defaultYear(onlyTexas, "TX").fy).toBe(2025);
    expect(parseView(new URLSearchParams(), onlyTexas, "TX").year.fy).toBe(2025);
  });

  it("names a year in progress by what it covers", () => {
    expect(fyLabel(s.years[0]!, "lca")).toBe("FY2026 so far (October 2025 to June 2026)");
    expect(fyLabel(s.years[1]!, "lca")).toBe("FY2025 (October 2024 to September 2025)");
    expect(fyShort(s.years[0]!, "lca")).toBe("FY2026 so far");
  });

  it("knows which source covers which year", () => {
    const fy2019 = s.years[2]!;
    expect(hasBasis(fy2019, "lca")).toBe(false);
    expect(hasBasis(fy2019, "uscis")).toBe(true);
  });
});

describe("the URL", () => {
  const s = parseH1bSummary(DOC)!;

  it("falls back to the default view on nonsense", () => {
    const v = parseView(new URLSearchParams("fy=1999&by=junk"), s);
    expect([v.year.fy, v.by]).toEqual([2025, "lca"]);
  });

  it("opens a year DOL's files don't reach on USCIS's ranking", () => {
    const v = parseView(new URLSearchParams("fy=2019"), s);
    expect([v.year.fy, v.by]).toEqual([2019, "uscis"]);
  });

  it("writes nothing for the default view", () => {
    expect(viewQuery(2025, "lca", s)).toBe("");
    expect(viewQuery(2026, "uscis", s)).toBe("?fy=2026&by=uscis");
  });
});

describe("the figures", () => {
  it("says a small share as one in N, a large one as a percent", () => {
    expect(shareWords(83_914, 531_108)).toBe("1 in 6");
    expect(shareWords(60, 100)).toBe("60%");
    expect(shareWords(0, 100)).toBe("none");
  });

  it("splits the year into the ten busiest, the rest listed, and everyone else", () => {
    const rows = Array.from({ length: 12 }, (_, i) => row({ slug: `e${i}`, rankLca: i + 1, lcas: 10 }));
    const c = concentration(rows, { ...place(500, 0), lcaEmployers: 40 }, "lca");
    expect([c.top, c.next, c.rest]).toEqual([100, 20, 380]);
    expect([c.topCount, c.nextCount, c.restCount]).toEqual([10, 2, 28]);
  });

  it("lists only rows ranked on the chosen source, in rank order", () => {
    const rows = [row({ slug: "b", rankUscis: 2 }), row({ slug: "a", rankLca: 1, rankUscis: 1 }), row({ slug: "c", rankLca: 2 })];
    expect(rankedRows(rows, "uscis").map((r) => r.slug)).toEqual(["a", "b"]);
    expect(rankedRows(rows, "lca").map((r) => r.slug)).toEqual(["a", "c"]);
  });

  it("shows a willful-violator mark only when most of the year's LCAs carry it", () => {
    expect(willfulShown(row({ lcas: 6418, willful: 1 }))).toBe(false);
    expect(willfulShown(row({ lcas: 10, willful: 6 }))).toBe(true);
  });
});

describe("state addresses", () => {
  it("round-trips every state's slug", () => {
    expect(stateSlug("TX")).toBe("texas");
    expect(stateSlug("DC")).toBe("district-of-columbia");
    expect(stateFromSlug("new-york")).toBe("NY");
    expect(stateFromSlug("TEXAS")).toBe("TX");
    expect(stateFromSlug("atlantis")).toBeNull();
  });
});
