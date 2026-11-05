import "server-only";

import { cache } from "react";

import type { RefusalRow, RefusalSummary } from "@/lib/visaRefusals";

import { one, rows } from "./client";

/**
 * State's yearly table of visa refusals by ground (`visa_refusals`, scripts/ingest_visa_refusals.py),
 * every year's grounds reconciled against State's own total line before they were written.
 *
 * A failed read throws, so the page keeps its last good render; only a missing table (before the
 * first load) reads as empty.
 */

const missing = (e: unknown) => /no such table/i.test(String(e));

interface Row {
  fy: unknown;
  line: unknown;
  ground_code: string;
  ground: string;
  iv_found: unknown;
  iv_overcome: unknown;
  niv_found: unknown;
  niv_overcome: unknown;
}

/** A stored cell: a count, or null for State's "-" (never 0). */
const cell = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

const shape = (r: Row): RefusalRow => ({
  fy: Number(r.fy),
  line: Number(r.line),
  code: r.ground_code,
  ground: r.ground,
  ivFound: cell(r.iv_found),
  ivOvercome: cell(r.iv_overcome),
  nivFound: cell(r.niv_found),
  nivOvercome: cell(r.niv_overcome),
});

const COLUMNS = "fy, line, ground_code, ground, iv_found, iv_overcome, niv_found, niv_overcome";

/** The years held, State's totals for each, and the day the table last changed; null before the first load. */
export const refusalSummary = cache(async (): Promise<RefusalSummary | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'visa_refusals_summary'");
  if (!r) return null;
  let doc: RefusalSummary;
  try {
    doc = JSON.parse(String(r.json)) as RefusalSummary;
  } catch {
    throw new Error("visa_refusals_summary is unreadable");
  }
  if (!doc.years?.length || doc.newest === null || doc.newest === undefined) return null;
  return { ...doc, knownGaps: doc.knownGaps || {}, totals: doc.totals || {}, sources: doc.sources || {} };
});

/** Every ground of one fiscal year, in State's order. */
export async function refusalsYear(fy: number): Promise<RefusalRow[]> {
  const got = await rows<Row>(`SELECT ${COLUMNS} FROM visa_refusals WHERE fy = ? ORDER BY line`, [fy]).catch((e) => {
    if (missing(e)) return [];
    throw e;
  });
  return got.map(shape);
}

/** Some grounds in every year held, oldest first (public charge, 221(g), 214(b)). */
export async function refusalsByCode(codes: readonly string[]): Promise<RefusalRow[]> {
  const got = await rows<Row>(
    `SELECT ${COLUMNS} FROM visa_refusals WHERE ground_code IN (${codes.map(() => "?").join(",")}) ORDER BY fy, line`,
    [...codes],
  ).catch((e) => {
    if (missing(e)) return [];
    throw e;
  });
  return got.map(shape);
}
