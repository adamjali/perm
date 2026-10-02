/**
 * Ids for entries stored inside a document: RFIs, RFEs, notes and uploaded
 * documents. A prefix, the creation time, then seven random base-36
 * characters, for example `note-1727791200000-k3j9x2a`.
 *
 * Math.random rather than crypto.randomUUID on purpose: this runs both in the
 * browser and inside Convex mutations, and Convex queries and mutations refuse
 * cryptographic randomness while seeding Math.random for determinism.
 */
export function newEntryId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
