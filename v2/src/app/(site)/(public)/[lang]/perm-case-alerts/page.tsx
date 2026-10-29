import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AlertsPage, alertsPageMetadata } from "../../perm-case-alerts/AlertsPage";
import { isLang } from "@/lib/i18n/lang";
import { LOCALES } from "@/lib/i18n/locales";

/** /perm-case-alerts in each translation: the same page, in the reader's language. */
export const dynamicParams = false;
export const revalidate = 86400;

export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang) || lang === "en") notFound();
  return alertsPageMetadata(lang);
}

export default async function TranslatedAlertsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang) || lang === "en") notFound();
  return <AlertsPage lang={lang} />;
}
