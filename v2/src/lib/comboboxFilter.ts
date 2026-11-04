/**
 * The search and the keys behind FilterCombobox, kept apart from the component
 * so they can be tested on their own.
 */

export interface ComboboxOption {
  /** What the form gets. */
  value: string;
  /** What the row says, in full. */
  label: string;
  /** More words a search matches but the row doesn't show: a consulate's country. */
  keywords?: string;
}

/** Lower case, no accents, single spaces: "São Paulo" and "sao paulo" are one search. */
export function foldText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The options a search keeps, best first. Every typed word must appear in the
 * label or the keywords. A label that starts with the search comes first, then
 * one with a word that starts with it, then the rest; inside each group the
 * options keep the order they came in (busiest first, where the caller sorted
 * them that way). An empty search keeps everything.
 */
export function filterOptions<T extends ComboboxOption>(options: readonly T[], query: string): T[] {
  const q = foldText(query);
  if (!q) return [...options];
  const words = q.split(" ");
  const ranked: { o: T; rank: number; i: number }[] = [];
  options.forEach((o, i) => {
    const label = foldText(o.label);
    const hay = o.keywords ? `${label} ${foldText(o.keywords)}` : label;
    if (!words.every((w) => hay.includes(w))) return;
    const rank = label.startsWith(q) ? 0 : (` ${label}`).includes(` ${words[0]}`) ? 1 : 2;
    ranked.push({ o, rank, i });
  });
  ranked.sort((a, b) => a.rank - b.rank || a.i - b.i);
  return ranked.map((r) => r.o);
}

/** Rows a PageUp or PageDown moves. */
const PAGE = 10;

/**
 * Where the highlighted row goes for a key, given the row it's on (-1 for
 * none) and how many rows there are. Null for a key that doesn't move it.
 * Stops at the ends rather than wrapping, so holding a key can't spin past
 * the row a reader wanted.
 */
export function nextActive(key: string, active: number, count: number): number | null {
  const moves = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
  if (!moves.includes(key)) return null;
  if (count === 0) return -1;
  const last = count - 1;
  if (active < 0) return key === "End" ? last : 0;
  switch (key) {
    case "ArrowDown":
      return Math.min(active + 1, last);
    case "ArrowUp":
      return Math.max(active - 1, 0);
    case "Home":
      return 0;
    case "End":
      return last;
    case "PageDown":
      return Math.min(active + PAGE, last);
    default:
      return Math.max(active - PAGE, 0);
  }
}
