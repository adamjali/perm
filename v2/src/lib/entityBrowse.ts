/**
 * The A-Z browse partition for the programmatic entity pages.
 *
 * WHY IT EXISTS. `/perm-employers` server-renders 54 crawlable links against
 * 16,309 employer pages in the sitemap; everything else sits behind a
 * client-side search box that no crawler types into. A sitemap gets a URL
 * DISCOVERED, but internal links are how link equity reaches it, and most AI
 * crawlers do not read sitemaps at all. The same gap runs through
 * `/perm-attorneys` (3,514 pages) and `/perm-wages` (1,137). So every entity
 * that has a page now sits one crawlable click from a letter index and two
 * from its own hub.
 *
 * THE PARTITION IS DEFINED ONCE, IN TWO HALVES THAT MUST AGREE.
 * `bucketOf` says which bucket a slug belongs to; `bucketRanges` says which
 * slugs a bucket's SQL will select. Those are two vocabularies for the same
 * boundary, and a partition whose halves are written separately drifts - the
 * failure being an entity that belongs to a bucket the query never reaches,
 * which reads as a page that simply is not linked from anywhere. So they live
 * in one file and `entityBrowse.test.ts` asserts they are inverses over the
 * whole first-character space.
 *
 * WHY THE BUCKET IS THE SLUG'S FIRST CHARACTER AND NOT THE NAME'S.
 * Two reasons, and they happen to agree. `slugify` lowercases and drops every
 * leading non-alphanumeric, so a slug's first character IS the name's first
 * alphanumeric one - which is the bucket a reader expects. And `(kind, slug)`
 * is the table's PRIMARY KEY, so a range over it is an index seek, where
 * `substr(name, 1, 1) = ?` would be a full scan of the kind. Turso reads are
 * the budget that got blocked in August; a scan per letter page is not
 * affordable and is not necessary.
 */

import type { DataSection } from "@/components/tools/DataNav";
import type { EntityKind } from "@/lib/entityPayload";

/** The bucket every slug that does not begin a-z falls into. */
export const BROWSE_OTHER = "0-9";

/**
 * Spelled out rather than `"a-z".split("")`, and the reason is the TYPE.
 * A split returns `string[]`, which makes `BrowseBucket` an alias for `string`
 * - so `isBrowseBucket` narrows nothing, a typo'd bucket id typechecks, and
 * `Record<BrowseBucket, number>` degrades into an index signature that
 * `noUncheckedIndexedAccess` then makes undefined everywhere. As a literal
 * tuple the union is real and the compiler checks the partition for us.
 */
const LETTERS = [
  "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
  "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
] as const;

type Letter = (typeof LETTERS)[number];

/**
 * Every bucket, in the order the strip renders them.
 *
 * A-Z first because that is how a person reads an index, and the digits
 * bucket last because it is the residue. The URL segment is the bucket id
 * itself, so this array is also the complete `generateStaticParams` set: 27
 * pages per kind, small enough to prerender all of them.
 */
export const BROWSE_BUCKETS = [...LETTERS, BROWSE_OTHER] as const;

export type BrowseBucket = (typeof BROWSE_BUCKETS)[number];

export function isBrowseBucket(value: string): value is BrowseBucket {
  return (BROWSE_BUCKETS as readonly string[]).includes(value);
}

function isLetter(value: string): value is Letter {
  return (LETTERS as readonly string[]).includes(value);
}

/** "s" -> "S", "0-9" -> "0-9". What the heading and the strip print. */
export function bucketLabel(bucket: BrowseBucket): string {
  return bucket === BROWSE_OTHER ? BROWSE_OTHER : bucket.toUpperCase();
}

/** How a sentence names the bucket: "S" reads wrong after "begins with". */
export function bucketPhrase(bucket: BrowseBucket): string {
  return bucket === BROWSE_OTHER ? "a number" : bucket.toUpperCase();
}

/**
 * Which bucket a slug belongs to.
 *
 * Deliberately total: anything that is not a lowercase letter lands in the
 * digits bucket rather than being dropped. A slug the partition has no home
 * for is an entity page nothing links to, which is the exact defect this
 * whole file exists to remove, so there is no "unknown" outcome.
 */
export function bucketOf(slug: string): BrowseBucket {
  const first = slug.slice(0, 1);
  return isLetter(first) ? first : BROWSE_OTHER;
}

/**
 * The half-open `[lo, hi)` slug ranges a bucket covers, for a SQL range scan.
 *
 * BINARY collation, which is SQLite's default for a plain `TEXT` column and
 * what `perm_entities` declares. So `slug >= 'a' AND slug < 'b'` is exactly
 * every slug beginning with `a`, with no `substr()` or `upper()` between the
 * predicate and the index.
 *
 * The digits bucket needs TWO ranges because it is a complement: everything
 * below `a` (digits live at 0x30-0x39) and everything at or above `{`, the
 * codepoint immediately after `z`. Today only digits appear - measured across
 * all 71,512 employer rows - but writing the complement rather than `'0'` to
 * `'a'` means a future slug rule that admits another character still has a
 * page to be linked from, instead of silently vanishing from the index.
 */
export function bucketRanges(bucket: BrowseBucket): Array<[string, string]> {
  if (bucket === BROWSE_OTHER) {
    // "" is the minimum TEXT value, so the first range is "everything before
    // the letters". `￿` sits above anything slugify can emit.
    return [
      ["", "a"],
      ["{", "￿"],
    ];
  }
  return [[bucket, String.fromCharCode(bucket.charCodeAt(0) + 1)]];
}

/** Everything a browse page needs to know about the kind it is showing. */
export interface BrowseKind {
  kind: EntityKind;
  /** URL prefix for the hub and its detail pages, e.g. "/perm-employers". */
  base: string;
  /** Which `DataNav` chip is current. Type-only import, erased at build. */
  nav: DataSection;
  /** What a title calls them: "PERM Employers". */
  titleNoun: string;
  /** What a sentence calls many of them: "employers". */
  plural: string;
  /** What a sentence calls one of them: "employer". */
  singular: string;
  /** What one row of the count column is: "filings". */
  unit: string;
}

export const BROWSE_KINDS: Record<EntityKind, BrowseKind> = {
  employer: {
    kind: "employer",
    base: "/perm-employers",
    nav: "employers",
    titleNoun: "PERM Employers",
    plural: "employers",
    singular: "employer",
    unit: "filings",
  },
  attorney: {
    kind: "attorney",
    base: "/perm-attorneys",
    nav: "attorneys",
    titleNoun: "PERM Law Firms",
    plural: "law firms",
    singular: "law firm",
    unit: "filings",
  },
  occupation: {
    kind: "occupation",
    base: "/perm-wages",
    nav: "wages",
    titleNoun: "PERM Occupations",
    plural: "occupations",
    singular: "occupation",
    unit: "filings",
  },
};

/** `/perm-employers/browse/s`. One place builds these, so nothing 404s. */
export function browseHref(base: string, bucket?: BrowseBucket): string {
  return bucket ? `${base}/browse/${bucket}` : `${base}/browse`;
}
