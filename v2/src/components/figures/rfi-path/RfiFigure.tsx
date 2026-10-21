/**
 * The RFI railway for an article: reads the measured RFI clock and the RFIs our sweep watched
 * with the readers the case page and the RFI page use, and hands the run to the drawing. Shows
 * nothing when the clock is missing or the estimate refuses: a guide reads fine without it, and
 * a drawing built on a wrong number would not.
 */
import { getRfiClock } from "@/lib/db/rfiClock";
import { getStageStats } from "@/lib/db/stageStats";
import { parseRfiPath } from "@/lib/stageMoves";
import dynamic from "next/dynamic";
import { buildRfiRun } from "./model";

// The drawing and its kit load only on the articles that use it.
const RfiPathFigure = dynamic(() => import("./RfiPathFigure"));

/** Today as the case page reads it (UTC), so an RFI issued today gets the date the case page prints. */
const todayUtc = () => new Date().toISOString().slice(0, 10);

export async function RfiFigure() {
  const [clock, stats] = await Promise.all([getRfiClock().catch(() => null), getStageStats().catch(() => null)]);
  const run = buildRfiRun({ clock, path: parseRfiPath(stats?.rfiPath), today: todayUtc() });
  if (!run) return null;
  return <RfiPathFigure run={run} />;
}
