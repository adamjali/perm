/**
 * "Did you mean" for an address that found nothing.
 *
 * Three cases, in the order they're tried:
 *
 * - A FAMILY ADDRESS with a missing member (`/perm-employers/amazn`): the
 *   family is recognised even when its own name is mistyped, and the rest of
 *   the address becomes a search of that family, because the member's page
 *   can't be guessed from a slug but its index can be searched by the words.
 * - AN ARTICLE ADDRESS (`/guides/...`): matched against the articles' titles
 *   and addresses.
 * - ANYTHING ELSE: the address's words against every static page.
 *
 * Pure, so the 404 page and its test share it.
 */

import { editDistance, normalizeText, rankFuzzy } from "@/lib/fuzzy";
import type { SiteIndexEntry } from "./siteIndex";

export interface ArticleRef {
  title: string;
  href: string;
  kind: string;
}

export interface Family {
  base: string;
  noun: string;
  /** The entity kind the suggestion endpoint knows, when there is one. */
  kind: "employer" | "attorney" | "occupation" | null;
  /** Whether the index page reads `?q=` and opens filtered. */
  searchable: boolean;
}

export const FAMILIES: readonly Family[] = [
  { base: "/perm-employers", noun: "employers", kind: "employer", searchable: true },
  { base: "/perm-attorneys", noun: "law firms", kind: "attorney", searchable: true },
  { base: "/perm-wages", noun: "occupations", kind: "occupation", searchable: true },
  { base: "/perm-cities", noun: "cities", kind: null, searchable: true },
  { base: "/perm-industries", noun: "industries", kind: null, searchable: true },
  { base: "/perm-countries", noun: "countries", kind: null, searchable: true },
  { base: "/h1b-employers", noun: "H-1B employers by state", kind: null, searchable: false },
  { base: "/perm-queue", noun: "filing months", kind: null, searchable: false },
];

const ARTICLE_BASES = ["guides", "blog", "changelog"];

/** The family a first path segment names, allowing a typo or two in a long name. */
export function familyOf(segment: string): Family | null {
  const s = segment.toLowerCase();
  let best: { f: Family; d: number } | null = null;
  for (const f of FAMILIES) {
    const name = f.base.slice(1);
    const allowed = name.length >= 10 ? 2 : 1;
    const d = editDistance(s, name, allowed);
    if (d <= allowed && (!best || d < best.d)) best = { f, d };
  }
  return best?.f ?? null;
}

function articleBase(segment: string): string | null {
  const s = segment.toLowerCase();
  for (const b of ARTICLE_BASES) if (editDistance(s, b, b.length >= 5 ? 2 : 1) <= (b.length >= 5 ? 2 : 1)) return b;
  return null;
}

/** An address's words as typed: decoded, dashes as spaces, lowercase, accents kept. */
function words(parts: string[]): string {
  return parts
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    })
    .join(" ")
    .replace(/[-_+.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface PageSuggestion {
  label: string;
  href: string;
}

export interface PathSuggestions {
  pages: PageSuggestion[];
  family: (Family & { query: string; searchHref: string }) | null;
}

const PAGE_LIMIT = 3;
const PAGE_MIN = 0.6;

export function suggestForPath(
  path: string,
  pages: readonly SiteIndexEntry[],
  articles: readonly ArticleRef[],
): PathSuggestions {
  const clean = path.split(/[?#]/)[0] ?? "";
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 0) return { pages: [], family: null };

  if (segments.length >= 2) {
    const fam = familyOf(segments[0]!);
    if (fam) {
      const query = words(segments.slice(1));
      if (query) {
        return {
          pages: [],
          family: {
            ...fam,
            query,
            searchHref: fam.searchable ? `${fam.base}?q=${encodeURIComponent(query)}` : fam.base,
          },
        };
      }
    }
    const art = articleBase(segments[0]!);
    if (art) {
      const query = words(segments.slice(1));
      const pool = articles.filter((a) => a.href.startsWith(`/${art}/`));
      const ranked = rankFuzzy(query, pool, (a) => [a.title, a.href.slice(art.length + 2)], {
        limit: PAGE_LIMIT,
        min: PAGE_MIN,
      });
      return { pages: ranked.map((r) => ({ label: r.item.title, href: r.item.href })), family: null };
    }
  }

  const query = words(segments);
  if (!normalizeText(query)) return { pages: [], family: null };
  const candidates: PageSuggestion[] = [
    ...pages.map((p) => ({ label: p.label, href: p.href })),
    ...articles.map((a) => ({ label: a.title, href: a.href })),
  ];
  const ranked = rankFuzzy(query, candidates, (c) => [c.label, c.href], { limit: PAGE_LIMIT, min: PAGE_MIN });
  return { pages: ranked.map((r) => r.item), family: null };
}
