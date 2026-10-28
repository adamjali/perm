"use client";

import { createContext, useContext } from "react";

import type { Lang } from "@/lib/i18n/lang";

/**
 * The page's language for client components (a form, a push button). English when no provider wraps them, so
 * every English page works untouched. Server components take `lang` as a prop from the page instead.
 */
const LangContext = createContext<Lang>("en");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}
