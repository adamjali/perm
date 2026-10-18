/**
 * Sorting a table of DOL rows: every sort on the site that meets a missing value.
 *
 * NULL SORTS LAST IN BOTH DIRECTIONS, and that is the only opinion in here.
 * A case with no wage is not the cheapest one, it is one DOL has not published
 * yet; letting it lead an ascending wage sort would read as a measurement. The
 * same goes for a missing decision date, which means "still open", not "decided
 * a long time ago".
 */

export type SortDir = 1 | -1;

export interface SortColumn<T> {
  key: string;
  label: string;
  /** The value to order on. `null` for "not known", which sorts last. */
  get: (row: T) => string | number | null;
  /** Sort descending on the first click. True for dates and money. */
  descFirst?: boolean;
}

export interface SortState {
  key: string;
  dir: SortDir;
}

/**
 * Two values in `dir` order, a missing one (null or empty) last whichever way.
 * The missing check sits above the direction on purpose: negating a comparator
 * that puts null after turns it into null FIRST on a descending sort, which is
 * how "no data" once topped a column sorted by median days and read as the
 * fastest employer on the page.
 */
export function compareNullsLast(x: string | number | null, y: string | number | null, dir: SortDir): number {
  const xEmpty = x === null || x === "";
  const yEmpty = y === null || y === "";
  if (xEmpty) return yEmpty ? 0 : 1;
  if (yEmpty) return -1;
  if (typeof x === "number" && typeof y === "number") return (x - y) * dir;
  return String(x).localeCompare(String(y)) * dir;
}

export function sortRows<T>(rows: T[], columns: SortColumn<T>[], state: SortState): T[] {
  const col = columns.find((c) => c.key === state.key);
  if (!col) return rows;
  return [...rows].sort((a, b) => compareNullsLast(col.get(a), col.get(b), state.dir));
}

/**
 * The next state for a click on `key`. Same column flips direction; a new one
 * starts in the direction that column is actually read in - newest first for a
 * date, highest first for money, A to Z for a name. Defaulting everything to
 * ascending makes half the headers feel broken on the first click.
 */
export function nextSort<T>(current: SortState, key: string, columns: SortColumn<T>[]): SortState {
  if (current.key === key) return { key, dir: (current.dir === 1 ? -1 : 1) as SortDir };
  const col = columns.find((c) => c.key === key);
  return { key, dir: col?.descFirst ? -1 : 1 };
}
