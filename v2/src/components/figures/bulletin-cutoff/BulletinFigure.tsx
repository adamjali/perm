/**
 * The bulletin cutoff drawing for an article: reads the bulletin archive with the reader the
 * priority-date pages use and hands one line's run to the drawing. Shows nothing when the archive
 * can't be read or the line has no real cutoff in the window: a guide reads fine without it, and
 * a drawing built on a date the archive doesn't hold would not.
 */
import dynamic from "next/dynamic";
import { getVisaBulletinSeries } from "@/lib/db/publicData";
import { buildBulletinRun } from "./model";

// The drawing and its kit load only on the articles that use it.
const BulletinCutoffFigure = dynamic(() => import("./BulletinCutoffFigure"));

export async function BulletinFigure() {
  const bulletins = await getVisaBulletinSeries().catch(() => []);
  const run = buildBulletinRun({ bulletins });
  if (!run) return null;
  return <BulletinCutoffFigure run={run} />;
}
