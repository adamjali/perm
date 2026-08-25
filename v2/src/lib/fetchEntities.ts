import {
  unpackRow,
  type EntityKind,
  type EntityPayload,
  type EntityRow,
} from "./entityPayload";

/**
 * Fetch every row of one entity kind from the cached route handler.
 *
 * Throws on a non-2xx so the caller can say "that list did not load" rather
 * than rendering an empty table, which reads as "there is nothing here".
 */
export async function fetchAllEntities(kind: EntityKind): Promise<EntityRow[]> {
  const res = await fetch(`/api/perm-entities/${kind}`);
  if (!res.ok) throw new Error(`perm-entities ${kind}: HTTP ${res.status}`);
  const payload = (await res.json()) as EntityPayload;
  if (!Array.isArray(payload.rows)) {
    throw new Error(`perm-entities ${kind}: malformed payload`);
  }
  return payload.rows.map(unpackRow);
}

/**
 * Search the whole corpus by name, server-side.
 *
 * The index table can only filter what it has downloaded, and it downloads a
 * bounded head of the rank order. This is what makes a sponsor with two cases
 * findable at all.
 */
export async function searchEntities(
  kind: EntityKind,
  text: string,
): Promise<EntityRow[]> {
  const q = text.trim();
  if (q.length < 2) return [];
  const res = await fetch(
    `/api/perm-entities/${kind}?q=${encodeURIComponent(q.slice(0, 120))}`,
  );
  if (!res.ok) throw new Error(`perm-entities search ${kind}: HTTP ${res.status}`);
  const payload = (await res.json()) as EntityPayload;
  return Array.isArray(payload.rows) ? payload.rows.map(unpackRow) : [];
}
