import "server-only";

import { cache } from "react";

import { one } from "./client";

/**
 * Where and when PERM employers recruit, from perm_docs['recruitment_summary']
 * (scripts/build_recruitment.py, rebuilt after each quarterly disclosure load):
 * DOL's Form 9089 Section H over every decided new-form case.
 *
 * Null when the doc hasn't been built. A failed read throws, so the page keeps
 * its last good render rather than calling the record empty.
 */

export interface Spread {
  n: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface Paper {
  key: string;
  label: string;
  n: number;
}

export interface RecruitmentSummary {
  /** The newest decision the summary covers, `YYYY-MM-DD`. */
  asOf: string | null;
  /** Cases that carry a recruitment record. */
  cases: number;
  steps: { id: string; n: number }[];
  notice: { id: string; n: number }[];
  adTypes: { label: string; n: number }[];
  /** DOL's Y or N: whether the newspaper has a Sunday edition. */
  sundayEdition: Record<string, number>;
  /** Days before filing: the first step, the last, the second ad and the job order's end. */
  lead: Record<"firstStep" | "lastStep" | "secondAd" | "jobOrderEnd", Spread | null>;
  leadBands: { id: string; n: number }[];
  papers: Paper[];
  /** How many spellings the papers above were grouped from. */
  paperSpellings: number;
  byState: Record<string, Paper[]>;
}

export const getRecruitmentSummary = cache(async (): Promise<RecruitmentSummary | null> => {
  const r = await one<{ json: string }>("SELECT json FROM perm_docs WHERE key = 'recruitment_summary'");
  if (!r) return null;
  const doc = JSON.parse(String(r.json)) as RecruitmentSummary;
  return doc.cases > 0 ? doc : null;
});
