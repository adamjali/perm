import { MONTH_ABBR, shortDate } from "@convex/lib/months";

/** "2026-09-11" to "Sep 11, 2026". Shared by the strip, the rows and the page. */
export function dayLabel(iso: string): string {
  return shortDate(iso) ?? iso;
}

export function monthYear(iso: string): string {
  const m = MONTH_ABBR[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7);
  return `${m} ${iso.slice(0, 4)}`;
}
