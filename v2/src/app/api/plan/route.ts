import { NextResponse } from "next/server";

import { getLineSnapshot } from "@/lib/db/greenCardLine";
import { estimatePermCase, loadPermEstimateContext } from "@/lib/db/permEstimate";
import { getPwdDayData } from "@/lib/db/pwdDayQueue";
import { estimateLine } from "@/lib/greenCardLine";
import { estimatePwdDay } from "@/lib/perm";
import { parsePlanQuery, type PlanAnswer, type PlanQuery } from "@/lib/planQuery";
import { easternDay } from "@convex/lib/time";

/**
 * GET /api/plan?pwd=YYYY-MM-DD&perm=YYYY-MM-DD&pd=YYYY-MM-DD&cat=EB2&country=india: the queue-based dates
 * the green card planner can't work out in the browser, from the same estimators the case pages
 * use, so the planner never dates a case differently from its own case page.
 *
 * - `pwd`: a PERM wage request filed that day and still in process, dated by the requests ahead
 *   of it at DOL's measured pace (estimatePwdDay, the wage-request page's model).
 * - `perm`: a PERM filed that day and in line, dated by the cases ahead of it at DOL's measured
 *   pace (estimatePermCase, the case page's model).
 * - `pd` with `cat` and `country`: the people ahead of that priority date in its line and the
 *   green cards the line was issued in a year (estimateLine, the green card line's model).
 *
 * Every part is independent and may be null (with a note when the model says why). A malformed
 * query answers 400; a failed read 503, never an empty answer that reads as "nothing ahead".
 */
export async function GET(req: Request) {
  const today = easternDay();
  const q = parsePlanQuery(new URL(req.url).searchParams, today);
  if ("error" in q) return NextResponse.json({ error: q.error }, { status: 400 });

  try {
    const [pwd, perm, line] = await Promise.all([
      q.pwd ? datePwd(q.pwd, today) : null,
      q.perm ? datePerm(q.perm, today) : { perm: null, permNote: null },
      q.line ? lineOf(q.line) : null,
    ]);
    const answer: PlanAnswer = { pwd, ...perm, line };
    return NextResponse.json(answer, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (e) {
    console.error("[plan] read failed", e);
    return NextResponse.json({ error: "the queues couldn't be read; try again in a minute" }, { status: 503 });
  }
}

async function datePwd(filed: string, today: string): Promise<PlanAnswer["pwd"]> {
  const data = await getPwdDayData();
  if (!data) return null;
  const est = estimatePwdDay({ filingDate: filed, today, queue: data.queue, measuredRange: data.measuredRange });
  if (est.kind !== "estimate") return null;
  return { low: est.earliest, mid: est.date, high: est.latest, casesAhead: Math.round(est.requestsAhead), perDay: Math.round(est.pace) };
}

async function datePerm(filed: string, today: string): Promise<Pick<PlanAnswer, "perm" | "permNote">> {
  const ctx = await loadPermEstimateContext();
  // The planner doesn't know the case's status, so it dates a case in line, as most are.
  const { estimate, casesAhead } = estimatePermCase(ctx, { filingDate: filed, status: "ANALYST REVIEW" }, today);
  const perDay = ctx.decisionPace?.pace.pace ?? null;
  if (estimate?.kind === "date" && casesAhead !== null && perDay !== null) {
    return {
      perm: {
        low: estimate.earliestDate ?? estimate.estimatedDate,
        mid: estimate.estimatedDate,
        high: estimate.latestDate ?? estimate.estimatedDate,
        casesAhead: Math.round(casesAhead),
        perDay: Math.round(perDay),
      },
      permNote: null,
    };
  }
  return { perm: null, permNote: estimate?.kind === "no-date" ? estimate.note : null };
}

async function lineOf(line: NonNullable<PlanQuery["line"]>): Promise<PlanAnswer["line"]> {
  const r = estimateLine({ category: line.category, country: line.country, priorityDate: line.pd }, await getLineSnapshot());
  if (r.kind !== "estimate" || !r.supply) return null;
  return {
    // Counts of people, whole: the model's shares make fractions nobody can stand in line as.
    peopleAhead: { low: Math.round(r.peopleAhead.low), mid: Math.round(r.peopleAhead.mid), high: Math.round(r.peopleAhead.high) },
    perYear: r.supply.perYear,
    fy: r.supply.fy,
  };
}
