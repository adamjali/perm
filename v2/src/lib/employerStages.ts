/**
 * Employers by the PERM cases DOL has pulled aside: on hold, at RFI or NORD,
 * in supervised recruitment, or under appeal. The pure half: parsing the
 * document the sweep writes, and the two rankings the page prints.
 *
 * Why two rankings. Counts answer "who has the most cases held", which is
 * dominated by the biggest filers; share answers "whose queue is mostly
 * held", which is where a small employer with every case on hold shows.
 * Share is only ranked above a floor, because two of two is not a signal.
 * The Turso half is `src/lib/turso/employerStages.ts`.
 */

export const QUEUE_STATUS = "ANALYST REVIEW";
/** An employer needs this many pending cases before its share is ranked. */
export const SHARE_FLOOR = 25;
export const EMPLOYER_STAGES_MAX_AGE_MS = 8 * 86_400_000;

export interface EmployerStageRow {
  name: string;
  slug: string | null;
  pending: number;
  /** Pending cases at any status other than analyst review. */
  review: number;
  share: number;
  byStatus: Record<string, number>;
}

export interface EmployerStagesDoc {
  asOf: string;
  pendingTotal: number;
  nationwide: Record<string, number>;
  minPending: number;
  employers: EmployerStageRow[];
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;

function isRow(v: unknown): v is EmployerStageRow {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.name === "string" &&
    (r.slug === null || typeof r.slug === "string") &&
    isInt(r.pending) &&
    isInt(r.review) &&
    typeof r.share === "number" &&
    typeof r.byStatus === "object" &&
    r.byStatus !== null &&
    Object.values(r.byStatus as Record<string, unknown>).every(isInt)
  );
}

/** Null for anything stale or malformed; a partial document must not render as a whole one. */
export function parseEmployerStagesDoc(json: string, computedAt: number, now: number): EmployerStagesDoc | null {
  if (now - computedAt > EMPLOYER_STAGES_MAX_AGE_MS) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const d = parsed as Record<string, unknown>;
  if (
    typeof d.asOf !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(d.asOf) ||
    !isInt(d.pendingTotal) ||
    typeof d.nationwide !== "object" ||
    d.nationwide === null ||
    !Object.values(d.nationwide as Record<string, unknown>).every(isInt) ||
    !isInt(d.minPending) ||
    !Array.isArray(d.employers) ||
    !d.employers.every(isRow)
  ) {
    return null;
  }
  const nationwide = d.nationwide as Record<string, number>;
  // The doc must reconcile with itself, the same rule the sweep applies before writing.
  const summed = Object.values(nationwide).reduce((a, b) => a + b, 0);
  if (summed !== d.pendingTotal) return null;
  return {
    asOf: d.asOf,
    pendingTotal: d.pendingTotal,
    nationwide,
    minPending: d.minPending,
    employers: d.employers as EmployerStageRow[],
  };
}

/** Most cases pulled aside, then most pending, then name. */
export function rankByReview(rows: readonly EmployerStageRow[], take = 50): EmployerStageRow[] {
  return [...rows]
    .filter((r) => r.review > 0)
    .sort((a, b) => b.review - a.review || b.pending - a.pending || a.name.localeCompare(b.name))
    .slice(0, take);
}

/** Highest share of pending pulled aside, above the floor, then count. */
export function rankByShare(rows: readonly EmployerStageRow[], take = 50, floor = SHARE_FLOOR): EmployerStageRow[] {
  return [...rows]
    .filter((r) => r.pending >= floor && r.review > 0)
    .sort((a, b) => b.share - a.share || b.review - a.review || a.name.localeCompare(b.name))
    .slice(0, take);
}

/** The share of the nationwide cases at a status that one employer holds, 0 when the status is empty. */
export function nationalShare(row: EmployerStageRow, status: string, nationwide: Record<string, number>): number {
  const total = nationwide[status] ?? 0;
  const mine = row.byStatus[status] ?? 0;
  return total > 0 ? mine / total : 0;
}
