import "server-only";

import { getLiveBacklog, type LiveCohortMonth } from "./publicData";
import { getEstimatorData, type EstimatorData } from "./estimate";
import { getDecisionPace } from "./decisionPace";
import { getSweepCoverage } from "./sweepCoverage";
import { getStragglerRates } from "./stragglers";
import { getRangeCoverage } from "./rangeCoverage";
import { getRfiClock } from "./rfiClock";
import { getPermDayQueue } from "./permDayQueue";
import { getStageStats } from "./stageStats";
import type { StageStats } from "@/lib/stageStatsShape";
import type { MeasuredPace, RangeCoverage, RfiClock } from "@/lib/perm";
import type { StragglerRates } from "@/lib/stragglerRates";
import type { DayCounts } from "@/lib/queueAhead";

/**
 * The case-INDEPENDENT corpus the signed-in app needs to estimate any case.
 *
 * ## Why this exists
 *
 * The public case page assembles exactly these inputs inline and hands them to
 * `CaseStatusResult`, which runs `buildCaseEstimate`. The app wants the same
 * estimate on a SAVED case, but the app's case pages are client components
 * reading the case from Convex, while every one of these inputs is a
 * `server-only` read of the public mirror. None of it depends on which case is
 * being looked at, so the whole blob is loaded ONCE on the server and handed to
 * the client tree, where each case runs the pure `appCaseEstimate` wrapper
 * against it (`src/lib/appCaseEstimate.ts`). This is the one seam that lets the
 * predictive layer reuse the estimators rather than re-implement them inside
 * Convex.
 *
 * Everything here is plain, serializable data: it crosses the server/client
 * boundary as props. Each loader is defaulted rather than allowed to throw,
 * exactly as the public page does, so a missing input degrades the estimate
 * (the decision-pace model is omitted, a date is withheld) instead of taking
 * the page down.
 */
export interface AppCaseCorpus {
  backlog: LiveCohortMonth[];
  estimator: EstimatorData | null;
  /** DOL's measured decision rate (the `.pace`), or null when thin or stale. */
  decisionPace: MeasuredPace | null;
  /** The sweep's own finish date, for the estimate's staleness ladder. */
  sweepFinishedOn: string | null;
  stragglers: StragglerRates | null;
  rangeCoverage: RangeCoverage | null;
  rfiClock: RfiClock | null;
  byDay: DayCounts | null;
  stageStats: StageStats | null;
}

/** Load the case-independent estimate corpus. Server-only; call it in a server component. */
export async function getAppCaseCorpus(): Promise<AppCaseCorpus> {
  const [backlog, estimator, decisionPace, sweep, stragglers, rangeCoverage, rfiClock, byDay, stageStats] =
    await Promise.all([
      getLiveBacklog().catch((): LiveCohortMonth[] => []),
      getEstimatorData().catch(() => null),
      getDecisionPace().catch(() => null),
      getSweepCoverage().catch(() => null),
      getStragglerRates().catch(() => null),
      getRangeCoverage().catch(() => null),
      getRfiClock().catch(() => null),
      getPermDayQueue().catch(() => null),
      getStageStats().catch(() => null),
    ]);
  return {
    backlog,
    estimator,
    decisionPace: decisionPace?.pace ?? null,
    sweepFinishedOn: sweep?.finishedOn ?? null,
    stragglers,
    rangeCoverage,
    rfiClock,
    byDay,
    stageStats,
  };
}
