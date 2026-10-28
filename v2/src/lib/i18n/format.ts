import { intlLocale, type Lang } from "@/lib/i18n/lang";
import { MONTH_ABBR } from "@convex/lib/months";

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

/*
 * The short forms. For English each one returns exactly what the site's English helpers print ("Sep 2025",
 * "Sep 5, 2025", "Sep ’25", "$120,500", "83.6%"), so an English page doesn't move by a byte; the other
 * languages go through `Intl`.
 */

const MONTH_ABBR_EN = MONTH_ABBR;

function utc(iso: string | null | undefined): { y: number; m: number; d: number | null } | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(iso ?? "");
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: m[3] ? Number(m[3]) : null };
}

/** "2025-09" as "Sep 2025", "sept 2025", "2025年9月": a tight column or an axis. */
export function monthShortLabel(iso: string | null | undefined, lang: Lang): string | null {
  const p = utc(iso);
  if (!p) return null;
  if (lang === "en") return `${MONTH_ABBR_EN[p.m - 1]} ${p.y}`;
  return new Intl.DateTimeFormat(intlLocale(lang), { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(p.y, p.m - 1, 1)),
  );
}

/** "2025-09-05" as "Sep 5, 2025", "5 sept 2025", "2025年9月5日". */
export function dayShortLabel(iso: string | null | undefined, lang: Lang): string | null {
  const p = utc(iso);
  if (!p || p.d === null) return null;
  if (lang === "en") return `${MONTH_ABBR_EN[p.m - 1]} ${p.d}, ${p.y}`;
  return new Intl.DateTimeFormat(intlLocale(lang), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(p.y, p.m - 1, p.d)),
  );
}

/**
 * A month as a chart tick: "Sep ’25" in English, "25年9月" and "25년 9월" in Chinese and Korean, "9/25" in
 * Spanish and Vietnamese and "09/25" in Portuguese (a short month and a two-digit year there read as a day of the month).
 */
export function monthTickLabel(iso: string | null | undefined, lang: Lang): string | null {
  const p = utc(iso);
  if (!p) return null;
  if (lang === "en") return `${MONTH_ABBR_EN[p.m - 1]} ’${String(p.y).slice(2)}`;
  const cjk = lang === "zh" || lang === "ko";
  return new Intl.DateTimeFormat(intlLocale(lang), {
    month: cjk ? "short" : "numeric",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(p.y, p.m - 1, 1)));
}

/** Whole US dollars: "$120,500", "120.500 US$", "US$ 120.500". */
export function moneyLabel(n: number, lang: Lang): string {
  return new Intl.NumberFormat(intlLocale(lang), { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

/** A share already in percent (83.6) at a fixed number of decimals: "83.6%", "83,6 %". */
export function percentLabel(pct: number, lang: Lang, digits = 1): string {
  if (lang === "en") return `${pct.toFixed(digits)}%`;
  return new Intl.NumberFormat(intlLocale(lang), {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(pct.toFixed(digits)) / 100);
}
