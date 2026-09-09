/**
 * Translations: the scaffold, and deliberately nothing more.
 *
 * The situation guides are the pages a non-English reader most needs, and a
 * machine translation of a legal deadline is a liability, not a feature. So
 * this module holds the shape a translated site would use (the locale list,
 * the hreflang alternates a page declares) with exactly one locale in it, and
 * `languageAlternates` returns nothing until a second locale exists. Adding a
 * locale here without the translated route files behind it would tell search
 * engines about pages that 404, which is why the test refuses a locale whose
 * directory is missing.
 *
 * To add a language: add its code to LOCALES, create
 * `src/app/(site)/(public)/<locale>/...` with the reviewed translations, and
 * point `routeExists` at it. A reviewer's name goes in the guide's
 * frontmatter (`translator`), and the guide keeps `dateModified` of the
 * English source it was translated from.
 */

export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const ORIGIN = "https://permtracker.app";

/** The path a page has in a locale. English keeps the bare path. */
export function localizedPath(path: string, locale: Locale): string {
  return locale === DEFAULT_LOCALE ? path : `/${locale}${path}`;
}

/**
 * `alternates.languages` for a page's metadata, or an empty object while the
 * site has one language. Next.js accepts `x-default` beside the codes.
 */
export function languageAlternates(path: string): Record<string, string> {
  if (LOCALES.length < 2) return {};
  const out: Record<string, string> = { "x-default": `${ORIGIN}${path}` };
  for (const locale of LOCALES) out[locale] = `${ORIGIN}${localizedPath(path, locale)}`;
  return out;
}
