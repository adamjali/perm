"use client";

import { useSearchParams } from "next/navigation";
import { CaseStatusHead } from "./CaseStatusShell";

/**
 * The page's own heading and form, filled with the number in the URL, for the
 * loading state. A client component because loading.tsx gets no searchParams;
 * the route is dynamic, so reading them here does not bail out of rendering.
 */
export function LoadingHead() {
  const typed = useSearchParams().get("case") ?? "";
  return <CaseStatusHead typed={typed} />;
}
