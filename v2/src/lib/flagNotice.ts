/**
 * DOL's own notice on FLAG (a maintenance window, an outage), as stored by
 * scripts/ingest_flag_notice.py in perm_docs['flag_notice'] every 15 minutes.
 *
 * A notice shows only while its reading is current: a job that stops must not
 * keep a maintenance banner up for days, so a reading older than MAX_AGE_MS
 * reads as no notice.
 */
export interface FlagNotice {
  heading: string;
  body: string;
  /** When this notice was first seen on flag.dol.gov, epoch ms. */
  firstSeenAt: number;
  /** When flag.dol.gov was last read, epoch ms. */
  checkedAt: number;
}

export const FLAG_NOTICE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

/** The notice to show now, or null: none up, an unreadable document, or a reading too old to trust. */
export function liveFlagNotice(doc: unknown, nowMs: number): FlagNotice | null {
  if (!doc || typeof doc !== "object") return null;
  const d = doc as Record<string, unknown>;
  if (d.active !== true) return null;
  const checkedAt = Number(d.checkedAt);
  const firstSeenAt = Number(d.firstSeenAt);
  if (!Number.isFinite(checkedAt) || nowMs - checkedAt > FLAG_NOTICE_MAX_AGE_MS) return null;
  const heading = typeof d.heading === "string" ? d.heading.trim() : "";
  const body = typeof d.body === "string" ? d.body.trim() : "";
  if (!heading && !body) return null;
  return { heading, body, checkedAt, firstSeenAt: Number.isFinite(firstSeenAt) ? firstSeenAt : checkedAt };
}
