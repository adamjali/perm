import type { EntityKind, EntityRow } from "./entityPayload";
import { getAllEntities, getEntitySeed } from "./turso/publicData";

/**
 * The server-rendered head of one entity kind, plus how many exist.
 *
 * Backed by Turso since 2026-08-25. The signatures are unchanged on purpose:
 * every entity index page, the detail pages and the sitemap read through
 * here, so moving the backend is one file rather than fifteen.
 *
 * Why it moved: 373,939 case rows plus these 21,178 entities and their
 * indexes exceeded Convex's 0.5 GB free tier and disabled the deployment -
 * reads included - which took every public data page down to nav and footer.
 * The data is public DOL disclosure output, read-mostly and rewritten once a
 * quarter, so it belongs in cheap bulk storage. Accounts and user-tracked
 * cases stay on Convex, behind auth, where they belong.
 *
 * ONE CAP DISAPPEARED WITH THE MOVE. The old comment here explained that the
 * aggregate document could hold only 250 rows per kind because of Convex's
 * 1 MB document limit. That limit does not exist in SQLite, so `perm_entities`
 * holds all 16,305 employers rather than a truncated head that described
 * itself as complete.
 *
 * ERRORS ARE NOT SWALLOWED ANY MORE. Each fetch used to end in
 * `.catch(() => [])`, which turned the outage above into an HTTP 200 carrying
 * an empty state - a page that looks merely quiet while being entirely
 * broken, and which no status-code check can catch. These throw.
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
export async function fetchAllEntitiesServer(
  kind: EntityKind,
): Promise<EntityRow[]> {
  return getAllEntities(kind);
}
