import "server-only";

import { cache } from "react";
import { one } from "./client";

/**
 * When our DOL sweep last finished, and how much of the corpus it answered.
 *
 * WHY THIS EXISTS. The case page used to print `perm_case_status.last_checked_at`
 * as "status seen". The PERM sweep has never written that column: it was the
 * mirror's stamp, frozen in July 2026 for 66,771 pending cases and NULL for
 * 12,187 more. So a beneficiary whose case the sweep had verified that
 * morning read "seen 7 days ago, and it has not been looked at since". The
 * sweep's own record is the honest check date, and it is one point read.
 *
 * Eight-day cutoff, like every other precomputed doc: a stale sweep must read
 * as "not checked recently", never as fresh.
 */
export interface SweepCoverage {
  /** ISO date the sweep finished, in the sweep's own clock (UTC date). */
  finishedOn: string;
  mode: string;
  asked: number;
  answered: number;
}

const MAX_AGE_MS = 8 * 86_400_000;

export const getSweepCoverage = cache(async (): Promise<SweepCoverage | null> => {
  const r = await one<{ json: string; computed_at: number | string }>(
    "SELECT json, computed_at FROM perm_docs WHERE key = ?",
    ["sweep_coverage"],
  ).catch(() => null);
  if (!r) return null;
  const computedAt = Number(r.computed_at);
  if (!Number.isFinite(computedAt) || Date.now() - computedAt > MAX_AGE_MS) return null;
  try {
    const d = JSON.parse(String(r.json)) as Record<string, unknown>;
    const finishedOn = typeof d.finishedOn === "string" ? d.finishedOn.slice(0, 10) : null;
    if (!finishedOn || !/^\d{4}-\d{2}-\d{2}$/.test(finishedOn)) return null;
    return {
      finishedOn,
      mode: typeof d.mode === "string" ? d.mode : "",
      asked: Number(d.asked) || 0,
      answered: Number(d.answered) || 0,
    };
  } catch {
    return null;
  }
});

/** The later of two ISO timestamps/dates, comparing their date part. */
export function laterDate(a: string | null | undefined, b: string | null | undefined): string | null {
  const da = a ? a.slice(0, 10) : null;
  const db = b ? b.slice(0, 10) : null;
  if (!da) return db;
  if (!db) return da;
  return db > da ? db : da;
}
