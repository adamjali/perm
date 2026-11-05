import "server-only";

import { analystReviewAverage, analystReviewQueue } from "@convex/lib/dolProcessingTimes";
import { getPermLine } from "./permLine";
import { getProcessingTimes } from "./processingTimes";
import { getPwdSummary } from "./pwdCases";
import { softFail } from "@/lib/softRead";

/**
 * Where DOL is, in the three figures the data hub and the sign-up page print: the filing month analyst review is
 * working and the wage requests still waiting, both by our own daily check of DOL's case status when we have it
 * (lib/permLine.ts, the wage-request sweep's summary), and DOL's published average, which is DOL's alone. DOL's
 * table is the fallback for the first two, so each figure says which it is and carries its own date: DOL's
 * table can sit unchanged for weeks (on Nov 2 2026 it still read "as of October 21", its wage table Sep 30).
 */
export interface DolPosition {
  /** The filing month DOL is deciding, "YYYY-MM". */
  month: string | null;
  /** DOL's published average, filing to an analyst-review decision. */
  averageDays: number | null;
  /** Wage requests still waiting at DOL. */
  pwdPending: number | null;
  /** The day our check ran (ISO), when the month or the count is ours. */
  checkedOn: string | null;
  /** DOL's own date on its table (ISO), for the average and any figure that falls back to it. */
  dolAsOf: string | null;
}

export async function getDolPosition(): Promise<DolPosition> {
  const [snapshot, line, pwd] = await Promise.all([
    getProcessingTimes().catch(softFail("dolPosition.getProcessingTimes", null)),
    getPermLine().catch(softFail("dolPosition.getPermLine", null)),
    getPwdSummary().catch(softFail("dolPosition.getPwdSummary", null)),
  ]);
  const dolMonth = snapshot ? (analystReviewQueue(snapshot.permQueues)?.priorityDate ?? null) : null;
  const dolPwd = snapshot?.pwdPermBacklog?.length ? snapshot.pwdPermBacklog.reduce((sum, r) => sum + r.remainingRequests, 0) : null;
  const checkedOn = line?.asOf ?? (pwd?.asOf ? pwd.asOf.slice(0, 10) : null);
  return {
    month: line?.month ?? (dolMonth ? dolMonth.slice(0, 7) : null),
    averageDays: snapshot ? (analystReviewAverage(snapshot.permAverageDays)?.calendarDays ?? null) : null,
    pwdPending: pwd?.pending ?? dolPwd,
    checkedOn: line || pwd ? checkedOn : null,
    dolAsOf: snapshot?.permAsOf ?? null,
  };
}
