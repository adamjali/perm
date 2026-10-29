import { describe, expect, it } from "vitest";

import { LANGS, TRANSLATED_PATHS, intlLocale, langTag } from "@/lib/i18n/lang";
import {
  MAIL_INTL,
  MAIL_LANGS,
  MAIL_LANG_TAG,
  MAIL_TRANSLATED_PAGES,
  mailLang,
  sitePageIn,
  storedLang,
  withLang,
} from "@/lib/i18n/mailLang";

/** The emails' copy of the site's language list can't drift from the site's own. */
describe("the languages emails are written in", () => {
  it("are the site's languages, with the same tags, locales and translated pages", () => {
    expect([...MAIL_LANGS].sort()).toEqual([...LANGS].sort());
    for (const lang of LANGS) {
      expect(MAIL_LANG_TAG[lang], lang).toBe(langTag(lang));
      expect(MAIL_INTL[lang], lang).toBe(intlLocale(lang));
    }
    expect([...MAIL_TRANSLATED_PAGES].sort()).toEqual([...TRANSLATED_PATHS].sort());
  });

  it("reads anything that isn't a language as English", () => {
    expect(mailLang("es")).toBe("es");
    expect(mailLang("pt-br")).toBe("pt-br");
    expect(mailLang("fr")).toBe("en");
    expect(mailLang(undefined)).toBe("en");
    expect(mailLang({ toString: () => "es" })).toBe("en");
    expect(storedLang("en")).toBeUndefined();
    expect(storedLang("ko")).toBe("ko");
  });

  it("adds the language to a link, and nothing for English", () => {
    expect(withLang("https://x.app/case-alert/confirm?token=a", "zh")).toBe("https://x.app/case-alert/confirm?token=a&lang=zh");
    expect(withLang("https://x.app/prefs", "vi")).toBe("https://x.app/prefs?lang=vi");
    expect(withLang("https://x.app/prefs?token=a", "en")).toBe("https://x.app/prefs?token=a");
  });

  it("sends a link to a translated page to the reader's version, and leaves the rest", () => {
    expect(sitePageIn("/perm-case-status?case=G-100-26001-123456", "es")).toBe("/es/perm-case-status?case=G-100-26001-123456");
    expect(sitePageIn("/perm-case-status#watch", "ko")).toBe("/ko/perm-case-status#watch");
    expect(sitePageIn("/visa-bulletin", "es")).toBe("/visa-bulletin");
    expect(sitePageIn("/perm-case-status", "en")).toBe("/perm-case-status");
  });
});
