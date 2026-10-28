import { intlLocale, type Lang } from "@/lib/i18n/lang";

/**
 * Dates and numbers in the reader's language, through `Intl`, never hand-built: "November 2025", "noviembre de
 * 2025", "2025年11月". Every date in this project is a UTC ISO string, so every format reads it in UTC (a local
 * zone moves a date by a day for part of every night).
 */

/** "2025-11" or "2025-11-14" as its month: "November 2025". Null for a value that isn't an ISO date. */
export function monthLabel(iso: string | null | undefined, lang: Lang): string | null {
  const m = /^(\d{4})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  return new Intl.DateTimeFormat(intlLocale(lang), { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)),
  );
}

/** "2026-10-21" as a day: "October 21, 2026", "21 de octubre de 2026". Null for a value that isn't an ISO day. */
export function dayLabel(iso: string | null | undefined, lang: Lang): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return null;
  return new Intl.DateTimeFormat(intlLocale(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))),
  );
}

/** A whole number with the language's grouping: "93,219", "93.219", "93 219". */
export function intLabel(n: number, lang: Lang): string {
  return new Intl.NumberFormat(intlLocale(lang), { maximumFractionDigits: 0 }).format(n);
}
