import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { countryCutoffRows, newestBulletin } from "../cutoffs";
import { ENGLISH_GUIDE, LOCALES, displayWidth, languageAlternates } from "../locales";

const PUBLIC = join(__dirname, "..", "..", "..", "app", "(site)", "(public)");
const CONTENT = join(__dirname, "..", "..", "..", "..", "content");

describe("the locale registry", () => {
  it("carries the five languages chosen, each with a page on disk", () => {
    expect(LOCALES.map((l) => l.tag)).toEqual(["zh-Hans", "es", "pt-BR", "ko", "vi"]);
    for (const l of LOCALES) {
      expect(existsSync(join(PUBLIC, l.path.slice(1), "page.tsx")), l.path).toBe(true);
    }
    expect(existsSync(join(CONTENT, `${ENGLISH_GUIDE.slice(1)}.mdx`))).toBe(true);
  });

  it("gives every member of the set the SAME map, so hreflang is reciprocal", () => {
    const maps = [ENGLISH_GUIDE, ...LOCALES.map((l) => l.path)].map((p) => languageAlternates(p));
    for (const m of maps) expect(m).toEqual(maps[0]);
    expect(maps[0]).toEqual({
      en: "/guides/waiting-on-your-green-card",
      "zh-Hans": "/zh",
      es: "/es",
      "pt-BR": "/pt-br",
      ko: "/ko",
      vi: "/vi",
      "x-default": "/guides/waiting-on-your-green-card",
    });
  });

  it("names no alternates for a page outside the set", () => {
    expect(languageAlternates("/guides/how-the-visa-bulletin-works")).toBeNull();
    expect(languageAlternates("/")).toBeNull();
  });

  it("puts each reader's own country first, and only columns the bulletin prints", () => {
    const valid = new Set(["worldwide", "china", "india", "mexico", "philippines"]);
    for (const l of LOCALES) {
      expect(l.countries.length).toBeGreaterThan(0);
      expect(l.countries.at(-1)).toBe("worldwide");
      for (const c of l.countries) expect(valid.has(c)).toBe(true);
    }
  });
});

describe("displayWidth", () => {
  it("counts a CJK or Hangul character as two", () => {
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("绿卡")).toBe(4);
    expect(displayWidth("영주권")).toBe(6);
    expect(displayWidth("Tiếng Việt")).toBe(10);
  });
});

describe("country cutoff rows", () => {
  const b = (month: string, fa: Record<string, Record<string, string>>) => ({
    bulletinMonth: month,
    finalAction: fa,
    datesForFiling: { EB2: { china: "01JAN22" } },
  });

  it("reads the newest bulletin and keeps C, U and a missing cell apart", () => {
    const newest = newestBulletin([
      b("2026-08", { EB2: { china: "01JAN20" } }),
      b("2026-09", { EB1: { china: "C" }, EB2: { china: "15MAR21" }, EW3: { china: "U" } }),
      b("2025-12", {}),
    ]);
    expect(newest?.bulletinMonth).toBe("2026-09");
    const rows = countryCutoffRows(newest!, "china");
    expect(rows.map((r) => r.category)).toEqual(["EB1", "EB2", "EB3", "EW3"]);
    expect(rows[0]!.finalAction).toEqual({ kind: "current" });
    expect(rows[1]!.finalAction).toEqual({ kind: "date", iso: "2021-03-15" });
    expect(rows[1]!.datesForFiling).toEqual({ kind: "date", iso: "2022-01-01" });
    expect(rows[2]!.finalAction).toBeNull();
    expect(rows[3]!.finalAction).toEqual({ kind: "unavailable" });
  });

  it("returns null for an empty archive", () => {
    expect(newestBulletin([])).toBeNull();
  });
});
