import type { LocaleCode } from "../locales";
import { es } from "./es";
import { ko } from "./ko";
import { ptBr } from "./pt-br";
import type { GuideCopy } from "./types";
import { vi } from "./vi";
import { zh } from "./zh";

// "Which green card fits" (/tools/which-green-card) is in every language's
// `more.links`, labelled like the other English pages (2026-09-26).

/** Every localized guide's copy, keyed by locale. A missing language is a type error. */
export const GUIDE_COPY: Record<LocaleCode, GuideCopy> = { zh, es, "pt-br": ptBr, ko, vi };
