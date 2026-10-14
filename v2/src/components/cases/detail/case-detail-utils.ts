/**
 * Case Detail Shared Utilities
 *
 * Formatters and the window status calculation
 * shared by all case detail tab components and the NextUp section.
 */
import { format, parseISO, differenceInDays } from "date-fns";
import type React from "react";

/** ISO date string -> "MMM d, yyyy" */
export function fmtISODate(d?: string | null): string {
  if (!d) return "-";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

/** ISO date string -> "MMM d" */
export function fmtISOShort(d?: string | null): string {
  if (!d) return "-";
  try { return format(parseISO(d), "MMM d"); } catch { return d; }
}

/** Timestamp (number) -> "MMM d, yyyy" */
export function fmtTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** USD currency formatting */
export function fmtCurrency(amount: number | string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(amount));
}

/* ------------------------------------------------------------------ */
/*  Window status calculation — shared by RecruitmentTab, ETA9089Tab, */
/*  and I140Tab to eliminate ~120 lines of duplicated logic.          */
/* ------------------------------------------------------------------ */

export interface WindowStatus {
  days: number;
  label: string;
  pct: number;
  chip: "Filed" | "Upcoming" | "Active" | "Expired";
  chipStyle: React.CSSProperties;
}

/**
 * Compute how far through a date window we are.
 *
 * @param startDate  ISO string, window opens
 * @param endDate    ISO string, window closes
 * @param options.filed  If true, show "Filed" chip at 100% (I-140 pattern)
 */
export function computeWindowStatus(
  startDate: string | undefined | null,
  endDate: string | undefined | null,
  options?: { filed?: boolean },
): WindowStatus | null {
  if (!startDate || !endDate) return null;

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  const now = new Date();
  const total = differenceInDays(end, start);

  if (options?.filed) {
    return {
      days: 0,
      label: "I-140 filed",
      pct: 100,
      chip: "Filed",
      chipStyle: { background: "var(--primary)", color: "var(--primary-foreground)" },
    };
  }

  if (now < start) {
    return {
      days: differenceInDays(start, now),
      label: "until window opens",
      pct: 0,
      chip: "Upcoming",
      chipStyle: { background: "var(--stage-eta9089)", color: "var(--primary-foreground)" },
    };
  }

  if (now <= end) {
    const remaining = differenceInDays(end, now);
    const elapsed = differenceInDays(now, start);
    return {
      days: remaining,
      label: "remaining in window",
      pct: total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0,
      chip: "Active",
      chipStyle: { background: "var(--primary)", color: "var(--primary-foreground)" },
    };
  }

  return {
    days: differenceInDays(now, end),
    label: "past expiration",
    pct: 100,
    chip: "Expired",
    chipStyle: { background: "var(--destructive)", color: "var(--destructive-foreground)" },
  };
}
