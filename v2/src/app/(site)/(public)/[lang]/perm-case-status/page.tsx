import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CaseStatusPage, caseStatusMetadata } from "../../perm-case-status/CaseStatusPage";
import { isLang } from "@/lib/i18n/lang";
import { LOCALES } from "@/lib/i18n/locales";

/** /perm-case-status in each translation: the same page, in the reader's language. */
export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((l) => ({ lang: l.code }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ case?: string }>;
}): Promise<Metadata> {
  const [{ lang }, { case: raw }] = await Promise.all([params, searchParams]);
  if (!isLang(lang) || lang === "en") notFound();
  return caseStatusMetadata(lang, raw);
}

export default async function TranslatedCaseStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ case?: string }>;
}) {
  const [{ lang }, { case: raw }] = await Promise.all([params, searchParams]);
  if (!isLang(lang) || lang === "en") notFound();
  return <CaseStatusPage lang={lang} raw={raw} />;
}
