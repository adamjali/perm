import { format, parseISO } from "date-fns";

/** Animation variant used by all 6 tabs + next-up-section. */
export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

/** ISO date string -> "MMM d, yyyy" */
export function fmtISODate(d?: string | null): string {
  if (!d) return "\u2014";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

/** ISO date string -> "MMM d" */
export function fmtISOShort(d?: string | null): string {
  if (!d) return "\u2014";
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
