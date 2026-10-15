import "server-only";

import { cache } from "react";

import { parseFacts, parseParts, type SponsorFact, type SponsorPart } from "../sponsorProfile";
import { one } from "./client";

/**
 * One sponsor's ranked record from `sponsor_index` (built nightly by
 * scripts/build_sponsor_index.py). A missing table, before its first build,
 * reads as "no profile"; any other failure throws to the page's own catch.
 */

export interface SponsorProfileData {
  parts: SponsorPart[];
  facts: SponsorFact[];
}

export const getSponsorProfile = cache(async (slug: string): Promise<SponsorProfileData | null> => {
  let r: { parts: string | null; facts: string | null } | null;
  try {
    r = await one<{ parts: string | null; facts: string | null }>(
      "SELECT parts, facts FROM sponsor_index WHERE slug = ?",
      [slug],
    );
  } catch (e) {
    if (/no such table/i.test(String(e))) return null;
    throw e;
  }
  if (!r) return null;
  const parts = parseParts(r.parts);
  const facts = parseFacts(r.facts);
  return parts.length || facts.length ? { parts, facts } : null;
});
