/**
 * The site's one fuzzy matcher: what every search falls back on when an exact
 * match finds nothing, and what the 404 page uses to say "did you mean".
 *
 * Names here arrive as DOL prints them (capitals, punctuation, form words,
 * "Wal-Mart" beside "Walmart"), page titles as the menus name them, and paths
 * as someone typed them. So a score is the best of two readings:
 *
 * - WORD BY WORD: each word of the query against its closest word in the
 *   candidate (exact, a prefix, or within a few edits for a long enough
 *   word), weighted by the word's length;
 * - LETTERS ONLY: the query and the candidate with their spaces taken out,
 *   so "walmart" finds "Wal-Mart" and "j p morgan" finds "JPMorgan".
 *
 * A query contained at the start of a word scores above either, and one that
 * ends on a word boundary above that, so "intel" ranks Intel Corporation
 * ahead of Intellectt. Plain arithmetic, no dependencies, so the same code
 * runs in the browser and on the server.
 */

/** Lowercase, accents and punctuation gone, "&" read as "and", one space between words. */
export function normalizeText(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Optimal string alignment distance (Damerau-Levenshtein with adjacent swaps),
 * stopping early: anything over `max` comes back as `max + 1`.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  const n = b.length;
  let prev2 = new Array<number>(n + 1).fill(0);
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  let cur = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let rowMin = cur[0];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2]! + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    [prev2, prev, cur] = [prev, cur, prev2];
  }
  return Math.min(prev[n]!, max + 1);
}

/** Edits a word of this length may carry and still count: none for 3 letters or fewer. */
function allowedEdits(len: number): number {
  if (len <= 3) return 0;
  if (len <= 5) return 1;
  if (len <= 8) return 2;
  return 3;
}

/** How well one query word matches one candidate word, 0 to 1. */
function wordScore(q: string, c: string): number {
  if (q === c) return 1;
  if (c.startsWith(q)) return q.length >= 2 ? 0.92 : 0.7;
  const allowed = allowedEdits(q.length);
  // A query word a little longer than the candidate's ("microsofts").
  if (q.startsWith(c) && c.length >= 3 && c.length >= q.length - allowed) return 0.85;
  if (allowed === 0) return 0;
  const d = editDistance(q, c, allowed);
  let best = d <= allowed ? 1 - d / Math.max(q.length, c.length) : 0;
  // A typo in a word still being typed: the query against the candidate's start.
  if (c.length > q.length) {
    const dp = editDistance(q, c.slice(0, q.length), allowed);
    if (dp <= allowed) best = Math.max(best, (1 - dp / q.length) * 0.9);
  }
  return best;
}

function scoreNormalized(nq: string, nc: string): number {
  if (!nq || !nc) return 0;
  if (nc === nq) return 1;

  // Contained at the start of a word: the strongest partial match.
  const at = nc.startsWith(nq) ? 0 : nc.indexOf(` ${nq}`) >= 0 ? nc.indexOf(` ${nq}`) + 1 : -1;
  if (at >= 0) {
    const end = at + nq.length;
    const wholeWord = end === nc.length || nc[end] === " ";
    return 0.9 + (wholeWord ? 0.05 : 0) + 0.05 * (nq.length / nc.length);
  }

  // Word by word.
  const qWords = nq.split(" ");
  const cWords = nc.split(" ");
  let weighted = 0;
  let weight = 0;
  for (const qw of qWords) {
    let best = 0;
    for (const cw of cWords) {
      const s = wordScore(qw, cw);
      if (s > best) best = s;
      if (best === 1) break;
    }
    weighted += best * qw.length;
    weight += qw.length;
  }
  const byWord = weight > 0 ? weighted / weight : 0;

  // Letters only, against the candidate's start.
  const cq = nq.replace(/ /g, "");
  const cc = nc.replace(/ /g, "");
  let byLetters = 0;
  if (cq.length >= 3) {
    if (cc.startsWith(cq)) byLetters = 0.9;
    else {
      const allowed = allowedEdits(cq.length);
      if (allowed > 0) {
        const d = editDistance(cq, cc.slice(0, cq.length), allowed);
        if (d <= allowed) byLetters = (1 - d / cq.length) * 0.85;
      }
    }
  }
  return Math.max(byWord, byLetters);
}

/** How close a candidate is to a query, 0 (nothing alike) to 1 (the same). */
export function fuzzyScore(query: string, candidate: string): number {
  return scoreNormalized(normalizeText(query), normalizeText(candidate));
}

export interface Ranked<T> {
  item: T;
  score: number;
  /** From a weighted index: the score with the item's weight applied, what the order follows. */
  weighted?: number;
}

export interface RankOptions {
  /** Most results to return. */
  limit?: number;
  /** Lowest score that counts as a match. */
  min?: number;
}

const DEFAULT_LIMIT = 5;
/** The lowest score that counts as a match: two typos in a six-letter word still pass. */
export const FUZZY_MATCH_MIN = 0.65;

/**
 * The items closest to a query, best first; ties keep the input order (which
 * callers use to put the busier employer first). An item can carry several
 * texts (a page's title and its address): the best one counts.
 */
export function rankFuzzy<T>(
  query: string,
  items: readonly T[],
  text: (item: T) => string | readonly string[],
  { limit = DEFAULT_LIMIT, min = FUZZY_MATCH_MIN }: RankOptions = {},
): Ranked<T>[] {
  const nq = normalizeText(query);
  if (!nq) return [];
  const out: (Ranked<T> & { i: number })[] = [];
  items.forEach((item, i) => {
    const t = text(item);
    const texts = typeof t === "string" ? [t] : t;
    let score = 0;
    for (const s of texts) score = Math.max(score, scoreNormalized(nq, normalizeText(s)));
    if (score >= min) out.push({ item, score, i });
  });
  out.sort((a, b) => b.score - a.score || a.i - b.i);
  return out.slice(0, limit).map(({ item, score }) => ({ item, score }));
}

