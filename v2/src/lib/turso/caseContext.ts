import "server-only";

import { cache } from "react";

import { one } from "./client";
import { getWageStats, type WagePercentileRow } from "./publicData";

/**
 * The extras a single-case page needs that the case lookup does not return.
 *
 * DELIBERATELY SEPARATE FROM caseLookup.ts. That module answers "what do we
 * know about this case", and its five joins are the answer. These are the
 * comparisons the page draws AROUND that answer (where the wage sits in its
 * occupation, how long the rest of the filing month took), and they are only
 * fetched when the case is decided, because for a pending case none of them
 * exist yet.
 *
 * EVERY FIGURE HERE IS A POPULATION STATISTIC, NOT A PROPERTY OF THE CASE.
 * That distinction is the whole reason this page can exist: a median over
 * 18,275 software developers is a fact about software developers, and it stops
 * being one the moment it is phrased as what this applicant should expect.
 */

export interface CaseWageContext {
  socCode: string;
  socTitle: string | null;
  state: string | null;
  wage: number;
  /** Certified cases in the same occupation, nationally. */
  occupation: WagePercentileRow;
  /** Certified cases in the same occupation AND state, when there are enough. */
  inState: WagePercentileRow | null;
}

/** Below this, a percentile is arithmetic on a handful of rows, not a ladder. */
const MIN_WAGE_SAMPLE = 30;

/**
 * Where one decided case's offered wage sits among its peers.
 *
 * Certified cases only, which is `getWageStats`'s own default: a denied
 * application's offered wage was never agreed to by anybody, so including it
 * would put a number in the ladder that no employer ever had to pay.
 *
 * Returns null rather than an empty comparison whenever the case carries no
 * wage or no SOC code. Both are optional in DOL's files, and a ladder drawn
 * without the value it is supposed to place is a chart of somebody else.
 */
export async function getCaseWageContext(
  caseNumber: string,
): Promise<CaseWageContext | null> {
  const r = await one<Record<string, unknown>>(
    `SELECT soc_code, soc_title, state, wage
       FROM perm_cases WHERE case_number = ?`,
    [caseNumber],
  );
  if (!r) return null;
  const socCode = r.soc_code === null ? null : String(r.soc_code);
  const wage = r.wage === null ? null : Number(r.wage);
  if (!socCode || wage === null || !Number.isFinite(wage) || wage <= 0) {
    return null;
  }
  const state = r.state === null ? null : String(r.state);

  const [occupation, stateRow] = await Promise.all([
    getWageStats({ socCode }),
    state ? getWageStats({ socCode, state }) : Promise.resolve(null),
  ]);
  if (occupation.n < MIN_WAGE_SAMPLE) return null;

  return {
    socCode,
    socTitle: r.soc_title === null ? null : String(r.soc_title),
    state,
    wage,
    occupation,
    inState:
      stateRow && stateRow.n >= MIN_WAGE_SAMPLE ? stateRow : null,
  };
}

export interface CohortDuration {
  /** Decided cases in DOL's disclosure files filed in this month. */
  n: number;
  medianDays: number | null;
  p25Days: number | null;
  p75Days: number | null;
}

/** Below this, a median over a filing month is a median over an anecdote. */
const MIN_DURATION_SAMPLE = 200;

/**
 * How long the rest of a filing month took, from DOL's own decided records.
 *
 * THE CALLER MUST CHECK COHORT MATURITY FIRST. This function will happily
 * compute a median for June 2026 and it will be 1 day, because the only cases
 * decided from a three-month-old cohort are the instant withdrawals. That
 * arithmetic is correct and the question is wrong. `cohortMaturity`
 * in casePosition.ts is the guard. The sample floor here catches the thin
 * months; it cannot catch the young ones, because a young month can hold
 * hundreds of early exits.
 */
export async function getCohortDuration(
  filingMonth: string,
): Promise<CohortDuration | null> {
  // Precomputed by the ingest into perm_docs (one row read) - the inline
  // window-function pass below scans perm_cases per request, because
  // received_date carries no index, and this runs on a dynamic route.
  const doc = await getDecidedPercentiles();
  const hit = doc?.find((m) => m.m === filingMonth);
  if (hit) {
    if (hit.n < MIN_DURATION_SAMPLE) return null;
    return {
      n: hit.n,
      medianDays: hit.p50,
      p25Days: hit.p25,
      p75Days: hit.p75,
    };
  }
  if (doc) return null; // the doc is authoritative for months it omits
  // Doc missing entirely (ingest down long enough to trip the staleness
  // guard): fall back to the live pass rather than blanking the page.
  const r = await one<Record<string, unknown>>(
    `WITH f AS (
       SELECT days FROM perm_cases
        WHERE substr(received_date, 1, 7) = ? AND days IS NOT NULL
     ), c AS (SELECT COUNT(*) AS n FROM f),
        o AS (SELECT days, ROW_NUMBER() OVER (ORDER BY days) AS rn FROM f)
     SELECT (SELECT n FROM c) AS n,
            (SELECT days FROM o WHERE rn = (SELECT (n + 1) / 2 FROM c)) AS p50,
            (SELECT days FROM o WHERE rn = (SELECT MAX(1, n / 4) FROM c))  AS p25,
            (SELECT days FROM o WHERE rn = (SELECT MAX(1, n * 3 / 4) FROM c)) AS p75`,
    [filingMonth],
  );
  const n = Number(r?.n ?? 0);
  if (n < MIN_DURATION_SAMPLE) return null;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    n,
    medianDays: num(r?.p50),
    p25Days: num(r?.p25),
    p75Days: num(r?.p75),
  };
}

interface PercentileMonth {
  m: string;
  n: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
}

/**
 * The per-month duration percentiles the ingest precomputes. One doc read
 * per request (React-cached), same freshness posture as the live census:
 * a doc more than 8 days old is treated as absent.
 */
const getDecidedPercentiles = cache(
  async (): Promise<PercentileMonth[] | null> => {
    const r = await one<{ json: string; computed_at: number }>(
      "SELECT json, computed_at FROM perm_docs WHERE key = 'decided_month_percentiles'",
    );
    if (!r) return null;
    if (Date.now() - Number(r.computed_at) > 8 * 24 * 60 * 60 * 1000) {
      return null;
    }
    try {
      const d = JSON.parse(String(r.json)) as { months?: unknown };
      if (!Array.isArray(d.months)) return null;
      const ok = d.months.every(
        (x): x is PercentileMonth =>
          typeof x === "object" && x !== null &&
          typeof (x as PercentileMonth).m === "string" &&
          typeof (x as PercentileMonth).n === "number",
      );
      return ok ? (d.months as PercentileMonth[]) : null;
    } catch {
      return null;
    }
  },
);
