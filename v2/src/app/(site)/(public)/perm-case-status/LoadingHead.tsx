"use client";

import { useSearchParams } from "next/navigation";
import { useLang } from "@/components/i18n/LangProvider";
import { CaseStatusHead } from "./CaseStatusShell";

/**
 * The page's own heading and form, filled with the number in the URL, for the
 * loading state. A client component because loading.tsx gets no searchParams;
 * loading.tsx wraps it in a boundary, because Next prerenders the loading state.
 * The language comes from the `[lang]` layout's provider (English without one).
 */
export function LoadingHead() {
  const typed = useSearchParams().get("case") ?? "";
  return <CaseStatusHead typed={typed} loading lang={useLang()} />;
}

/** The same head with an empty box: the boundary's fallback, which must not read the URL. */
export function LoadingHeadBlank() {
  return <CaseStatusHead typed="" loading lang={useLang()} />;
}