/** The letter triplets of a run-together name, each once. */
function trigrams(compact: string): string[] {
  const out = new Set<string>();
  for (let i = 0; i + 3 <= compact.length; i++) out.add(compact.slice(i, i + 3));
  return [...out];
}

/** Lets the event loop run whatever is waiting before the next slice of work. */
function yieldToLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A triplet in more than this share of names says little about which one. */
const COMMON_GRAM_SHARE = 0.08;

/**
 * A prebuilt index for a long list (hundreds of thousands of names).
 *
 * CANDIDATES BY LETTER TRIPLETS. Each name is indexed by the three-letter runs
 * of its letters with the spaces taken out, and a query is scored only against
 * names sharing at least a third of its own triplets. A typo changes at most
 * three of a word's triplets and leaves the rest, and a name typed with spaces
 * it doesn't have ("j p morgan") keeps every one of them. Triplets carried by
 * a large share of names ("inc", "llc") are set aside when the query has
 * rarer ones.
 *
 * WEIGHT. Given a `weight` (an employer's filings), equally close names are
 * told apart by it, and a slightly closer name with almost no filings gives way
 * to a much busier one: someone typing "amazn" means Amazon, not the two-filing
 * "AmazngCleaning" that happens to start with those letters.
 */
export class FuzzyIndex<T> {
  private readonly entries: { item: T; norm: string; boost: number }[] = [];
  private readonly postings = new Map<string, Int32Array>();
  private lists: Map<string, number[]> | null = new Map();

  constructor(
    items: readonly T[],
    private readonly text: (item: T) => string,
    private readonly weight?: (item: T) => number,
  ) {
    this.add(items);
    this.seal();
  }

  /**
   * The same index, built a slice at a time with the event loop let go
   * between slices, for a list large enough that building it in one go would
   * hold up everything else the process is doing.
   */
  static async build<T>(
    items: readonly T[],
    text: (item: T) => string,
    weight?: (item: T) => number,
    { chunk = 5000 }: { chunk?: number } = {},
  ): Promise<FuzzyIndex<T>> {
    const index = new FuzzyIndex<T>([], text, weight);
    index.lists = new Map();
    for (let i = 0; i < items.length; i += chunk) {
      index.add(items.slice(i, i + chunk));
      await yieldToLoop();
    }
    const grams = [...index.lists.entries()];
    index.lists = null;
    for (let i = 0; i < grams.length; i += chunk) {
      for (const [g, l] of grams.slice(i, i + chunk)) index.postings.set(g, Int32Array.from(l));
      await yieldToLoop();
    }
    return index;
  }

  private add(items: readonly T[]): void {
    const lists = this.lists;
    if (!lists) throw new Error("FuzzyIndex is sealed");
    for (const item of items) {
      const i = this.entries.length;
      const norm = normalizeText(this.text(item));
      for (const g of trigrams(norm.replace(/ /g, ""))) {
        let l = lists.get(g);
        if (!l) lists.set(g, (l = []));
        l.push(i);
      }
      // From 0.85 for a name with one filing to 1 at about 3,000.
      const w = this.weight ? Math.max(0, this.weight(item)) : 0;
      const boost = this.weight ? 0.85 + 0.15 * Math.min(1, Math.log10(1 + w) / 3.5) : 1;
      this.entries.push({ item, norm, boost });
    }
  }

  private seal(): void {
    if (!this.lists) return;
    for (const [g, l] of this.lists) this.postings.set(g, Int32Array.from(l));
    this.lists = null;
  }

  get size(): number {
    return this.entries.length;
  }

  private candidates(nq: string): Iterable<number> {
    const cq = nq.replace(/ /g, "");
    // Too short for triplets: names with a word starting with the query.
    if (cq.length < 3) {
      const out: number[] = [];
      this.entries.forEach((e, i) => {
        if (e.norm.startsWith(nq) || e.norm.includes(` ${nq}`)) out.push(i);
      });
      return out;
    }
    const grams = trigrams(cq)
      .map((g) => ({ g, list: this.postings.get(g) }))
      .filter((x): x is { g: string; list: Int32Array } => x.list !== undefined);
    if (grams.length === 0) return [];
    const common = this.entries.length * COMMON_GRAM_SHARE;
    const rare = grams.filter((x) => x.list.length <= common);
    const used = rare.length >= 2 ? rare : grams;
    const need = Math.max(1, Math.ceil(trigrams(cq).length / 3) - (grams.length - used.length));
    const counts = new Uint16Array(this.entries.length);
    const hit: number[] = [];
    for (const { list } of used) {
      for (let k = 0; k < list.length; k++) {
        const id = list[k]!;
        if (counts[id] === 0) hit.push(id);
        counts[id] = counts[id]! + 1;
      }
    }
    return hit.filter((id) => counts[id]! >= need);
  }

  search(query: string, { limit = DEFAULT_LIMIT, min = FUZZY_MATCH_MIN }: RankOptions = {}): Ranked<T>[] {
    const nq = normalizeText(query);
    if (!nq) return [];
    const out: { item: T; score: number; rank: number; i: number }[] = [];
    for (const i of this.candidates(nq)) {
      const e = this.entries[i]!;
      const score = scoreNormalized(nq, e.norm);
      if (score >= min) out.push({ item: e.item, score, rank: score * e.boost, i });
    }
    out.sort((a, b) => b.rank - a.rank || a.i - b.i);
    return out.slice(0, limit).map(({ item, score, rank }) => ({ item, score, weighted: rank }));
  }
}
