/**
 * The read path for the A-Z browse indexes.
 *
 * Two queries, and the shape of both is load-bearing rather than incidental.
 *
 * THE RANGE PREDICATE IS THE WHOLE DESIGN. `perm_entities` is keyed
 * `PRIMARY KEY (kind, slug)`, so `kind = ? AND slug >= ? AND slug < ?` is an
 * index seek on `sqlite_autoindex_perm_entities_1`. Measured with EXPLAIN
 * QUERY PLAN against the live database:
 *
 *   SEARCH perm_entities USING INDEX sqlite_autoindex_perm_entities_1
 *          (kind=? AND slug>? AND slug<?)
 *
 * The obvious alternatives - `substr(slug, 1, 1) = ?`, `upper(name) LIKE 'S%'`
 * - cannot use an index at all and become `SCAN perm_entities`, which is
 * 71,512 rows per letter page for employers. Turso reads are this project's
 * binding cost: one month of crawler traffic burned a 500M row-read budget
 * and got reads BLOCKED mid-August. A scan per letter page is not affordable,
 * so any future edit here must keep the predicate directly on `slug`.
 *
 * ORDERING HAPPENS IN JS, NOT IN SQL. The display order is by NAME and the
 * index is by SLUG, so an `ORDER BY name` would add a temp b-tree; the largest
 * bucket is 1,605 rows and sorting that in the server component costs nothing.
 * It also lets the digits bucket be a UNION ALL of two ranges without SQLite
 * having to merge-sort them.
 *
 * THE PAGE THRESHOLD IS IMPORTED, NEVER RESTATED. `MIN_TOTAL_FOR_PAGE` is the
 * same constant the sitemap, `generateStaticParams` and the detail pages'
 * noindex rule read. Hardcoding a 3 here would be a second definition of
 * "has a page", and the day they disagree this index links to 404s at scale.
 */
import "server-only";

import { cache } from "react";

import { MIN_TOTAL_FOR_PAGE, type EntityKind } from "@/lib/entityPayload";
import {
  BROWSE_BUCKETS,
  bucketOf,
  bucketRanges,
  type BrowseBucket,
} from "@/lib/entityBrowse";

import { rows } from "./client";

/** One line of a letter index: enough to link it and say how big it is. */
export interface BrowseEntry {
  slug: string;
  name: string;
  total: number;
  rank: number;
}

interface BrowseDbRow {
  slug: string;
  name: string;
  total: number;
  rank: number;
}

const BROWSE_COLS = "slug, name, total, rank";

/**
 * Every entity in one bucket that HAS a page, in display order.
 *
 * Returns the complete bucket rather than a page of it, on purpose: the point
 * of the route is that two clicks from a hub reaches every entity, and a
 * paginated letter would push the tail to three. The largest real bucket is
 * employers under S at 1,605 rows.
 */
/**
 * The most names one letter page will render.
 *
 * MEASURED 2026-09-10, before the page floor dropped to 1. The live
 * `/perm-employers/browse/s` was **600.6 KB** of HTML at 953 names, against
 * 218.6 KB for `/browse/q` at 51 - so the chrome is ~205 KB and each name
 * costs ~0.42 KB. At a floor of 1 that bucket holds **6,813** employers, which
 * renders at roughly **3.1 MB**.
 *
 * That is not a page. It is slow on a phone, it is ~390 ISR write units every
 * regeneration (a unit is 8 KB), and nobody reads six thousand links. So the
 * listing is capped and the remainder is stated in words - the same shape
 * `stageListing()` already uses for the review-stage cohorts, and for the same
 * reason.
 *
 * 1,000 is chosen so that NO letter page after the floor change is heavier
 * than the heaviest one before it: 205 + 1000 x 0.42 is about 625 KB, next to
 * today's 600.6 KB. It is a page-weight budget, not a judgement about which
 * entities matter.
 *
 * THE CAP IS ON THE RENDERED LIST, NOT ON WHAT IS INDEXED. Every entity above
 * the page floor keeps its URL and stays in the sitemap; `getEntitySlugWindow`
 * knows nothing about this number. A capped browse page costs a crawl hop for
 * the names past 1,000, and the sitemap is the discovery path that matters for
 * a corpus this size anyway.
 */
export const BROWSE_MAX = 1000;

