/**
 * The queue conveyor for an article: reads today's line, DOL's pace and its published month with
 * the readers the queue month pages use, and hands the run to the drawing. Shows nothing when
 * any of them is missing or the estimate refuses (a stale sweep): a guide reads fine without it,
 * and a drawing built on a wrong number would not.
 */
import { getLiveBacklog } from "@/lib/db/publicData";
import { getDecisionPace } from "@/lib/db/decisionPace";
import { getEstimatorData } from "@/lib/db/estimate";
import { getSweepCoverage } from "@/lib/db/sweepCoverage";
import dynamic from "next/dynamic";
import { buildQueueRun } from "./model";

// The drawing and its kit load only on the articles that use it.
const QueueConveyorFigure = dynamic(() => import("./QueueConveyorFigure"));

export async function QueueFigure() {
  const [backlog, pace, estimator, sweep] = await Promise.all([
    getLiveBacklog().catch(() => []),
    getDecisionPace().catch(() => null),
    getEstimatorData().catch(() => null),
    getSweepCoverage().catch(() => null),
  ]);
  const run = buildQueueRun({
    backlog,
    pace: pace?.pace ?? null,
    dolMonth: estimator?.frontier?.analystQueueMonth ?? null,
    dolAsOf: estimator?.frontier?.asOf ?? null,
    sweepFinishedOn: sweep?.finishedOn ?? null,
    today: new Date().toISOString().slice(0, 10),
  });
  if (!run || !sweep?.finishedOn) return null;
  return <QueueConveyorFigure run={run} census={sweep.finishedOn} />;
}
