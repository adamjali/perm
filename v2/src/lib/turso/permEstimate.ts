/**
 * One PERM case's decision estimate, from the same inputs the case page uses.
 *
 * The case page assembles these inputs in its own render; the daily scorecard
 * (predictions.ts) and the API (src/lib/api/reads.ts) assemble them here, so
 * an estimate an assistant quotes and one the scorecard grades are the
 * estimate a reader would have been shown that day.
 */
import "server-only";

import { buildCaseEstimate, type CaseEstimate } from "@/lib/caseEstimate";
import { caseEstimateInputs } from "@/lib/caseEstimateInputs";
import { getDecisionPace } from "@/lib/turso/decisionPace";
import { getStragglerRates } from "@/lib/turso/stragglers";
import { getRangeCoverage } from "@/lib/turso/rangeCoverage";
import { getRfiClock } from "@/lib/turso/rfiClock";
import { getEstimatorData } from "@/lib/turso/estimate";
import { getLiveBacklog } from "@/lib/turso/publicData";
import { ageByStatusFrom, exitMixFor, getStageStats, stageDurationFor } from "@/lib/turso/stageStats";
import { getSweepCoverage } from "@/lib/turso/sweepCoverage";

export interface PermEstimateContext {
  backlog: Awaited<ReturnType<typeof getLiveBacklog>>;
  estimator: Awaited<ReturnType<typeof getEstimatorData>> | null;
  decisionPace: Awaited<ReturnType<typeof getDecisionPace>> | null;
  sweep: Awaited<ReturnType<typeof getSweepCoverage>> | null;
  stageStats: Awaited<ReturnType<typeof getStageStats>> | null;
  stragglers: Awaited<ReturnType<typeof getStragglerRates>> | null;
  rangeCoverage: Awaited<ReturnType<typeof getRangeCoverage>> | null;
  rfiClock: Awaited<ReturnType<typeof getRfiClock>> | null;
}

/** Every input but the case itself. Each read but the backlog is allowed to be missing. */
export async function loadPermEstimateContext(): Promise<PermEstimateContext> {
  const [backlog, estimator, decisionPace, sweep, stageStats, stragglers, rangeCoverage, rfiClock] = await Promise.all([
    getLiveBacklog(),
    getEstimatorData().catch(() => null),
    getDecisionPace().catch(() => null),
    getSweepCoverage().catch(() => null),
    getStageStats().catch(() => null),
    getStragglerRates().catch(() => null),
    getRangeCoverage().catch(() => null),
    getRfiClock().catch(() => null),
  ]);
  return { backlog, estimator, decisionPace, sweep, stageStats, stragglers, rangeCoverage, rfiClock };
}

export function estimatePermCase(
  ctx: PermEstimateContext,
  /** `rfiEnteredOn`: for a case at RFI ISSUED, the day our sweep saw it enter RFI (rfiEnteredOn). */
  c: { filingDate: string; status: string; rfiEnteredOn?: string | null },
  today: string,
): { estimate: CaseEstimate | null; casesAhead: number | null } {
  const { casesAhead, sweepAgeDays } = caseEstimateInputs({
    backlog: ctx.backlog,
    filingDate: c.filingDate,
    sweepFinishedOn: ctx.sweep?.finishedOn ?? null,
    today,
  });
  const estimate = buildCaseEstimate({
    filingDate: c.filingDate,
    status: c.status,
    isFinal: false,
    estimator: ctx.estimator,
    casesAhead,
    decisionPace: ctx.decisionPace?.pace ?? null,
    sweepAgeDays,
    stragglers: ctx.stragglers,
    rangeCoverage: ctx.rangeCoverage,
    measuredStageAges: ageByStatusFrom(ctx.stageStats),
    stageExit: exitMixFor(ctx.stageStats, c.status),
    stageDuration: stageDurationFor(ctx.stageStats, c.status),
    rfi: { enteredOn: c.rfiEnteredOn ?? null, clock: ctx.rfiClock },
    today,
  });
  return { estimate, casesAhead };
}
