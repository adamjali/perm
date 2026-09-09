import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, languageAlternates, LOCALES, localizedPath } from "../i18n";

describe("i18n scaffold", () => {
  it("declares no hreflang alternates while the site has one language", () => {
    if (LOCALES.length === 1) {
      expect(languageAlternates("/guides/perm-rfi-issued-what-to-do")).toEqual({});
    } else {
      const alt = languageAlternates("/guides/perm-rfi-issued-what-to-do");
      expect(alt["x-default"]).toBe("https://permtracker.app/guides/perm-rfi-issued-what-to-do");
      for (const l of LOCALES) expect(alt[l]).toBeDefined();
    }
  });

  it("keeps English on the bare path and prefixes every other locale", () => {
    expect(localizedPath("/glossary", DEFAULT_LOCALE)).toBe("/glossary");
    for (const l of LOCALES) {
      if (l !== DEFAULT_LOCALE) expect(localizedPath("/glossary", l)).toBe(`/${l}/glossary`);
    }
  });

  it("refuses a locale that has no route directory behind it", () => {
    for (const l of LOCALES) {
      if (l === DEFAULT_LOCALE) continue;
      expect(existsSync(join(process.cwd(), "src/app/(site)/(public)", l)), `locale ${l} declared without routes`).toBe(true);
    }
  });
});
