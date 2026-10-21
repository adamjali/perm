/**
 * The wage-request conveyor for an article: reads the PERM wage requests in process and DOL's
 * pace with the reader the wage-request lookup uses (getPwdDayData), DOL's published month with
 * the PWD estimator's (getPwdEstimatorData), and today as the lookup counts it (Eastern), then
 * hands the run to the drawing. Shows nothing when any of them is missing or the day estimate
 * refuses (a stale count): a guide reads fine without it, and a drawing built on a wrong number
 * would not.
 */
import dynamic from "next/dynamic";
import { getPwdDayData } from "@/lib/db/pwdDayQueue";
import { getPwdEstimatorData } from "@/lib/db/estimate";
import { easternDay } from "@/lib/seasonalTiming";
import { buildPwdQueueRun } from "./model";

// The drawing and its kit load only on the articles that use it.
const PwdQueueConveyorFigure = dynamic(() => import("./PwdQueueConveyorFigure"));

export async function PwdQueueFigure() {
  const [day, estimator] = await Promise.all([getPwdDayData().catch(() => null), getPwdEstimatorData().catch(() => null)]);
  const run = buildPwdQueueRun({
    queue: day?.queue ?? null,
    dolMonth: estimator?.frontier?.oewsMonth ?? null,
    dolAsOf: estimator?.asOf ?? null,
    today: easternDay(),
  });
  if (!run) return null;
  return <PwdQueueConveyorFigure run={run} />;
}
