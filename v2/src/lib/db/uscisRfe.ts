import "server-only";

import { cache } from "react";

import { one, rows } from "./client";
import type { RfeMonth } from "@/lib/uscisRfe";

/**
 * USCIS's I-129 request-for-evidence counts, as `scripts/ingest_uscis_rfe.py`
 * stored them: one row per fiscal year, month and visa in `uscis_i129_rfe`,
 * and the newest quarter in `perm_docs['uscis_rfe_summary']`.
 *
 * A table that doesn't exist yet (a deploy ahead of the first load) reads as
 * nothing held, and the page shows its empty state naming the file. Any other
 * failure throws: an empty state rendered on a read that failed would say
 * "not loaded" for a week of cached page, and a thrown render keeps the last
 * good one instead.
 */

const missingTable = (e: unknown) => /no such table/i.test(String((e as Error)?.message ?? e));

const n = (v: unknown): number => Number(v ?? 0);
const nOrNull = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

/** Every month held, every visa, oldest first. About 1,400 rows. */
export const getRfeMonths = cache(async (): Promise<RfeMonth[]> => {
  const list = await rows<Record<string, unknown>>(
    `SELECT fy, month, visa, received, approved, denied, completions, pending,
            rfe_completions, rfe_approved, source_file
       FROM uscis_i129_rfe ORDER BY fy, visa, month`,
  ).catch((e: unknown) => {
    if (missingTable(e)) return [];
    throw e;
  });
  return list.map((r) => ({
    fy: n(r.fy),
    month: n(r.month),
    visa: String(r.visa),
    received: n(r.received),
    approved: n(r.approved),
    denied: n(r.denied),
    completions: n(r.completions),
    pending: nOrNull(r.pending),
    rfeCompletions: n(r.rfe_completions),
    rfeApproved: n(r.rfe_approved),
    sourceFile: String(r.source_file ?? ""),
  }));
});

export interface RfeSummary {
  /** The newest quarter's last day, `YYYY-MM-DD`. */
  asOf: string;
  /** "FY2026 Q3". */
  quarterLabel: string;
  /** The file it came from, as USCIS named it. */
  sourceFile: string;
}

/** The newest quarter held, or null before the first load. */
export const getRfeSummary = cache(async (): Promise<RfeSummary | null> => {
  const row = await one<{ json: string }>(
    "SELECT json FROM perm_docs WHERE key = 'uscis_rfe_summary'",
  ).catch((e: unknown) => {
    if (missingTable(e)) return null;
    throw e;
  });
  if (!row?.json) return null;
  try {
    const d = JSON.parse(row.json) as Record<string, unknown>;
    if (typeof d.asOf !== "string" || typeof d.quarterLabel !== "string" || typeof d.sourceFile !== "string") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.asOf)) return null;
    return { asOf: d.asOf, quarterLabel: d.quarterLabel, sourceFile: d.sourceFile };
  } catch {
    return null;
  }
});
