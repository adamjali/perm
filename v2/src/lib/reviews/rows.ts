/**
 * How the reviews page lays its cards out in rows (ReviewCarousel). A plain module, because the server page reads
 * IN_ROWS_MAX too, and a constant exported from a "use client" file reaches a server component as a client
 * reference, not a number.
 */

/** From this many reviews the rows drift; fewer sit still. */
export const DRIFT_FROM = 4;

/** The most reviews the rows hold; past it the page lists every review below them. */
export const IN_ROWS_MAX = 36;

/** One row, then a second from 12 reviews and a third from 24 (each row then holds at least 6), never more. */
export function rowsFor(count: number): number {
  return count >= 24 ? 3 : count >= 12 ? 2 : 1;
}

/** Newest first, dealt across the rows in turn, so every row opens with a recent review. */
export function dealRows<T>(items: T[], rows: number): T[][] {
  const out = Array.from({ length: Math.max(1, rows) }, () => [] as T[]);
  items.forEach((item, i) => out[i % out.length]!.push(item));
  return out;
}
