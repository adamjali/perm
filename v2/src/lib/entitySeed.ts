import { api } from "@/../convex/_generated/api";
import { fetchQuery } from "convex/nextjs";

import type { EntityKind, EntityRow } from "./entityPayload";

/**
 * The server-rendered head of one entity kind, plus how many exist.
 *
 * Every index page reads its seed from `permEntities` rather than from the
 * aggregate document. The aggregate is capped at 250 rows per kind because it
 * has to fit Convex's 1 MB document limit, so a page built on it could only
 * ever show 250 of 12,240 employers, and it said "the full hundred" while
 * doing it. Reading the table means the seed and the lazily-fetched remainder
 * are the same rows in the same order with the same slugs, which is the part
 * that would otherwise be a link that 404s from its own index.
 */

export interface EntitySeed {
  rows: EntityRow[];
  /** Size of the whole corpus, not of `rows`. */
  total: number;
}

export async function fetchEntitySeed(
  kind: EntityKind,
  limit = 250,
): Promise<EntitySeed> {
  const [rows, total] = await Promise.all([
    fetchQuery(api.permEntities.listByKind, { kind, limit }).catch(() => []),
    fetchQuery(api.permEntities.countByKind, { kind }).catch(() => 0),
  ]);

  return {
    rows: rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      rank: r.rank,
      total: r.total,
      certified: r.certified,
      denied: r.denied,
      medianDays: r.medianDays,
      medianAnnualWage: r.medianAnnualWage ?? null,
      state: r.state ?? null,
      code: r.code ?? null,
    })),
    // A count of zero with rows present means the count query failed, not that
    // the table is empty. Fall back rather than render "0 of 0" over real data.
    total: total > 0 ? total : rows.length,
  };
}

/** Convex caps a single listByKind at 2,000 rows, so the walk pages by rank. */
const WALK_PAGE = 2000;
/**
 * A ceiling on the walk. Without it, duplicate ranks (which would stop
 * `gt(rank)` advancing) turn this into an unbounded loop against the database
 * rather than a wrong answer a test can catch. Far above any real kind.
 */
const WALK_MAX = 40_000;

/**
 * The shape `permEntities.listByKind` returns.
 *
 * Written out rather than inferred: the cursor is assigned FROM the batch and
 * used to fetch it, so inference is a circular initializer (TS7022).
 */
type ListedEntity = {
  slug: string;
  name: string;
  rank: number;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
  medianAnnualWage?: number | null;
  state?: string;
  code?: string;
};

/**
 * Every row of one kind, walked server-side.
 *
 * Two callers: the `/api/perm-entities/[kind]` route that the index tables
 * lazy-load, and the sitemap. They were about to hold two copies of the same
 * paging loop with the same two footguns in it.
 */
export async function fetchAllEntitiesServer(
  kind: EntityKind,
): Promise<EntityRow[]> {
  const out: EntityRow[] = [];
  let afterRank: number | undefined = undefined;

  while (out.length < WALK_MAX) {
    const batch: ListedEntity[] = await fetchQuery(api.permEntities.listByKind, {
      kind,
      limit: WALK_PAGE,
      ...(afterRank === undefined ? {} : { afterRank }),
    }).catch(() => [] as ListedEntity[]);
    // Not merely a length check. A caller (or a test double) that hands back
    // something other than an array would otherwise fall through to the
    // for-of below and throw, which reads as "Convex is down" rather than
    // "this response is the wrong shape".
    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const r of batch) {
      out.push({
        slug: r.slug,
        name: r.name,
        rank: r.rank,
        total: r.total,
        certified: r.certified,
        denied: r.denied,
        medianDays: r.medianDays,
        medianAnnualWage: r.medianAnnualWage ?? null,
        state: r.state ?? null,
        code: r.code ?? null,
      });
    }

    const last: ListedEntity | undefined = batch[batch.length - 1];
    if (batch.length < WALK_PAGE || last === undefined || last.rank === afterRank) {
      break;
    }
    afterRank = last.rank;
  }

  return out;
}
