/**
 * Where DOL really is in the PERM line, from our own daily check of DOL's case-status service: the oldest
 * filing month with 100 or more cases that DOL hasn't decided half of (perm_docs['live_census'], rebuilt
 * after every sweep). DOL's own published month is dated by DOL and can sit unchanged for weeks; on Nov 2
 * 2026 it still read "as of October 21" (owner, Nov 2: "oct 21? isnt that super behind?"). So every surface
 * that names the month DOL is working leads with this, dated by our check, and gives DOL's table beside it,
 * as the wage-request line has since Oct 31 (lib/pwdLine.ts, whose rule this shares).
 *
 * Plain module: the pages and the unit project read it; the census is lib/db/liveCensus.ts.
 */

import { formatMonth } from "@/lib/dolFormat";
import { formatShareOf } from "@/lib/format";
import { longDate, monthDay } from "@convex/lib/months";

// The rule itself lives in convex/lib so Convex's PERM month alerts use the same one.
export { permLineFrom, type PermLine } from "@convex/lib/permLine";
import type { PermLine } from "@convex/lib/permLine";

/**
 * The line under the month, our check first and DOL's table after it: "42% decided by our check of DOL's
 * records on Nov 2. DOL's own table agrees, as of October 21, 2026."
 */
export function permLineNote(line: PermLine, dol: { month: string | null; asOf: string | null }): string {
  const ours = `${formatShareOf(line.decided, line.total)} decided by our check of DOL's records on ${monthDay(line.asOf) ?? line.asOf}.`;
  if (!dol.month) return ours;
  const dated = dol.asOf ? `, as of ${dol.asOf}` : "";
  return dol.month.slice(0, 7) === line.month
    ? `${ours} DOL's own table agrees${dated}.`
    : `${ours} DOL's own table says ${formatMonth(dol.month.slice(0, 7)) ?? dol.month}${dated}.`;
}

/** The sentence an article or a page quotes. */
export function permLineSentence(line: PermLine, dol: { month: string | null; asOf: string | null }): string {
  const head = `By our daily check of DOL's case status on ${longDate(line.asOf)}, DOL is deciding PERM cases filed in ${formatMonth(line.month) ?? line.month}.`;
  if (!dol.month || dol.month.slice(0, 7) === line.month) return head;
  return `${head} DOL's own table${dol.asOf ? `, dated ${dol.asOf},` : ""} names ${formatMonth(dol.month.slice(0, 7)) ?? dol.month}.`;
}
