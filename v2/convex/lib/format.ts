/**
 * Number formatting shared by the site, its emails and the mail Convex
 * renders. Pure functions with no Convex imports, so a page, a component and
 * a Convex action all print the same figure the same way.
 *
 * src/ imports these through `@/lib/format`; anything Convex bundles (Convex
 * functions, src/emails and the src/lib modules they import) imports this
 * file by relative path.
 */

/**
 * 14386 to "14,386": US digit grouping. Meant for whole numbers; a fraction
 * prints as is, to at most three places.
 */
export function formatInt(n: number): string {
  return n.toLocaleString("en-US");
}

const COMPACT = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** 1094 to "1.1K", 999 to "999": a count shortened to fit a small space. Say the full count beside it for a reader. */
export function formatCompact(n: number): string {
  return COMPACT.format(n);
}

/** 0.4237 with 1 digit to "42.4%": a ratio as a percent, to `digits` places. */
export function formatPercent(ratio: number, digits: number): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/**
 * An approval rate, always to one place, as every page prints it: 99.6% must
 * never round to a clean "100%" that the record doesn't have.
 */
export function formatApprovalRate(ratio: number): string {
  return formatPercent(ratio, 1);
}

/**
 * A share of a whole: "42%" from 10% up, "3.4%" below, so a small share never
 * rounds to a misleading "0%" and a large one carries no false precision.
 */
export function formatShare(ratio: number): string {
  return formatPercent(ratio, ratio >= 0.1 ? 0 : 1);
}

/**
 * `n` of `total` as a share that never rounds to a clean 0% or 100% the counts
 * don't have: 1 of 5,172 is "under 0.1%", and 5,170 of 5,172 "over 99%".
 */
export function formatShareOf(n: number, total: number): string {
  const text = formatShare(n / total);
  if (n > 0 && /^0(\.0)?%$/.test(text)) return "under 0.1%";
  if (n < total && /^100%$/.test(text)) return "over 99%";
  return text;
}

/** 139026.51 to "$139,027". Whole dollars: a wage published to the cent is not a fact. */
export function formatDollars(n: number): string {
  return `$${formatInt(Math.round(n))}`;
}
