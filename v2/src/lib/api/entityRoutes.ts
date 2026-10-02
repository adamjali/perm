/**
 * The search and by-name handlers for employers, law firms and occupations.
 * One factory, so the three paths answer the same way.
 */
import "server-only";

import type { EntityKind } from "@/lib/entityPayload";
import { readEntity, searchEntities } from "./reads";
import { apiGet } from "./route";

export function entitySearchRoute(kind: EntityKind) {
  return apiGet(async ({ url }) => {
    const q = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? 25);
    return searchEntities(kind, q, Number.isFinite(limit) ? limit : 25);
  });
}

export function entityBySlugRoute(kind: EntityKind) {
  return apiGet<{ slug: string }>(async (_ctx, { slug }) => readEntity(kind, slug));
}
