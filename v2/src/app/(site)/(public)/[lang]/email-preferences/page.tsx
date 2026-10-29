import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmailPreferencesPage, emailPreferencesMetadata } from "../../email-preferences/EmailPreferencesPage";
import { isLang } from "@/lib/i18n/lang";
import { LOCALES } from "@/lib/i18n/locales";

/** /email-preferences in each translation: the same page, in the reader's language. */
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang) || lang === "en") notFound();
  return emailPreferencesMetadata(lang);
}

export default async function TranslatedEmailPreferencesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang) || lang === "en") notFound();
  return <EmailPreferencesPage lang={lang} />;
}
