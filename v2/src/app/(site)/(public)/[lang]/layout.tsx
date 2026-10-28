import { notFound } from "next/navigation";

import { LangProvider } from "@/components/i18n/LangProvider";
import { PageLanguage } from "@/components/i18n/PageLanguage";
import { isLang, langTag } from "@/lib/i18n/lang";
import { LOCALES } from "@/lib/i18n/locales";

/**
 * Every translated data page sits under its language: /es/perm-case-status and the rest (plan:
 * .planning/i18n-data-pages.md). The five static guide pages (/es, /zh, ...) keep their own folders.
 *
 * The layout hands the language to everything inside it, the loading state included (loading.tsx renders
 * outside the page): client parts read it from LangProvider, the content carries its `lang`, and PageLanguage
 * sets the document's own. Any other first segment is a 404 (dynamicParams = false).
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLang(lang) || lang === "en") notFound();
  const tag = langTag(lang);
  return (
    <LangProvider lang={lang}>
      <PageLanguage tag={tag} />
      <div lang={tag}>{children}</div>
    </LangProvider>
  );
}