export const browseBucket = cache(async function browseBucket(
  kind: EntityKind,
  bucket: BrowseBucket,
): Promise<{
  entries: BrowseEntry[];
  total: number;
  busiest: BrowseEntry | undefined;
  smallest: number;
}> {
  const ranges = bucketRanges(bucket);
  const clause =
    `SELECT ${BROWSE_COLS} FROM perm_entities ` +
    "WHERE kind = ? AND total >= ? AND slug >= ? AND slug < ?";
  const sql = ranges.map(() => clause).join(" UNION ALL ");
  const args = ranges.flatMap(([lo, hi]) => [kind, MIN_TOTAL_FOR_PAGE, lo, hi]);

  const found = await rows<BrowseDbRow>(sql, args);
  const all = found
    .map((r) => ({ slug: r.slug, name: r.name, total: r.total, rank: r.rank }))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "en", { sensitivity: "base" }) ||
        a.slug.localeCompare(b.slug),
    );
  // Sorted FIRST, then cut. Cutting in SQL would take an arbitrary 1,000 by
  // storage order and call them alphabetical, so the page would claim "the
  // first 1,000 alphabetically" while showing a scatter.
  //
  // AND THE SUPERLATIVES ARE MEASURED OVER `all`, NEVER OVER THE SLICE. The
  // page says "the busiest is X with N cases" and "the smallest carry N",
  // which are claims about the LETTER. Reduced over the capped list they
  // become claims about the first thousand names alphabetically, silently:
  // "S" would have named the busiest employer whose name sorts before roughly
  // "Sn", which is a plausible wrong answer of exactly the kind that never
  // looks wrong on the page.
  return {
    entries: all.slice(0, BROWSE_MAX),
    total: all.length,
    busiest: all.reduce<BrowseEntry | undefined>(
      (best, e) => (e.total > (best?.total ?? -1) ? e : best),
      undefined,
    ),
    smallest: all.reduce(
      (min, e) => Math.min(min, e.total),
      Number.POSITIVE_INFINITY,
    ),
  };
});

/**
 * How many pageworthy entities sit in each bucket.
 *
 * One grouped read rather than 27, and it rides `idx_pe_kind_total`
 * (`SEARCH perm_entities USING INDEX idx_pe_kind_total (kind=? AND total>?)`),
 * so it visits only the rows that have a page - 16,309 of 71,512 for
 * employers - rather than the whole kind. The GROUP BY adds a temp b-tree over
 * at most 27 groups, which is free.
 *
 * Every bucket is present in the result, zero included. A missing key and a
 * zero are the same fact and a caller that has to tell them apart will get it
 * wrong; a bucket at zero still gets a strip entry, because a letter that
 * quietly disappears from the strip is indistinguishable from a broken query.
 */
export function browseCounts(kind: EntityKind): Promise<Record<BrowseBucket, number>> {
  const hit = countsCache.get(kind);
  if (hit && Date.now() - hit.at < COUNTS_TTL_MS) return hit.value;
  const value = computeBrowseCounts(kind);
  countsCache.set(kind, { at: Date.now(), value });
  // A rejected promise must not be pinned for an hour: evict it so the next
  // render retries instead of replaying one bad minute all afternoon. Same
  // shape as `fieldDistribution`'s cache, and for the same reason.
  value.catch(() => {
    if (countsCache.get(kind)?.value === value) countsCache.delete(kind);
  });
  return value;
}

/**
 * How long a counts read is reused.
 *
 * Every one of a kind's 27 letter pages needs the SAME counts, to decide which
 * chips in the strip are links and which are inert. Next's per-page ISR shares
 * nothing between renders, so without this a full employer rebuild would issue
 * 27 identical reads of 16,309 rows each. An hour collapses that to one, and is
 * far below the quarterly cadence of the data underneath.
 */
const COUNTS_TTL_MS = 60 * 60 * 1000;

const countsCache = new Map<
  EntityKind,
  { at: number; value: Promise<Record<BrowseBucket, number>> }
>();

async function computeBrowseCounts(
  kind: EntityKind,
): Promise<Record<BrowseBucket, number>> {
  const found = await rows<{ c: string | null; n: number }>(
    "SELECT substr(slug, 1, 1) AS c, count(*) AS n FROM perm_entities " +
      "WHERE kind = ? AND total >= ? GROUP BY c",
    [kind, MIN_TOTAL_FOR_PAGE],
  );

  const out = Object.fromEntries(BROWSE_BUCKETS.map((b) => [b, 0])) as Record<
    BrowseBucket,
    number
  >;
  for (const row of found) {
    // Folded through `bucketOf`, the partition's own rule, rather than a
    // second copy of it written here. `substr` is fine at THIS point - it runs
    // over the grouped result, not as a predicate - but if the character-to-
    // bucket mapping were rewritten locally, the count on the strip and the
    // rows on the page would be free to disagree, and the strip is the thing
    // a reader trusts to decide whether a letter is worth opening.
    const bucket = bucketOf(row.c ?? "");
    out[bucket] += row.n;
  }
  return out;
}
