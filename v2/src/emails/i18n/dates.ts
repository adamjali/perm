/**
 * Dates and months in an email's language, written out by hand rather than through `Intl`, so an email reads the
 * same whichever runtime renders it (a Convex function, a test, the preview server). English is the site's own
 * form, "August 5, 2026" (`formatAsOf`).
 */

import type { MailLang } from "../../lib/i18n/mailLang";
import { MONTH_NAMES } from "../../../convex/lib/months";

// English month names come from the one source (convex/lib/months.ts); only the other languages are spelled here.
const MONTHS: Record<"es" | "pt-br", readonly string[]> = {
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  "pt-br": ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
};

function parts(value: string, withDay: boolean): { y: number; m: number; d: number } | null {
  const match = withDay ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = withDay ? Number(match[3]) : 1;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** "2026-08-05" as a day in the reader's language, or null when it isn't a date. */
export function mailDay(iso: string | null | undefined, lang: MailLang): string | null {
  const p = iso ? parts(iso, true) : null;
  if (!p) return null;
  switch (lang) {
    case "en":
      return `${MONTH_NAMES[p.m - 1]} ${p.d}, ${p.y}`;
    case "es":
    case "pt-br":
      return `${p.d} de ${MONTHS[lang][p.m - 1]} de ${p.y}`;
    case "zh":
      return `${p.y}年${p.m}月${p.d}日`;
    case "ko":
      return `${p.y}년 ${p.m}월 ${p.d}일`;
    case "vi":
      return `ngày ${p.d} tháng ${p.m} năm ${p.y}`;
  }
}

/** "2025-11" as a month in the reader's language, or null when it isn't a month. */
export function mailMonth(ym: string | null | undefined, lang: MailLang): string | null {
  const p = ym ? parts(ym, false) : null;
  if (!p) return null;
  switch (lang) {
    case "en":
      return `${MONTH_NAMES[p.m - 1]} ${p.y}`;
    case "es":
    case "pt-br":
      return `${MONTHS[lang][p.m - 1]} de ${p.y}`;
    case "zh":
      return `${p.y}年${p.m}月`;
    case "ko":
      return `${p.y}년 ${p.m}월`;
    case "vi":
      return `tháng ${p.m} năm ${p.y}`;
  }
}

/** A whole number with the reader's digit grouping: 12,345 in English, 12.345 in Spanish and Portuguese. */
export function mailInt(n: number, lang: MailLang): string {
  const neg = n < 0;
  const whole = Math.abs(Math.round(n)).toString();
  const sep = lang === "es" || lang === "pt-br" || lang === "vi" ? "." : ",";
  // Spanish style leaves four-digit numbers ungrouped (RAE); every other language here groups from four digits.
  if (lang === "es" && whole.length <= 4) return (neg ? "-" : "") + whole;
  const parts: string[] = [];
  for (let i = whole.length; i > 0; i -= 3) parts.unshift(whole.slice(Math.max(0, i - 3), i));
  return (neg ? "-" : "") + parts.join(sep);
}
