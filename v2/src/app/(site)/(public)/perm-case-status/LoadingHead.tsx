"use client";

import { useSearchParams } from "next/navigation";
import { CaseStatusHead } from "./CaseStatusShell";

/**
 * The page's own heading and form, filled with the number in the URL, for the
 * loading state. A client component because loading.tsx gets no searchParams;
 * loading.tsx wraps it in a boundary, because Next prerenders the loading state.
 */
export function LoadingHead() {
  const typed = useSearchParams().get("case") ?? "";
  return <CaseStatusHead typed={typed} loading />;
}
