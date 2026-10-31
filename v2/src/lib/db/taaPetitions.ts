import "server-only";

import { cache } from "react";

import { rows } from "@/lib/db/client";

/**
 * DOL's Trade Adjustment Assistance petitions matched to a PERM sponsor's page (scripts/ingest_taa.py writes
 * `taa_petitions`): decided from Oct 1 2012 to June 30 2022, when the program stopped.
 */

export interface TaaPetition {
  petition: string;
  name: string;
  city: string | null;
  state: string | null;
  /** DOL's determination code (its Petition Data Dictionary): C1, C2, CU, CD, C, P, D or T. */
  code: string | null;
  decided: string;
  /** DOL's estimate of the workers in the group. */
  workers: number | null;
  product: string | null;
}

type Row = Record<string, string | number | null>;
const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

/** A sponsor page's petitions, newest decision first. [] for none or before the first load; other failures throw. */
export const taaForSlug = cache(async (slug: string): Promise<TaaPetition[]> => {
  try {
    const got = await rows<Row>(
      "SELECT petition, name, city, state, det_code, det_date, workers, product FROM taa_petitions " +
        "WHERE employer_slug = ? ORDER BY det_date DESC, petition LIMIT 200",
      [slug],
    );
    return got.map((r) => ({
      petition: String(r.petition),
      name: String(r.name ?? ""),
      city: s(r.city),
      state: s(r.state),
      code: s(r.det_code),
      decided: String(r.det_date),
      workers: r.workers === null || r.workers === undefined || r.workers === "" ? null : Number(r.workers),
      product: s(r.product),
    }));
  } catch (e) {
    if (/no such table/i.test(String(e))) return [];
    throw e;
  }
});
