import { describe, expect, it } from "vitest";

import { editDistance, FuzzyIndex, fuzzyScore, normalizeText, rankFuzzy } from "../fuzzy";

/**
 * The one fuzzy matcher every search on the site falls back on when an exact
 * match finds nothing: names as DOL prints them (capitals, punctuation, form
 * words), page titles, and paths typed by hand.
 */
describe("normalizeText", () => {
  it("lowercases, drops punctuation and accents, and keeps word breaks", () => {
    expect(normalizeText("Amazon.com Services, LLC")).toBe("amazon com services llc");
    expect(normalizeText("  José   Pérez & Sons ")).toBe("jose perez and sons");
    expect(normalizeText("perm-processing_times")).toBe("perm processing times");
  });
});

describe("editDistance", () => {
  it("counts insertions, deletions, substitutions and swapped neighbours", () => {
    expect(editDistance("procesing", "processing", 3)).toBe(1);
    expect(editDistance("teh", "the", 3)).toBe(1);
    expect(editDistance("infosis", "infosys", 3)).toBe(1);
    expect(editDistance("kitten", "sitting", 5)).toBe(3);
  });

  it("stops past the limit instead of finishing the table", () => {
    expect(editDistance("abcdefgh", "zyxwvuts", 2)).toBe(3);
  });
});

describe("fuzzyScore", () => {
  it("scores an exact or contained name at the top", () => {
    expect(fuzzyScore("microsoft corporation", "Microsoft Corporation")).toBe(1);
    expect(fuzzyScore("microsoft", "Microsoft Corporation")).toBeGreaterThanOrEqual(0.9);
  });

  it("forgives a typo in a word", () => {
    expect(fuzzyScore("amazn", "Amazon.com Services LLC")).toBeGreaterThanOrEqual(0.7);
    expect(fuzzyScore("microsfot", "Microsoft Corporation")).toBeGreaterThanOrEqual(0.7);
    expect(fuzzyScore("perm procesing times", "PERM processing times")).toBeGreaterThanOrEqual(0.85);
  });

  it("forgives spacing: one word against two, and the reverse", () => {
    expect(fuzzyScore("walmart", "Wal-Mart Associates")).toBeGreaterThanOrEqual(0.8);
    expect(fuzzyScore("j p morgan", "JPMorgan Chase")).toBeGreaterThanOrEqual(0.8);
  });

  it("does not call unrelated names close", () => {
    expect(fuzzyScore("google", "Amazon.com Services LLC")).toBeLessThan(0.5);
    expect(fuzzyScore("deloitte", "Delta Air Lines")).toBeLessThan(0.6);
  });

  it("allows no edits on a word too short to be a typo of anything in particular", () => {
    expect(fuzzyScore("ibx", "IBM")).toBeLessThan(0.6);
    expect(fuzzyScore("ib", "IBM Corporation")).toBeGreaterThanOrEqual(0.9);
  });

  it("answers 0 for an empty query rather than matching everything", () => {
    expect(fuzzyScore("", "Anything")).toBe(0);
    expect(fuzzyScore("   ", "Anything")).toBe(0);
  });
});

describe("rankFuzzy", () => {
  const names = ["Intel Corporation", "Infosys Limited", "Infor (US) LLC", "Tata Consultancy Services"];

  it("puts the closest name first and leaves out what isn't close", () => {
    const out = rankFuzzy("infosis", names, (n) => n);
    expect(out[0]?.item).toBe("Infosys Limited");
    expect(out.map((r) => r.item)).not.toContain("Tata Consultancy Services");
  });

  it("ranks a whole-word match above the same letters inside a longer word", () => {
    const out = rankFuzzy("intel", ["Intellectt Inc", "Intel Corporation"], (n) => n);
    expect(out[0]?.item).toBe("Intel Corporation");
  });

  it("caps the list and keeps the input order for ties", () => {
    const out = rankFuzzy("inf", ["Infor A", "Infor B", "Infor C"], (n) => n, { limit: 2 });
    expect(out.map((r) => r.item)).toEqual(["Infor A", "Infor B"]);
  });

  it("matches on any of several texts an item carries", () => {
    const pages = [
      { label: "Processing times", href: "/perm-processing-times" },
      { label: "Visa bulletin", href: "/visa-bulletin" },
    ];
    const out = rankFuzzy("perm procesing times", pages, (p) => [p.label, p.href]);
    expect(out[0]?.item.href).toBe("/perm-processing-times");
  });
});

describe("FuzzyIndex", () => {
  const employers = [
    { name: "AmazngCleaning, LLC", n: 2 },
    { name: "Amazon.com Services LLC", n: 2271 },
    { name: "Microsfot Corporation", n: 1 },
    { name: "Microsoft Corporation", n: 6875 },
    { name: "JPMorgan Chase & Co.", n: 924 },
    { name: "Morgan and Morgan, P.A.", n: 1 },
    { name: "NVIDIA Corporation", n: 1772 },
    { name: "Nadia Food Inc", n: 3 },
  ];
  const index = new FuzzyIndex(employers, (e) => e.name, (e) => e.n);

  it("puts the employer people most likely meant first when two names are about as close", () => {
    expect(index.search("amazn")[0]?.item.name).toBe("Amazon.com Services LLC");
    expect(index.search("microsfot")[0]?.item.name).toBe("Microsoft Corporation");
    expect(index.search("nvdia")[0]?.item.name).toBe("NVIDIA Corporation");
  });

  it("finds a name typed with spaces it doesn't have", () => {
    expect(index.search("j p morgan")[0]?.item.name).toBe("JPMorgan Chase & Co.");
  });

  it("finds nothing for nothing like any name", () => {
    expect(index.search("zzqxw")).toEqual([]);
  });
});
