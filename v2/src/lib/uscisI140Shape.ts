/**
 * The USCIS I-140 quarter as the two tool pages use it, and the parse of its
 * database copy (`perm_docs['uscis_i140']`, written by
 * scripts/ingest_uscis_i140.py).
 *
 * A plain module so the check runs without a database. The shape matches
 * Convex's `uscisI140:getLatest` exactly, because that query stays the
 * fallback and both have to feed the same components.
 */

export interface I140Subtype {
  code: string;
  label: string;
  received: number;
  approved: number;
  denied: number;
  pending: number;
}

export interface I140Snapshot {
  sourceFile: string;
  asOfQuarter: string;
  subtypes: I140Subtype[];
  computedAt: number;
}

const COUNT_FIELDS = ["received", "approved", "denied", "pending"] as const;

function asSubtype(raw: unknown): I140Subtype | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.code !== "string" || typeof r.label !== "string") return null;
  for (const f of COUNT_FIELDS) {
    if (typeof r[f] !== "number" || !Number.isFinite(r[f])) return null;
  }
  return {
    code: r.code,
    label: r.label,
    received: r.received as number,
    approved: r.approved as number,
    denied: r.denied as number,
    pending: r.pending as number,
  };
}

/**
 * The stored document, or null when it is missing or malformed. Null sends the
 * page to the Convex copy rather than rendering a table with holes: one bad
 * subtype refuses the whole quarter, the same as the ingest refuses a partial
 * set.
 */
export function parseI140Snapshot(raw: unknown): I140Snapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.sourceFile !== "string" || typeof r.asOfQuarter !== "string") return null;
  if (!Array.isArray(r.subtypes) || r.subtypes.length === 0) return null;
  const subtypes = r.subtypes.map(asSubtype);
  if (subtypes.some((s) => s === null)) return null;
  const computedAt = typeof r.computedAt === "number" ? r.computedAt : 0;
  return { sourceFile: r.sourceFile, asOfQuarter: r.asOfQuarter, subtypes: subtypes as I140Subtype[], computedAt };
}
