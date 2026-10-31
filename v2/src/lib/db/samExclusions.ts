import "server-only";

import { cache } from "react";

import { rows } from "@/lib/db/client";

/**
 * SAM.gov exclusions matched to a PERM sponsor's page (scripts/ingest_sam_exclusions.py writes `sam_exclusions`).
 * Each row is SAM's record as published: who excluded the firm, the kind of exclusion and its dates. The file holds
 * active exclusions only, so a row here is in force today.
 */

export interface SamExclusion {
  name: string;
  city: string | null;
  state: string | null;
  /** SAM's classification: "Firm" or "Special Entity Designation". */
  classification: string;
  /** The excluding agency's code as SAM prints it ("EPA", "DLA", "USCIS"). */
  agency: string | null;
  /** SAM's exclusion type ("Ineligible (Proceedings Completed)", "Prohibition/Restriction", "Voluntary Exclusion"). */
  kind: string | null;
  active: string | null;
  ends: string | null;
  indefinite: boolean;
}

type Row = Record<string, string | number | null>;
const s = (v: unknown) => (v === null || v === undefined || v === "" ? null : String(v));

/** A sponsor page's exclusions, newest first. [] for none or before the table's first load; any other failure throws. */
export const samExclusionsForSlug = cache(async (slug: string): Promise<SamExclusion[]> => {
  try {
    const got = await rows<Row>(
      "SELECT name, city, state, classification, agency, kind, active, ends, indefinite FROM sam_exclusions " +
        "WHERE employer_slug = ? ORDER BY active DESC, name LIMIT 20",
      [slug],
    );
    return got.map((r) => ({
      name: String(r.name ?? ""),
      city: s(r.city),
      state: s(r.state),
      classification: String(r.classification ?? ""),
      agency: s(r.agency),
      kind: s(r.kind),
      active: s(r.active),
      ends: s(r.ends),
      indefinite: Number(r.indefinite ?? 0) === 1,
    }));
  } catch (e) {
    if (/no such table/i.test(String(e))) return [];
    throw e;
  }
});
