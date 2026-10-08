/**
 * The daily scorecard run: record today's predictions, grade the decided
 * ones, rewrite the summaries.
 *
 * The server's timer calls it with `Authorization: Bearer <CRON_SECRET>` at
 * 12:00 UTC (8 AM Eastern), after the 4:10 AM sweep and the gap sweep behind
 * it have written the census and the event log this reads. Its timer in
 * scripts/oracle/systemd is held to HOUSEKEEPING_JOBS in ../dispatch/jobs.ts.
 *
 * Idempotent within a day: a prediction's id is its day, source and case, and
 * rows are inserted OR IGNORE, so a second delivery of the same cron records
 * nothing new and changes nothing already recorded.
 */

import { NextResponse } from "next/server";

import { pick, rngFor } from "@/lib/scorecard/score";
import { rivalPredictions } from "@/lib/scorecard/rivals";
import {
  easternDate,
  ensurePredictionsTable,
  gradeOpenPredictions,
  predictOurs,
  predictSeasonal,
  predictWatched,
  predictBulletinRelease,
  recordPredictions,
  RIVAL_SAMPLE,
  writeScorecardDocs,
} from "@/lib/turso/predictions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request): Promise<NextResponse> {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const recordedOn = easternDate(Date.now());
  // `?dry=1` computes today's predictions and returns them without writing
  // anything and without calling a rival: the QA path, and the way to look at
  // what a run would record before trusting it.
  const params = new URL(request.url).searchParams;
  const dry = params.get("dry") === "1";
  try {
    // `?docs=1` rewrites the two summaries from the rows already recorded, and
    // records, asks and grades nothing: the way to show a change to the
    // summaries the same day it deploys, without a second rival round.
    if (params.get("docs") === "1") {
      const { rows } = await writeScorecardDocs(recordedOn);
      return NextResponse.json({ docs: true, recordedOn, rows });
    }
    if (dry) {
      const [{ perm, pwd, sample }, seasonal, watched] = await Promise.all([
        predictOurs(today), predictSeasonal(recordedOn), predictWatched(today).catch(() => []),
      ]);
      // Watched cases are counted, never listed: the dry answer is read in a terminal.
      return NextResponse.json({ dry: true, recordedOn, sampled: sample.length, perm, pwd, seasonal, watched: watched.length });
    }
    await ensurePredictionsTable();
    const { perm, pwd, sample, pendingBefore } = await predictOurs(today);
    const seasonal = await predictSeasonal(recordedOn);
    const release = await predictBulletinRelease(recordedOn).catch(() => []);
    // Subscribers' own cases, once each; recorded with ours, never put to a rival.
    const watched = await predictWatched(today).catch((e) => {
      console.error("[scorecard] watched cases not recorded", e);
      return [];
    });
    const ours = await recordPredictions(recordedOn, [...perm, ...pwd, ...seasonal, ...release, ...watched]);
    const rivalCases = pick(sample, RIVAL_SAMPLE, rngFor(recordedOn));
    const { preds, failures } = await rivalPredictions(rivalCases, today, pendingBefore);
    const rivals = await recordPredictions(recordedOn, preds);
    const { graded, open } = await gradeOpenPredictions();
    const { rows } = await writeScorecardDocs(recordedOn);
    const out = {
      recordedOn, ours, perm: perm.length, pwd: pwd.length, seasonal: seasonal.length, release: release.length,
      watched: watched.length,
      rivals, failures, graded, open, rows,
    };
    console.log(`[scorecard] ${JSON.stringify(out)}`);
    return NextResponse.json(out);
  } catch (e) {
    console.error("[scorecard] failed", e);
    return NextResponse.json({ error: "scorecard run failed" }, { status: 500 });
  }
}
