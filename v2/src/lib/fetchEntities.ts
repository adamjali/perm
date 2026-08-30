import {
  unpackRow,
  type EntityKind,
  type EntityPayload,
  type EntityRow,
  type LiveEmployerHit,
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

export interface EntitySearchResult {
  rows: EntityRow[];
  /**
   * Employers with no published record at all, for the same query. Separate
   * from `rows` because they carry none of the figures a row promises.
   * Always empty for law firms and occupations.
   */
  live: LiveEmployerHit[];
}

/**
 * Search the whole corpus by name, server-side.
 *
 * The index table can only filter what it has downloaded, and it downloads a
 * bounded head of the rank order. This is what makes a sponsor with two cases
 * findable at all.
 *
 * Returns TWO lists. `rows` is the published corpus; `live` is employers we
 * only know about from the live feed - 21,495 of the 93,007 employers we
 * hold - which until now was reachable only by knowing a case number.
 */
export async function searchEntities(
  kind: EntityKind,
  text: string,
  opts: {
    /**
     * Ask for the live half only, skipping the published name search.
     *
     * Set when the caller's own table has already answered from the corpus it
     * downloaded, so the expensive half - a LIKE the database serves by
     * walking all 71,512 employer rows - would be paid for a result nobody
     * needs. The live half still runs, because it answers a question the
     * downloaded corpus cannot answer at all.
     */
    onlyLive?: boolean;
  } = {},
): Promise<EntitySearchResult> {
  const q = text.trim();
  if (q.length < 2) return { rows: [], live: [] };
  const scope = opts.onlyLive ? "&scope=live" : "";
  const res = await fetch(
    `/api/perm-entities/${kind}?q=${encodeURIComponent(q.slice(0, 120))}${scope}`,
  );
  if (!res.ok) throw new Error(`perm-entities search ${kind}: HTTP ${res.status}`);
  const payload = (await res.json()) as EntityPayload;
  return {
    rows: Array.isArray(payload.rows) ? payload.rows.map(unpackRow) : [],
    live: Array.isArray(payload.live) ? payload.live : [],
  };
}
