/**
 * USCIS's H-1B decisions for one employer, by fiscal year: the pure half.
 *
 * From the H-1B Employer Data Hub (scripts/ingest_uscis_h1b_hub.py). USCIS
 * counts WORKERS on its FIRST decision, split by the box ticked on Form I-129
 * Part 2 Question 2; appeals, revocations and pending petitions are excluded,
 * and the address is the petitioner's mailing address. The definitions below
 * are USCIS's, from "Understanding Our H-1B Employer Data Hub", shortened
 * only where they repeat themselves.
 */

export const USCIS_H1B_HUB = "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub";
export const USCIS_H1B_GLOSSARY =
  "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub/understanding-our-h-1b-employer-data-hub";

/** Below this many decisions in a year an approval rate is a handful of cases, not a figure. */
export const RATE_FLOOR = 20;

export type H1bKindKey = "new" | "cont" | "same" | "conc" | "chg" | "amend";

export const H1B_KINDS: readonly { key: H1bKindKey; label: string; meaning: string }[] = [
  {
    key: "new",
    label: "New employment",
    meaning:
      "The worker is outside the US with no classification, is changing to H-1B from another classification, or stays with the employer in a different classification.",
  },
  { key: "chg", label: "Change of employer", meaning: "The worker moves to this employer from another, in the H-1B classification already held." },
  { key: "cont", label: "Continuation", meaning: "Continuing previously approved employment with the same employer, without change." },
  { key: "same", label: "Change with the same employer", meaning: "A non-material change, such as a new job title without a material change in duties." },
  { key: "amend", label: "Amended petition", meaning: "A material change in the terms or conditions of employment, or a substitution." },
  { key: "conc", label: "New concurrent", meaning: "A second employer while the worker keeps working for the first." },
];

export interface H1bYear {
  fy: number;
  /** Approvals and denials by kind. */
  approved: Record<H1bKindKey, number>;
  denied: Record<H1bKindKey, number>;
}

export interface UscisH1bRecord {
  years: H1bYear[];
  /** The spellings counted, busiest first, and how many there were in all. */
  names: { name: string; approved: number }[];
  nameCount: number;
}

/** The read layer's per-year row; libSQL may hand numbers back as strings. */
export type H1bYearRow = { fy: number | string } & Record<`${H1bKindKey}_appr` | `${H1bKindKey}_den`, number | string | null>;

const n = (v: number | string | null | undefined) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};

export function shapeYears(rows: readonly H1bYearRow[]): H1bYear[] {
  return rows
    .map((r) => {
      const approved = {} as Record<H1bKindKey, number>;
      const denied = {} as Record<H1bKindKey, number>;
      for (const k of H1B_KINDS) {
        approved[k.key] = n(r[`${k.key}_appr`]);
        denied[k.key] = n(r[`${k.key}_den`]);
      }
      return { fy: n(r.fy), approved, denied };
    })
    .filter((y) => y.fy > 0)
    .sort((a, b) => a.fy - b.fy);
}

export const sum = (r: Record<H1bKindKey, number>) => H1B_KINDS.reduce((s, k) => s + r[k.key], 0);

/** Approvals over first decisions, or null under the floor. */
export function approvalRate(approved: number, denied: number): number | null {
  const decided = approved + denied;
  return decided >= RATE_FLOOR ? approved / decided : null;
}

/**
 * The year to lead with: the newest year USCIS has finished, so a part-year
 * never reads as a whole one. `throughIso` is the hub's own last date.
 */
export function leadYear(years: readonly H1bYear[], throughIso: string | null): { year: H1bYear; partial: boolean } | null {
  if (years.length === 0) return null;
  const newest = years[years.length - 1]!;
  const complete = !throughIso || throughIso >= `${newest.fy}-09-30`;
  if (complete) return { year: newest, partial: false };
  const prior = years.length > 1 ? years[years.length - 2]! : null;
  return prior && prior.fy === newest.fy - 1 ? { year: prior, partial: false } : { year: newest, partial: true };
}
