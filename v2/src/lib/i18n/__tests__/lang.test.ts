import { describe, expect, it } from "vitest";

import { breadcrumbTrail } from "@/lib/breadcrumbs";
import { dayLabel, intLabel, monthLabel } from "@/lib/i18n/format";
import { LANGS, hrefLangFor, isLang, localizedPath, pageAlternates, translatedPage } from "@/lib/i18n/lang";

describe("languages and translated addresses", () => {
  it("knows English and the five translations, nothing else", () => {
    expect(LANGS).toEqual(["en", "zh", "es", "pt-br", "ko", "vi"]);
    expect(isLang("es")).toBe(true);
    expect(isLang("fr")).toBe(false);
  });

  it("keeps a translated page in the reader's language, and any other page in English", () => {
    expect(localizedPath("/perm-case-status", "es")).toBe("/es/perm-case-status");
    expect(localizedPath("/perm-case-status?case=G-100-1", "zh")).toBe("/zh/perm-case-status?case=G-100-1");
    expect(localizedPath("/perm-case-status", "en")).toBe("/perm-case-status");
    expect(localizedPath("/perm-queue", "es")).toBe("/perm-queue");
    // An anchor or a query keeps its place, and an anchor never hides a translated page.
    expect(localizedPath("/perm-case-alerts#digest", "ko")).toBe("/ko/perm-case-alerts#digest");
    expect(localizedPath("/email-preferences?x=1#top", "vi")).toBe("/vi/email-preferences?x=1#top");
    expect(localizedPath("/perm-queue#top", "es")).toBe("/perm-queue#top");
  });

  it("names every version in one hreflang map, English as x-default", () => {
    const map = pageAlternates("/perm-case-status");
    expect(map).toEqual({
      en: "/perm-case-status",
      "zh-Hans": "/zh/perm-case-status",
      es: "/es/perm-case-status",
      "pt-BR": "/pt-br/perm-case-status",
      ko: "/ko/perm-case-status",
      vi: "/vi/perm-case-status",
      "x-default": "/perm-case-status",
    });
  });

  it("reads a translated page's address, and only a translated page's", () => {
    expect(translatedPage("/es/perm-case-status")).toEqual({ lang: "es", page: "/perm-case-status" });
    expect(translatedPage("/pt-br/perm-case-status")).toEqual({ lang: "pt-br", page: "/perm-case-status" });
    expect(translatedPage("/es")).toBeNull();
    expect(translatedPage("/es/perm-queue")).toBeNull();
    expect(translatedPage("/fr/perm-case-status")).toBeNull();
  });
});

describe("links that leave the reader's language", () => {
  it("are marked English only from a translated page, and only when the target isn't translated", () => {
    expect(hrefLangFor("/perm-employers", "es")).toBe("en");
    expect(hrefLangFor("/settings?tab=notifications", "zh")).toBe("en");
    expect(hrefLangFor("/perm-case-alerts#digest", "es")).toBeUndefined();
    expect(hrefLangFor("/perm-case-status?case=G-100-1", "ko")).toBeUndefined();
    expect(hrefLangFor("/perm-employers", "en")).toBeUndefined();
  });
});

describe("a translated page's breadcrumb", () => {
  it("is home and the page, in the page's language, never the language guide", () => {
    expect(breadcrumbTrail("/es/perm-case-status")).toEqual([
      { name: "Inicio", href: "/" },
      { name: "Estado de caso PERM", href: "/es/perm-case-status" },
    ]);
    expect(breadcrumbTrail("/zh/perm-case-status").map((c) => c.name)).toEqual(["首页", "PERM 案件状态"]);
  });

  it("leaves the language guide's own trail alone", () => {
    expect(breadcrumbTrail("/es").at(-1)?.href).toBe("/es");
  });
});

describe("dates and numbers in the reader's language", () => {
  it("formats English exactly as the English pages always have", () => {
    expect(monthLabel("2025-11", "en")).toBe("November 2025");
    expect(dayLabel("2026-10-21", "en")).toBe("October 21, 2026");
    expect(intLabel(93219, "en")).toBe("93,219");
  });

  it("formats each translation in its own conventions", () => {
    expect(monthLabel("2025-11", "es")).toBe("noviembre de 2025");
    expect(dayLabel("2026-10-21", "es")).toBe("21 de octubre de 2026");
    expect(intLabel(93219, "es")).toBe("93.219");
    expect(monthLabel("2025-11", "zh")).toBe("2025年11月");
    expect(monthLabel("2025-11", "pt-br")).toBe("novembro de 2025");
  });

  it("reads every date in UTC, so a month never slips a day at night", () => {
    expect(monthLabel("2025-12-01", "en")).toBe("December 2025");
    expect(dayLabel("2026-01-01", "en")).toBe("January 1, 2026");
  });

  it("answers null for a value that isn't a date", () => {
    expect(monthLabel("not a month", "es")).toBeNull();
    expect(dayLabel(null, "es")).toBeNull();
  });
});
