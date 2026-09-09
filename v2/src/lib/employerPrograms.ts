/**
 * One employer across DOL's three programs: the pure half.
 *
 * The employer page has always shown the PERM record with the wage-request
 * and LCA cases as bands underneath, which answers "did they file" but not
 * the two questions people actually bring: does this H-1B sponsor also file
 * green cards, and what does it pay on each form for the same kind of work.
 * This module turns three sets of counts and medians into the lines the
 * ledger prints and the one sentence about the wage gap, and refuses the
 * sentence when either side is too thin to mean anything.
 */

export type EmployerProgramKey = "perm" | "pwd" | "lca";

export interface ProgramLine {
  program: EmployerProgramKey;
  /** Rows in DOL's published files for this employer. */
  published: number;
  /** Cases DOL's live record shows still open. */
  pending: number | null;
  /** Median annual wage across the published rows with a usable wage, or null under the floor. */
  medianAnnualWage: number | null;
  /** How many published rows carried a usable wage. */
  wageN: number;
}

/** Below this many wages a median is one or two offers, not a figure. */
export const WAGE_FLOOR = 10;

export const PROGRAM_LABEL: Record<EmployerProgramKey, string> = {
  perm: "PERM (green card)",
  pwd: "Prevailing wage requests",
  lca: "H-1B labor condition applications",
};

/** The middle row of `n` rows sorted ascending, as an OFFSET. */
export function medianOffset(n: number): number {
  return Math.max(0, Math.floor((n - 1) / 2));
}

export interface WageGap {
  /** LCA median minus PERM median, in dollars; positive when the H-1B wage is higher. */
  dollars: number;
  /** As a share of the PERM median. */
  share: number;
  permMedian: number;
  lcaMedian: number;
  permN: number;
  lcaN: number;
}

/** The gap between what this employer attests on LCAs and what it offers on PERMs, or null when either side is under the floor. */
export function wageGap(perm: ProgramLine | null, lca: ProgramLine | null): WageGap | null {
  if (!perm || !lca) return null;
  if (perm.medianAnnualWage === null || lca.medianAnnualWage === null) return null;
  if (perm.wageN < WAGE_FLOOR || lca.wageN < WAGE_FLOOR) return null;
  const dollars = lca.medianAnnualWage - perm.medianAnnualWage;
  return {
    dollars,
    share: perm.medianAnnualWage > 0 ? dollars / perm.medianAnnualWage : 0,
    permMedian: perm.medianAnnualWage,
    lcaMedian: lca.medianAnnualWage,
    permN: perm.wageN,
    lcaN: lca.wageN,
  };
}

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** One sentence, with both figures and both counts in it, so the reader can weigh it. */
export function wageGapSentence(gap: WageGap): string {
  const pct = `${Math.abs(gap.share * 100).toFixed(gap.share * 100 >= 10 ? 0 : 1)}%`;
  if (Math.abs(gap.share) < 0.02) {
    return `Its median H-1B wage (${usd(gap.lcaMedian)} across ${gap.lcaN.toLocaleString("en-US")} LCAs) and its median PERM wage (${usd(gap.permMedian)} across ${gap.permN.toLocaleString("en-US")} cases) are within 2% of each other.`;
  }
  const dir = gap.dollars > 0 ? "higher" : "lower";
  return `Its median H-1B wage is ${usd(gap.lcaMedian)} across ${gap.lcaN.toLocaleString("en-US")} LCAs, ${pct} ${dir} than its median PERM wage of ${usd(gap.permMedian)} across ${gap.permN.toLocaleString("en-US")} cases. Different forms, different years and different jobs sit behind the two medians, so this is a gap in what was filed, not a finding.`;
}
