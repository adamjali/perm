import "server-only";

import { cache } from "react";

import { deriveRecordCounts, type RecordFigure } from "../recordCounts";
import { one, rows } from "./client";

/**
 * The record this site is built on, read as five point reads.
 *
 * Every count comes from a document an ingest reconciled before writing
 * (`perm_docs`), never from a COUNT over a table: the homepage is an ISR page
 * and Turso bills rows read. The one live query is over `visa_bulletins`,
 * which holds one row per month (84 at the time of writing).
 */
const KEYS = ["cases_meta", "live_remainder", "sweep_coverage", "flag_disclosure_summary_pw", "flag_disclosure_summary_lca"] as const;

export const getRecordCounts = cache(async (): Promise<RecordFigure[]> => {
  const [docs, bulletin] = await Promise.all([
    rows<{ key: string; json: string }>(
      `SELECT key, json FROM perm_docs WHERE key IN (${KEYS.map(() => "?").join(", ")})`,
      [...KEYS],
    ).catch(() => [] as { key: string; json: string }[]),
    one<{ n: number | string; latest: string | null }>(
      "SELECT COUNT(*) AS n, MAX(bulletin_month) AS latest FROM visa_bulletins",
    ).catch(() => null),
  ]);
  const byKey = new Map(docs.map((d) => [d.key, String(d.json)]));
  return deriveRecordCounts({
    casesMeta: byKey.get("cases_meta") ?? null,
    liveRemainder: byKey.get("live_remainder") ?? null,
    sweepCoverage: byKey.get("sweep_coverage") ?? null,
    pwSummary: byKey.get("flag_disclosure_summary_pw") ?? null,
    lcaSummary: byKey.get("flag_disclosure_summary_lca") ?? null,
    bulletinCount: bulletin ? Number(bulletin.n) : null,
    bulletinLatest: bulletin?.latest ?? null,
  });
});
