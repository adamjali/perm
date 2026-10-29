"use client";

/**
 * Shares the case-independent estimate corpus down the signed-in app's client
 * tree.
 *
 * The corpus is a `server-only` read of the public mirror (see
 * `src/lib/db/appCaseCorpus.ts`), so each route that shows estimates loads it
 * in its server component and wraps its client content in this provider. The
 * case card is deep inside the cases list, so a context beats drilling the blob
 * through every list component. A component with no provider above it reads
 * null and renders its own "estimate unavailable" state rather than throwing.
 *
 * @module
 */

import { createContext, useContext, type ReactNode } from "react";

import type { AppCaseCorpus } from "@/lib/db/appCaseCorpus";

const CaseCorpusContext = createContext<AppCaseCorpus | null>(null);

export function CaseCorpusProvider({
  corpus,
  children,
}: {
  corpus: AppCaseCorpus | null;
  children: ReactNode;
}) {
  return <CaseCorpusContext.Provider value={corpus}>{children}</CaseCorpusContext.Provider>;
}

/** The shared corpus, or null when none was provided (render an absence, never throw). */
export function useCaseCorpus(): AppCaseCorpus | null {
  return useContext(CaseCorpusContext);
}
