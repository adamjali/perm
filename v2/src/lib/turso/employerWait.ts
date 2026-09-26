import "server-only";

import { cache } from "react";

import { buildCaseEstimate } from "@/lib/caseEstimate";
import { caseEstimateInputs } from "@/lib/caseEstimateInputs";
import { one, rows } from "@/lib/turso/client";
import { summariseWaits, type WaitSummary } from "@/lib/waitSummary";
import { getDecisionPace } from "@/lib/turso/decisionPace";
import { getEstimatorData } from "@/lib/turso/estimate";
import { getLiveBacklog } from "@/lib/turso/publicData";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";

/**
 * How long one employer's PERM cases are taking, against every employer's,
 * and what a case filed today would wait. For the wait section on employer
 * pages.
 *
 * DECISIONS WE WATCHED, NOT FIRST SIGHTINGS. Both figures count only cases
 * the sweep saw pending and then decided (a final event), so a case found
 * months after DOL decided it can't read as a 500-day wait. Expirations and
 * withdrawals are left out. The all-employers figure is precomputed after
 * each sweep (`perm_docs['recent_decision_wait']`, build_entity_detail.py);
 * the employer's own is one bounded read keyed on its slug.
 */

export const RECENT_WAIT_DAYS = 90;
const DIRECT_SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, direct)";

export interface RankedEmployerWait {
  slug: string;
  name: string;
  n: number;
  p50: number;
}

export interface FieldWait extends WaitSummary {
  windowDays: number;
  computedOn: string;
  /** Employers with at least `minDecisions` observed decisions in the window. */
  employersRanked?: number;
  minDecisions?: number;
  fastest?: RankedEmployerWait[];
  slowest?: RankedEmployerWait[];
}

export const getFieldWait = cache(async (): Promise<FieldWait | null> => {
  const r = await one<{ json: string }>(`SELECT json FROM perm_docs WHERE key = 'recent_decision_wait'`);
  if (!r) return null;
  try {
    return JSON.parse(r.json) as FieldWait;
  } catch {
    return null;
  }
});

export const getEmployerWait = cache(async (slug: string): Promise<WaitSummary> => {
  const since = Date.now() - RECENT_WAIT_DAYS * 86_400_000;
  const got = await rows<{ f: string; t: number | string }>(
    `SELECT r.filing_date AS f, MIN(e.changed_at) AS t
       FROM perm_live_recent r
       JOIN perm_case_events e ON e.case_number = r.case_number
      WHERE r.employer_slug = ? AND e.changed_at >= ? AND e.source = ? AND e.to_final = 1
        AND e.from_status NOT LIKE 'CERTIFIED%' AND e.from_status NOT LIKE 'DENIED%'
        AND e.from_status NOT LIKE 'WITHDRAWN%' AND e.to_status NOT LIKE 'WITHDRAWN%'
      GROUP BY r.case_number`,
    [slug, since, DIRECT_SOURCE],
  );
  return summariseWaits(got.filter((g) => g.f).map((g) => ({ filed: g.f, stamp: Number(g.t) })));
});

export interface FiledToday {
  estimatedDate: string;
  earliestDate: string | null;
  latestDate: string | null;
  casesAhead: number | null;
}

/**
 * The estimate a case filed today gets on the case page and the calculator:
 * the same two calls, so the employer page never quotes a different date.
 */
export const getFiledTodayEstimate = cache(async (): Promise<FiledToday | null> => {
  const today = new Date().toISOString().slice(0, 10);
  const [backlog, estimator, decisionPace, sweep] = await Promise.all([
    getLiveBacklog().catch(() => []),
    getEstimatorData().catch(() => null),
    getDecisionPace().catch(() => null),
    getSweepCoverage().catch(() => null),
  ]);
  // Early in a new month, before the census holds it, casesAhead is null and
  // the estimate falls back to the month-level models, as the case page does.
  const { casesAhead, sweepAgeDays } = caseEstimateInputs({
    backlog,
    filingDate: today,
    sweepFinishedOn: sweep?.finishedOn ?? null,
    today,
  });
  const est = buildCaseEstimate({
    filingDate: today,
    status: "ANALYST REVIEW",
    isFinal: false,
    estimator,
    casesAhead,
    decisionPace: decisionPace?.pace ?? null,
    sweepAgeDays,
    today,
  });
  if (!est || est.kind !== "date") return null;
  return { estimatedDate: est.estimatedDate, earliestDate: est.earliestDate, latestDate: est.latestDate, casesAhead };
});
