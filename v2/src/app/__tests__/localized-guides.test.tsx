import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const guideData = vi.fn();
vi.mock("@/lib/i18n/guideData", () => ({ getGuideData: () => guideData() }));

import { LocalizedGuide, localizedGuideMetadata } from "@/components/i18n/LocalizedGuide";
import { createContentDetailPage } from "@/lib/content/createContentDetailPage";
import { countryCutoffRows } from "@/lib/i18n/cutoffs";
import { GUIDE_COPY } from "@/lib/i18n/guide";
import { GLOSSED_STATUSES } from "@/lib/i18n/guide/types";
import { ENGLISH_GUIDE, LOCALES, displayWidth, languageAlternates } from "@/lib/i18n/locales";
import { getStatusMeaning } from "@/lib/permStatus";

/**
 * The five localized guides, rendered with a fixed day's figures. What must
 * hold: the page declares its language on the content, every figure and DOL
 * word is left untranslated, every link lands on a page that exists, hreflang
 * runs both ways, and titles fit a search result by rendered width.
 */

const APP = join(__dirname, "..");
const PUBLIC = join(APP, "(site)", "(public)");
const CONTENT = join(APP, "..", "..", "content");

const BULLETIN = {
  bulletinMonth: "2026-09",
  finalAction: {
    EB1: { worldwide: "C", china: "15FEB23", mexico: "C" },
    EB2: { worldwide: "01DEC24", china: "01JAN22", mexico: "01DEC24" },
    EB3: { worldwide: "01SEP24", china: "01JAN22", mexico: "01SEP24" },
    EW3: { worldwide: "01APR22", china: "01MAY19", mexico: "U" },
  },
  datesForFiling: {
    EB2: { worldwide: "15JUL25", china: "01OCT22", mexico: "15JUL25" },
  },
};

const DATA = {
  perm: { month: "2025-11", asOf: "2026-08-31", averageDays: 336 },
  pwdMonth: "2026-04",
  bulletin: {
    month: "2026-09",
    rows: Object.fromEntries(
      (["worldwide", "china", "mexico", "india", "philippines"] as const).map((c) => [c, countryCutoffRows(BULLETIN, c)]),
    ),
  },
};

const html = async (code: (typeof LOCALES)[number]["code"]) => renderToStaticMarkup(await LocalizedGuide({ code }));

beforeEach(() => {
  guideData.mockReset().mockResolvedValue(DATA);
});

describe.each(LOCALES.map((l) => [l.code, l] as const))("/%s", (code, locale) => {
  it("declares its language on the content and leaves every figure untranslated", async () => {
    const out = await html(code);
    expect(out).toContain(`<div lang="${locale.tag}"`);
    const month = new Date("2025-11-15T12:00:00Z").toLocaleDateString(locale.intl, { year: "numeric", month: "long", timeZone: "UTC" });
    expect(out).toContain(`<span translate="no">${month}</span>`);
    expect(out).toContain(`<span translate="no">${(336).toLocaleString(locale.intl)}</span>`);
    expect(out).toContain('<span translate="no">G-100-26125-868956</span>');
    for (const s of GLOSSED_STATUSES) expect(out).toContain(`<dt class="font-bold" translate="no">${s}</dt>`);
  });

  it("sends the lookup to the case page and prints the reader's own columns", async () => {
    const out = await html(code);
    expect(out).toMatch(/<form[^>]*action="\/perm-case-status"[^>]*method="get"/);
    expect(out).toContain('name="case"');
    const own = locale.countries[0]!;
    const copy = GUIDE_COPY[code];
    expect(out).toContain(copy.cutoffs.countryName[own]!.replace(/'/g, "&#x27;"));
    // C and U stay the bulletin's letters, with the gloss beside them.
    expect(out).toContain('<b translate="no">C</b>');
    // A cell the bulletin did not print says so.
    expect(out).toContain(copy.cutoffs.notPrinted);
    // The same country appears once per table, never the other readers' columns.
    expect((out.match(/<caption/g) ?? []).length).toBe(locale.countries.length);
  });

  it("renders in its own script, with no dashes", async () => {
    const out = await html(code);
    const script: Record<string, RegExp> = {
      zh: /[一-鿿]/,
      ko: /[가-힯]/,
      vi: /[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđ]/,
      es: /[áéíóúñ¿]/,
      "pt-br": /[ãõçáéê]/,
    };
    expect(String(GUIDE_COPY[code].lede)).toMatch(script[code]!);
    const text = out.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/[—–]|——/);
  });

  it("links only to pages that exist", async () => {
    const out = await html(code);
    const hrefs = [...out.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]!);
    expect(hrefs.length).toBeGreaterThan(10);
    for (const h of new Set(hrefs)) {
      const page = join(PUBLIC, ...h.split("/").filter(Boolean), "page.tsx");
      const mdx = h.startsWith("/guides/") ? join(CONTENT, `${h.slice(1)}.mdx`) : null;
      expect(existsSync(page) || (mdx !== null && existsSync(mdx)) || h === "/", h).toBe(true);
    }
  });

  it("says so in its own language when DOL's figures or the bulletin can't be read", async () => {
    guideData.mockResolvedValue({ perm: null, pwdMonth: null, bulletin: null });
    const out = await html(code);
    expect(out).not.toContain("<table");
    expect(out).not.toContain("<caption");
    expect(out).toContain('href="/visa-bulletin"');
    expect(out).toContain('href="/perm-queue"');
  });

  it("fits a search result, names every version, and is served by its own route", () => {
    const meta = localizedGuideMetadata(code);
    // " | PERM Tracker" is 15; a CJK character renders about two wide.
    expect(displayWidth(String(meta.title))).toBeLessThanOrEqual(45);
    expect(displayWidth(String(meta.description))).toBeLessThanOrEqual(155);
    expect(meta.alternates?.canonical).toBe(locale.path);
    expect(meta.alternates?.languages).toEqual(languageAlternates(locale.path));
    const route = readFileSync(join(PUBLIC, locale.path.slice(1), "page.tsx"), "utf8");
    expect(route).toContain(`localizedGuideMetadata("${code}")`);
    expect(route).toContain(`<LocalizedGuide code="${code}" />`);
  });
});

describe("the glossary", () => {
  it("explains only statuses DOL actually uses, spelled as the site's own decoder spells them", () => {
    for (const s of GLOSSED_STATUSES) expect(getStatusMeaning(s), s).not.toBeNull();
  });
});

describe("the English guide", () => {
  it("names all five versions back, from the same map", async () => {
    const { generateMetadata } = createContentDetailPage("guides");
    const meta = await generateMetadata({ params: Promise.resolve({ slug: ENGLISH_GUIDE.split("/").pop()! }) });
    expect(meta.alternates?.languages).toEqual(languageAlternates(ENGLISH_GUIDE));
    const other = await generateMetadata({ params: Promise.resolve({ slug: "how-the-visa-bulletin-works" }) });
    expect(other.alternates?.languages).toBeUndefined();
  });
});
