import { Fragment } from "react";

import { ENGLISH_GUIDE, LOCALES, type LocaleCode } from "@/lib/i18n/locales";

/**
 * The switcher on every version of the guide, English included: each version
 * named in its own language, with its own `lang` so a screen reader reads
 * "简体中文" as Chinese, and `hrefLang` on each link.
 */
export function LanguageLinks({ current }: { current: LocaleCode | "en" }) {
  const all = [
    { key: "en", path: ENGLISH_GUIDE, tag: "en", endonym: "English" },
    ...LOCALES.map((l) => ({ key: l.code, path: l.path, tag: l.tag, endonym: l.endonym })),
  ];
  return (
    <nav aria-label="Languages" className="flex flex-wrap gap-2">
      {all.map((l) => (
        <Fragment key={l.key}>
          {" "}
          {l.key === current ? (
            <span
              lang={l.tag}
              aria-current="page"
              className="inline-flex min-h-11 items-center border-2 border-border bg-primary px-3 text-sm font-bold text-primary-foreground"
            >
              {l.endonym}
            </span>
          ) : (
            <a
              href={l.path}
              lang={l.tag}
              hrefLang={l.tag}
              className="inline-flex min-h-11 items-center border-2 border-border bg-card px-3 text-sm font-bold hover:bg-primary/20"
            >
              {l.endonym}
            </a>
          )}
        </Fragment>
      ))}
    </nav>
  );
}

