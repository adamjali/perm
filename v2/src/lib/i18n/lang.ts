import { LOCALES, type LocaleCode } from "@/lib/i18n/locales";

/**
 * A page's language: English at the site's root, or one of the five translations under `/<code>/`.
 *
 * Plain module (no server-only, no React), so a client component, a server component and a test all read the
 * same list. The design is in .planning/i18n-data-pages.md.
 */
export type Lang = "en" | LocaleCode;

export const LANGS: readonly Lang[] = ["en", ...LOCALES.map((l) => l.code)];

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

/** The BCP 47 tag for `lang` attributes and hreflang. */
export function langTag(lang: Lang): string {
  return lang === "en" ? "en" : LOCALES.find((l) => l.code === lang)!.tag;
}

/** The locale `Intl` formats dates and numbers in. */
export function intlLocale(lang: Lang): string {
  return lang === "en" ? "en-US" : LOCALES.find((l) => l.code === lang)!.intl;
}

/**
 * One part's words in every language. `satisfies Messages<T>` on the literal makes a language missing a key, or
 * a key with the wrong shape, a type error, so no translation ships half done.
 */
export type Messages<T> = Record<Lang, T>;

/**
 * The pages that exist in every language, by their English path. A link to one of these from a translated page
 * stays in the reader's language; any other link goes to the English page.
 */
export const TRANSLATED_PATHS = ["/perm-case-status", "/perm-case-alerts", "/email-preferences"] as const;
export type TranslatedPath = (typeof TRANSLATED_PATHS)[number];

/** `/perm-case-status` in Spanish is `/es/perm-case-status`; a page not translated keeps its English path. */
export function localizedPath(path: string, lang: Lang): string {
  if (lang === "en") return path;
  const cut = path.search(/[?#]/);
  const bare = cut < 0 ? path : path.slice(0, cut);
  if (!isTranslatedPath(bare)) return path;
  return `/${lang}${path}`;
}

/** Whether a page exists in every language (its bare path, no query or anchor). */
export function isTranslatedPath(bare: string): bare is TranslatedPath {
  return (TRANSLATED_PATHS as readonly string[]).includes(bare);
}

/**
 * The `hreflang` a link carries on a page in `lang`: "en" when it leads to a page that is only in English, so a
 * reader (and a screen reader) knows the language changes; nothing on an English page or for a translated target.
 */
export function hrefLangFor(path: string, lang: Lang): "en" | undefined {
  if (lang === "en") return undefined;
  const cut = path.search(/[?#]/);
  return isTranslatedPath(cut < 0 ? path : path.slice(0, cut)) ? undefined : "en";
}

/**
 * The hreflang map for a translated page: every language's address, and English as x-default. The same map
 * goes on every version, which is what makes the links reciprocal (Google's rule).
 */
export function pageAlternates(path: TranslatedPath): Record<string, string> {
  return {
    en: path,
    ...Object.fromEntries(LOCALES.map((l) => [l.tag, `/${l.code}${path}`])),
    "x-default": path,
  };
}

/** "Home" in each language: the first crumb of a translated page's trail. */
export const HOME_NAME: Messages<string> = {
  en: "Home",
  es: "Inicio",
  zh: "首页",
  "pt-br": "Início",
  ko: "홈",
  vi: "Trang chủ",
};

/** Each translated page's short name, as menus and breadcrumbs show it. */
export const TRANSLATED_PAGE_NAMES: Record<TranslatedPath, Messages<string>> = {
  "/perm-case-status": {
    en: "PERM case status",
    es: "Estado de caso PERM",
    zh: "PERM 案件状态",
    "pt-br": "Status de caso PERM",
    ko: "PERM 케이스 상태",
    vi: "Tình trạng hồ sơ PERM",
  },
  "/perm-case-alerts": {
    en: "Email alerts",
    es: "Alertas por correo",
    zh: "邮件提醒",
    "pt-br": "Alertas por e-mail",
    ko: "이메일 알림",
    vi: "Thông báo qua email",
  },
  "/email-preferences": {
    en: "Email preferences",
    es: "Preferencias de correo",
    zh: "邮件偏好",
    "pt-br": "Preferências de e-mail",
    ko: "이메일 설정",
    vi: "Tùy chọn email",
  },
};

/** `/es/perm-case-status` as its language and English page, or null for any other path. */
export function translatedPage(path: string): { lang: Exclude<Lang, "en">; page: TranslatedPath } | null {
  const m = /^\/([a-z]{2}(?:-[a-z]{2})?)(\/.+)$/.exec(path);
  if (!m || !isLang(m[1]) || m[1] === "en") return null;
  const page = m[2] as TranslatedPath;
  return (TRANSLATED_PATHS as readonly string[]).includes(page) ? { lang: m[1], page } : null;
}
