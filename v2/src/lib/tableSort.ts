/**
 * Sorting a table of DOL rows, shared because there are now two callers.
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

export function sortRows<T>(rows: T[], columns: SortColumn<T>[], state: SortState): T[] {
  const col = columns.find((c) => c.key === state.key);
  if (!col) return rows;
  return [...rows].sort((a, b) => {
    const x = col.get(a);
    const y = col.get(b);
    const xEmpty = x === null || x === "";
    const yEmpty = y === null || y === "";
    if (xEmpty) return yEmpty ? 0 : 1;
    if (yEmpty) return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * state.dir;
    return String(x).localeCompare(String(y)) * state.dir;
  });
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
