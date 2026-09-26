import type { CountryKey } from "@/lib/perm";

/**
 * The five languages this site publishes a guide in, beyond English.
 *
 * Chosen by who actually reads the site (PostHog, 30 days to 2026-09-26:
 * Spanish 351 engaged readers, Portuguese 227, Chinese 149 plus readers in
 * China, Korean 87, Vietnamese 70; Arabic 20 and Hindi 1 were skipped).
 *
 * ONE PAGE PER LANGUAGE, and it is a guide, not the data pages. The data pages
 * are English on purpose: their values are DOL's and State's own words, and a
 * machine-translated status or cutoff is a wrong fact wearing the reader's
 * language. Each guide is the English guide `/guides/waiting-on-your-green-card`
 * localized for its readers, with the live figures they ask about (DOL's queue,
 * their country's bulletin cutoffs) and the English status words glossed.
 *
 * hreflang runs both ways: every localized page names the English guide and
 * its four siblings, and the English guide names all five (see
 * `createContentDetailPage`). `x-default` is the English guide.
 */

export type LocaleCode = "zh" | "es" | "pt-br" | "ko" | "vi";

export interface LocaleDef {
  code: LocaleCode;
  /** The page's path on this site. */
  path: string;
  /** BCP 47 tag, used for hreflang AND the `lang` attribute on the content. */
  tag: string;
  /** The locale `Intl` formats dates and numbers in. */
  intl: string;
  /** The language's own name for itself, shown in the switcher. */
  endonym: string;
  englishName: string;
  /**
   * Bulletin columns this page's readers are charged to, their own first.
   * Chargeability follows the country of BIRTH, so a Brazilian-born reader
   * is in the column for every country not listed separately.
   */
  countries: readonly CountryKey[];
}

export const LOCALES: readonly LocaleDef[] = [
  { code: "zh", path: "/zh", tag: "zh-Hans", intl: "zh-CN", endonym: "简体中文", englishName: "Simplified Chinese", countries: ["china", "worldwide"] },
  { code: "es", path: "/es", tag: "es", intl: "es", endonym: "Español", englishName: "Spanish", countries: ["mexico", "worldwide"] },
  { code: "pt-br", path: "/pt-br", tag: "pt-BR", intl: "pt-BR", endonym: "Português (Brasil)", englishName: "Brazilian Portuguese", countries: ["worldwide"] },
  { code: "ko", path: "/ko", tag: "ko", intl: "ko-KR", endonym: "한국어", englishName: "Korean", countries: ["worldwide"] },
  { code: "vi", path: "/vi", tag: "vi", intl: "vi-VN", endonym: "Tiếng Việt", englishName: "Vietnamese", countries: ["worldwide"] },
];

/** The English page every localized guide is a version of. */
export const ENGLISH_GUIDE = "/guides/waiting-on-your-green-card";

export function localeByCode(code: LocaleCode): LocaleDef {
  const def = LOCALES.find((l) => l.code === code);
  if (!def) throw new Error(`unknown locale: ${code}`);
  return def;
}

/**
 * The hreflang map for a page in the set, or null for any other page.
 * The same map serves every member, which is what makes the links reciprocal.
 */
export function languageAlternates(path: string): Record<string, string> | null {
  const inSet = path === ENGLISH_GUIDE || LOCALES.some((l) => l.path === path);
  if (!inSet) return null;
  return {
    en: ENGLISH_GUIDE,
    ...Object.fromEntries(LOCALES.map((l) => [l.tag, l.path])),
    "x-default": ENGLISH_GUIDE,
  };
}

/**
 * Roughly how wide a string renders, in Latin-character units: a CJK or
 * Hangul character is about two. Search results cut a title by pixels, so a
 * 60-character cap written for English lets a Chinese title run twice as long.
 */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    w += /[ᄀ-ᇿ⺀-鿿가-힯豈-﫿＀-｠]/.test(ch) ? 2 : 1;
  }
  return w;
}
