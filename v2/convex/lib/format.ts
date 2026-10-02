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

/** 0.4237 with 1 digit to "42.4%": a ratio as a percent, to `digits` places. */
export function formatPercent(ratio: number, digits: number): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/**
 * A share of a whole: "42%" from 10% up, "3.4%" below, so a small share never
 * rounds to a misleading "0%" and a large one carries no false precision.
 */
export function formatShare(ratio: number): string {
  return formatPercent(ratio, ratio >= 0.1 ? 0 : 1);
}

/** 139026.51 to "$139,027". Whole dollars: a wage published to the cent is not a fact. */
export function formatDollars(n: number): string {
  return `$${formatInt(Math.round(n))}`;
}
