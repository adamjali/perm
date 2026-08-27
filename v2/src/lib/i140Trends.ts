/**
 * Derivations over USCIS's quarterly I-140 counts.
 *
 * Outside the server-only boundary for the usual reason: the page has a
 * category selector, so this runs client-side, and the unit vitest project
 * uses happy-dom where importing server-only throws.
 */

export interface TrendRow {
  fiscalYear: number;
  quarter: number;
  category: string;
  categoryLabel: string;
  received: number;
  approved: number;
  denied: number;
  pending: number;
}

/**
 * THE CATEGORIES ARE A HIERARCHY, NOT A LIST, AND SUMMING THEM DOUBLE-COUNTS.
 *
 * Measured against the table, exactly and in every quarter:
 *   EB1 received = E11 + E12 + E13
 *   EB3 received = E31 + E32 + EW3
 *
 * So a chart of "all categories" would count every EB1 petition twice, once
 * under the preference and once under its subtype: 617,840 against a true
 * 355,321. Nothing here ever sums across the two levels.
 *
 * EB2 = E21 + NIW, and those two are the whole reason this page exists.
 *
 * They were briefly out by 92,802 because the ingest's code matcher read a
 * trailing-parens code as letters-then-a-digit; every code from E11 to EW3
 * ends in a digit and matched, and `(NIW)` fell through silently. Fixed at
 * the ingest, and EB2 now reconciles to its two children to the digit in
 * every quarter.
 *
 * KEEP THEM APART ON THE PAGE. Measured over six quarters, E21 denies 2.53%
 * and NIW denies 47.26% - an eighteen-fold difference between two categories
 * that at least one public tracker collapses into one by labelling E21
 * "National Interest Waiver". A reader comparing an employer-sponsored
 * advanced-degree petition against a self-petitioned waiver is looking at two
 * different queues, and averaging them would hide the single largest
 * difference in this dataset.
 */
export const PREFERENCE_OF: Record<string, string> = {
  E11: "EB1",
  E12: "EB1",
  E13: "EB1",
  E21: "EB2",
  NIW: "EB2",
  E31: "EB3",
  E32: "EB3",
  EW3: "EB3",
};

export const PREFERENCES = ["EB1", "EB2", "EB3"] as const;

/** Is this a top-level preference rather than a subtype? */
export function isPreference(category: string): boolean {
  return (PREFERENCES as readonly string[]).includes(category);
}

/**
 * Denial rate over DECIDED petitions, never over receipts.
 *
 * denied / (approved + denied). A rate over receipts drifts with the backlog
 * rather than with outcomes: a quarter where USCIS simply decided less would
 * show a falling denial rate while nothing about denials changed.
 *
 * Null when nothing was decided, which is a real state and must not render as
 * a confident 0%.
 */
export function denialRate(approved: number, denied: number): number | null {
  const decided = approved + denied;
  if (decided <= 0) return null;
  return (denied / decided) * 100;
}

/** Approval rate over the same denominator, for the same reason. */
export function approvalRate(approved: number, denied: number): number | null {
  const decided = approved + denied;
  if (decided <= 0) return null;
  return (approved / decided) * 100;
}

export interface QuarterPoint {
  fiscalYear: number;
  quarter: number;
  /** "FY2026 Q2", for an axis. */
  label: string;
  received: number;
  approved: number;
  denied: number;
  pending: number;
  denialRate: number | null;
}

/**
 * One category's quarters, oldest first.
 *
 * DROPS UNREPORTED QUARTERS RATHER THAN DRAWING THEM AT ZERO. USCIS has not
 * published FY2026 Q3 or Q4; a rival's chart shows them as bars at zero,
 * which reads as a collapse in filings rather than an absence of data. A
 * quarter with no receipts, no decisions and nothing pending is not a
 * measurement of zero, it is the absence of a measurement.
 */
export function quartersFor(rows: readonly TrendRow[], category: string): QuarterPoint[] {
  return rows
    .filter((r) => r.category === category)
    .filter((r) => r.received > 0 || r.approved > 0 || r.denied > 0 || r.pending > 0)
    .sort((a, b) => a.fiscalYear - b.fiscalYear || a.quarter - b.quarter)
    .map((r) => ({
      fiscalYear: r.fiscalYear,
      quarter: r.quarter,
      label: `FY${r.fiscalYear} Q${r.quarter}`,
      received: r.received,
      approved: r.approved,
      denied: r.denied,
      pending: r.pending,
      denialRate: denialRate(r.approved, r.denied),
    }));
}

export interface CategoryTotals {
  received: number;
  approved: number;
  denied: number;
  /** The NEWEST quarter's pending, not a sum: pending is a snapshot. */
  pending: number | null;
  approvalRate: number | null;
  denialRate: number | null;
  quarters: number;
}

/**
 * Totals for one category.
 *
 * PENDING IS A SNAPSHOT AND MUST NOT BE SUMMED. Each quarter reports how many
 * petitions were pending at that moment; adding six of them counts the same
 * waiting petition up to six times. The newest quarter's figure is the answer
 * to "how many are waiting", and it is the only defensible one here.
 */
export function totalsFor(points: readonly QuarterPoint[]): CategoryTotals {
  const received = points.reduce((n, p) => n + p.received, 0);
  const approved = points.reduce((n, p) => n + p.approved, 0);
  const denied = points.reduce((n, p) => n + p.denied, 0);
  const newest = points[points.length - 1];
  return {
    received,
    approved,
    denied,
    pending: newest ? newest.pending : null,
    approvalRate: approvalRate(approved, denied),
    denialRate: denialRate(approved, denied),
    quarters: points.length,
  };
}
