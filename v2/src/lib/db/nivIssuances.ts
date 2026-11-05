import "server-only";

import { cache } from "react";

import { monthsTo, type PostMonths } from "@/lib/consular/niv";

import { one, rows } from "./client";

/**
 * State's monthly nonimmigrant visa issuances by post (`niv_issuances`,
 * scripts/ingest_niv_issuances.py): every visa class each consulate issued each month, each
 * month checked against State's GRAND TOTAL. A post is keyed as the immigrant tables key it,
 * so a consulate page reads both by its own key.
 *
 * A failed read throws, so a page keeps its last good render; only a missing table (before the
 * first load) reads as empty.
 */

const missing = (e: unknown) => /no such table/i.test(String(e));

export interface NivSummary {
  months: string[];
  newest: string | null;
  totalByMonth: Record<string, number>;
  /** H-1B, L-1 and K-1 worldwide, month by month. */
  classByMonth: Record<string, Record<string, number>>;
}

/** The load's summary doc, or null before the first load. */
export const nivSummary = cache(async (): Promise<NivSummary | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'niv_issuances_summary'");
  if (!r) return null;
  let doc: NivSummary;
  try {
    doc = JSON.parse(String(r.json)) as NivSummary;
  } catch {
    throw new Error("niv_issuances_summary is unreadable");
  }
  return doc.months?.length && doc.newest ? doc : null;
});

/** How many months a consulate page draws. */
export const POST_MONTHS = 12;

export interface PostNiv {
  /** The months drawn, oldest first, ending at State's newest table. */
  months: string[];
  /** Those of them this site holds State's table for; a month without one is a gap, never a zero. */
  held: string[];
  byMonth: PostMonths;
}

/** One post's nonimmigrant visas over the newest `POST_MONTHS` months State has published. */
export async function postNiv(postKey: string): Promise<PostNiv | null> {
  const summary = await nivSummary();
  if (!summary?.newest) return null;
  const months = monthsTo(summary.newest, POST_MONTHS);
  const got = await rows<{ month: string; visa_class: string; n: unknown }>(
    "SELECT month, visa_class, n FROM niv_issuances WHERE post_key = ? AND month >= ? AND month <= ?",
    [postKey, months[0], summary.newest],
  ).catch((e) => {
    if (missing(e)) return [];
    throw e;
  });
  const byMonth = new Map<string, Record<string, number>>();
  for (const r of got) {
    const m = byMonth.get(r.month) ?? {};
    m[r.visa_class] = (m[r.visa_class] ?? 0) + Number(r.n);
    byMonth.set(r.month, m);
  }
  const loaded = new Set(summary.months);
  return { months, held: months.filter((m) => loaded.has(m)), byMonth };
}

/** Every post's count of some classes in one month (the index's rankings). */
export async function classesByPost(
  month: string,
  classes: readonly string[],
): Promise<{ post_key: string; post: string; visa_class: string; n: number }[]> {
  const got = await rows<{ post_key: string; post: string; visa_class: string; n: unknown }>(
    `SELECT post_key, post, visa_class, n FROM niv_issuances WHERE visa_class IN (${classes.map(() => "?").join(",")}) AND month = ?`,
    [...classes, month],
  ).catch((e) => {
    if (missing(e)) return [];
    throw e;
  });
  return got.map((r) => ({ ...r, n: Number(r.n) }));
}
