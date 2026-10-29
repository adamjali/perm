import crosswalk from "../../scripts/data/soc_2010_to_2018.json";

import { socGroup } from "@/lib/socCode";

/**
 * Which 2010 occupation codes came before a 2018 one, from BLS's own crosswalk (November 2017), written by
 * scripts/build_soc_crosswalk.py. DOL's wage tables used the 2010 codes through 2021-22 and the 2018 codes from
 * 2022-23, so a job's earlier years are read under its predecessors. The map is many-to-many (software developers
 * came from 15-1132 and 15-1133, and both also became 15-1253), so each earlier code is shown as its own row, never
 * blended into one figure.
 */

/** The first wage year DOL's tables code jobs in the 2018 system (read off the stored tables, Oct 29 2026). */
export const SOC_2018_FIRST_WAGE_YEAR = 2022;

export interface SocPredecessor {
  code: string;
  title: string;
  /** The other 2018 jobs this 2010 code also became. */
  alsoTo: { code: string; title: string }[];
}

const CODES = (crosswalk as { codes: Record<string, SocPredecessor[]> }).codes;

/** The 2010 codes BLS maps to a 2018 job; empty when the job kept its code. */
export function predecessorsOf(code: string): SocPredecessor[] {
  const soc = socGroup(code);
  return soc ? (CODES[soc] ?? []) : [];
}

let successors: Map<string, string[]> | null = null;

/**
 * The 2018 codes a 2010 code became: BLS's crosswalk read the other way, so a reader holding an old LCA
 * (15-1132) finds today's job. Empty for a code that kept its number, or isn't a code.
 */
export function successorsOf(code: string): string[] {
  const soc = socGroup(code);
  if (!soc) return [];
  if (!successors) {
    successors = new Map();
    for (const [to, preds] of Object.entries(CODES)) {
      for (const p of preds) successors.set(p.code, [...(successors.get(p.code) ?? []), to]);
    }
  }
  return [...(successors.get(soc) ?? [])].sort();
}

const joinAnd = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * One note under a year table that shows earlier codes: why they're there, and which other jobs each also covered,
 * so a reader doesn't take a 2010 code's wage as this job's alone. Null for a job that kept its code.
 */
export function predecessorNote(code: string): string | null {
  const preds = predecessorsOf(code);
  if (!preds.length) return null;
  const groups = new Map<string, { codes: string[]; alsoTo: SocPredecessor["alsoTo"] }>();
  for (const p of preds) {
    if (!p.alsoTo.length) continue;
    const key = p.alsoTo.map((a) => a.code).join(",");
    const g = groups.get(key) ?? { codes: [], alsoTo: p.alsoTo };
    g.codes.push(p.code);
    groups.set(key, g);
  }
  const lead = "Until June 2022 DOL filed this job under BLS's 2010 codes, so its earlier years show each of them.";
  const covered = [...groups.values()].map(
    (g) => `${joinAnd(g.codes)} also covered ${joinAnd(g.alsoTo.map((a) => `${a.code} (${a.title})`))}.`,
  );
  return [lead, ...covered].join(" ");
}
