/**
 * The language an email, and the page an emailed link opens, is written in.
 *
 * A plain module with no imports, because Convex reads it: its functions render the alert emails and the pages
 * behind their links, and Convex's build can't follow the site's `@/` paths. The list is the site's (`LANGS` in
 * lang.ts), held equal by its test.
 *
 * Where a language comes from:
 * - A sign-up form on a translated page sends its page's language with the request, so the confirmation email
 *   is in it.
 * - The confirmation link carries it (`?lang=`), so the page that opens is in it. Clicking that link is what
 *   stores it on the subscription, the same click that proves the inbox, so nobody can change the language of
 *   someone else's alerts by typing their address into a form.
 * - Every later alert reads it off the subscription, and its links carry it again.
 */

export const MAIL_LANGS = ["en", "es", "zh", "pt-br", "ko", "vi"] as const;
export type MailLang = (typeof MAIL_LANGS)[number];

/** A language as sent or stored, or English for anything else. */
export function mailLang(value: unknown): MailLang {
  return typeof value === "string" && (MAIL_LANGS as readonly string[]).includes(value) ? (value as MailLang) : "en";
}

/** What a subscription stores: nothing for English, so English rows stay as they were. */
export function storedLang(lang: MailLang): MailLang | undefined {
  return lang === "en" ? undefined : lang;
}

/** A link with the language added, for every language but English. */
export function withLang(url: string, lang: MailLang): string {
  if (lang === "en") return url;
  return `${url}${url.includes("?") ? "&" : "?"}lang=${encodeURIComponent(lang)}`;
}

/** The BCP 47 tag for `<html lang>`, matching `langTag` in lang.ts. */
export const MAIL_LANG_TAG: Record<MailLang, string> = {
  en: "en",
  es: "es",
  zh: "zh-Hans",
  "pt-br": "pt-BR",
  ko: "ko",
  vi: "vi",
};

/** The locale dates are written in, matching `intlLocale` in lang.ts. */
export const MAIL_INTL: Record<MailLang, string> = {
  en: "en-US",
  es: "es",
  zh: "zh-CN",
  "pt-br": "pt-BR",
  ko: "ko-KR",
  vi: "vi-VN",
};

/** One piece of words in every language an email is written in. */
export type MailMessages<T> = Record<MailLang, T>;

/** The case or translated page on the site, in the reader's language when it exists in it. */
export function sitePageIn(path: string, lang: MailLang): string {
  if (lang === "en") return path;
  const cut = path.search(/[?#]/);
  const bare = cut < 0 ? path : path.slice(0, cut);
  return MAIL_TRANSLATED_PAGES.includes(bare) ? `/${lang}${path}` : path;
}

/** The pages that exist in every language, matching `TRANSLATED_PATHS` in lang.ts. */
export const MAIL_TRANSLATED_PAGES: readonly string[] = ["/perm-case-status", "/perm-case-alerts", "/email-preferences"];
