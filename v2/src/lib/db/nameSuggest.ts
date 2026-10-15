import "server-only";

import { FuzzyIndex } from "@/lib/fuzzy";
import type { NameSuggestion, SuggestKind } from "@/lib/search/suggestTypes";
import { rows } from "./client";

export type { NameSuggestion, SuggestKind };

/**
 * "Did you mean" for a name search that found nothing: every employer, law
 * firm and occupation with a page, held in memory as a fuzzy index and
 * reloaded every few hours.
 *
 * WHY IN MEMORY. The name searches are LIKE scans that answer a typo with
 * nothing, and SQLite has no trigram or edit-distance index to ask. Loading
 * the names once per process (published sponsors, live-only filers and
 * employers with no PERM record, about 270,000 rows for employers) and
 * scoring in JavaScript answers in milliseconds, and only on a miss.
 *
 * Each list is ordered busiest first, so among equally close names the one
 * people most likely meant comes first.
 */

export const SUGGEST_KINDS: readonly SuggestKind[] = ["employer", "attorney", "occupation"];

interface NameRow {
  slug: string;
  name: string;
  n: number;
  published: boolean;
}

const BASE: Record<SuggestKind, string> = {
  employer: "/perm-employers",
  attorney: "/perm-attorneys",
  occupation: "/perm-wages",
};

/**
 * Each source is read in windows of its rank, which every one of these
 * tables indexes, so no single read is large enough to meet the read layer's
 * deadline however busy the database is.
 */
interface Source {
  table: string;
  count: string;
  where: string;
}

const SOURCES: Record<SuggestKind, Source[]> = {
  employer: [
    { table: "perm_entities", count: "total", where: "kind = 'employer' AND" },
    { table: "perm_live_only_index", count: "cases", where: "" },
    { table: "employer_other_index", count: "cases", where: "" },
  ],
  attorney: [{ table: "perm_entities", count: "total", where: "kind = 'attorney' AND" }],
  occupation: [{ table: "perm_entities", count: "total", where: "kind = 'occupation' AND" }],
};

/**
 * Small windows, read one after another with the event loop let go between
 * them: inside a web process busy rendering pages, a 20,000-row answer (2.6
 * MB) waited past the read layer's 20-second deadline although the database
 * returned it in 0.19 s and a bare client read it in 0.65 s.
 */
const WINDOW = 5_000;
/** Ranks run 1..N per table; this bounds a runaway loop on a corrupt rank column. */
const MAX_WINDOWS = 100;

async function readSource(src: Source): Promise<{ slug: string; name: string; n: number | string }[]> {
  const out: { slug: string; name: string; n: number | string }[] = [];
  for (let w = 0; w < MAX_WINDOWS; w++) {
    const lo = w * WINDOW;
    const part = await rows<{ slug: string; name: string; n: number | string }>(
      `SELECT slug, name, ${src.count} AS n FROM ${src.table} WHERE ${src.where} rank > ? AND rank <= ?`,
      [lo, lo + WINDOW],
    );
    out.push(...part);
    if (part.length === 0) break;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return out;
}

/** How long a loaded list is used before it's read again; the tables move nightly. */
const TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<SuggestKind, { at: number; index: Promise<FuzzyIndex<NameRow>> }>();

async function load(kind: SuggestKind): Promise<FuzzyIndex<NameRow>> {
  // One source at a time: three large reads at once is the load that starved.
  const parts: Awaited<ReturnType<typeof readSource>>[] = [];
  for (const src of SOURCES[kind]) {
    parts.push(
      await readSource(src).catch((e: unknown) => {
        // A table the deployment doesn't hold yet is no names, not an outage;
        // anything else is an error the caller reports.
        if (String(e).includes("no such table")) return [];
        throw e;
      }),
    );
  }
  const seen = new Set<string>();
  const all: NameRow[] = [];
  parts.forEach((part, k) => {
    const published = SOURCES[kind][k]!.table === "perm_entities";
    for (const r of part) {
      if (!r.slug || !r.name || seen.has(r.slug)) continue;
      seen.add(r.slug);
      all.push({ slug: r.slug, name: r.name, n: Number(r.n) || 0, published });
    }
  });
  // Built a slice at a time: 298,000 employer names in one go would hold the
  // process for seconds. Equally close names are ordered by filings in the
  // index itself, so the list needs no sort first.
  return FuzzyIndex.build(all, (r) => r.name, (r) => r.n);
}

function indexFor(kind: SuggestKind): Promise<FuzzyIndex<NameRow>> {
  const hit = cache.get(kind);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.index;
  const index = load(kind);
  cache.set(kind, { at: Date.now(), index });
  // A failed load must not be served for six hours.
  index.catch(() => {
    if (cache.get(kind)?.index === index) cache.delete(kind);
  });
  return index;
}


/**
 * Whether a kind's names are loaded, waiting at most `waitMs` (and starting
 * the load if it hasn't begun). A search shouldn't wait out the first load of
 * every kind: what's ready answers now, and the rest is there next time.
 */
export async function indexReady(kind: SuggestKind, waitMs: number): Promise<boolean> {
  const index = indexFor(kind);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), waitMs);
  });
  try {
    return await Promise.race([index.then(() => true as const), late]);
  } finally {
    clearTimeout(timer);
  }
}

/** Shortest and longest query worth a guess. */
export const SUGGEST_MIN_LENGTH = 2;
export const SUGGEST_MAX_LENGTH = 80;

/** The closest names to a query, best first. */
export async function suggestNames(kind: SuggestKind, query: string, limit = 5): Promise<NameSuggestion[]> {
  const q = query.trim();
  if (q.length < SUGGEST_MIN_LENGTH || q.length > SUGGEST_MAX_LENGTH) return [];
  const index = await indexFor(kind);
  return index.search(q, { limit, min: 0.7 }).map(({ item, score, weighted }) => ({
    kind,
    name: item.name,
    href: `${BASE[kind]}/${item.slug}`,
    cases: item.n,
    // Weighted by filings, so a merge across kinds keeps the busier name first.
    score: Math.round((weighted ?? score) * 1000) / 1000,
    published: item.published,
  }));
}
