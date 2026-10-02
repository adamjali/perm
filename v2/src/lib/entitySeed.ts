import type { EntityKind, EntityRow } from "./entityPayload";
import { getAllEntities, getEntitySeed } from "./turso/publicData";

/**
 * The server-rendered head of one entity kind, plus how many exist.
 *
 * Backed by the site's SQL database, not Convex. Every entity index page, the
 * detail pages and the sitemap read through here, so the backend is one file
 * rather than fifteen.
 *
 * Why not Convex: the case rows plus these entities and their indexes are
 * public DOL disclosure output, read-mostly and rewritten once a quarter, and
 * they outgrow Convex's free tier, where an exceeded limit disables the
 * deployment, reads included. Accounts and user-tracked cases stay on Convex,
 * behind auth, where they belong. SQLite also has no 1 MB document limit, so
 * `perm_entities` holds every entity rather than a truncated head that
 * describes itself as complete.
 *
 * ERRORS ARE NOT SWALLOWED. A `.catch(() => [])` here would turn an outage
 * into an HTTP 200 carrying an empty state - a page that looks merely quiet
 * while being entirely broken, and which no status-code check can catch.
 * These throw.
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
  return getEntitySeed(kind, limit);
}

/**
 * Every row of one kind, read server-side.
 *
 * Two callers: the `/api/perm-entities/[kind]` route that the index tables
 * lazy-load, and the sitemap.
 */
/**
 * The BULK dump's rows. Not the sitemap's: that reads its own rank window
 * (`getEntitySlugWindow`), because with a page floor of 1 a shared
 * whole-table fetch would be one full read per sitemap file. This keeps the
 * higher `MIN_TOTAL_FOR_BULK`.
 */
export async function fetchAllEntitiesServer(
  kind: EntityKind,
): Promise<EntityRow[]> {
  return getAllEntities(kind);
}
