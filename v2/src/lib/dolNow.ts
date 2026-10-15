import { analystReviewAverage, analystReviewQueue } from "@convex/lib/dolProcessingTimes";
import { formatAsOf, formatMonth, formatMonthShort } from "@/lib/dolFormat";
import type { ProcessingTimesSnapshot } from "@/lib/db/processingTimes";

/**
 * DOL's two headline figures, worded for prose: how long its published average
 * says a decision takes, and which filing month its analyst review is working.
 *
 * WHY THIS EXISTS. Articles and the FAQ had "about 372 days as of August 2026"
 * typed into them; on Oct 9 2026 DOL said 336 days and its queue had moved
 * from September to December 2025, and the typed figure still read as current.
 * A figure in prose now comes from the snapshot the processing-times page
 * reads, and always carries the date DOL published it, because a figure and
 * its date are one claim.
 */
export interface DolNow {
  /** DOL's average calendar days from filing to an analyst-review decision. */
  days: number | null;
  /** The month of decisions that average was measured on, "August 2026". */
  decidedIn: string | null;
  /** The filing month analyst review is working, "December 2025". */
  frontier: string | null;
  /** The day DOL published these figures, "October 5, 2026". */
  asOf: string | null;
}

export function dolNow(t: ProcessingTimesSnapshot | null): DolNow {
  if (!t) return { days: null, decidedIn: null, frontier: null, asOf: null };
  const avg = analystReviewAverage(t.permAverageDays ?? []);
  const queue = analystReviewQueue(t.permQueues ?? []);
  return {
    days: avg?.calendarDays ?? null,
    decidedIn: formatMonth(avg?.month),
    frontier: formatMonth(queue?.priorityDate),
    asOf: formatAsOf(t.permAsOf),
  };
}

/** "336 days as of October 5, 2026", or "about a year" when DOL's figure can't be read. */
export function averagePhrase(n: DolNow): string {
  if (n.days === null) return "about a year";
  return n.asOf ? `${n.days} days as of ${n.asOf}` : `${n.days} days`;
}

/**
 * The full sentence: where analyst review is and what the average is, dated.
 * Without DOL's figures it says where to find them instead of guessing.
 */
export function queueSentence(n: DolNow): string {
  if (n.days === null && n.frontier === null) {
    return "DOL's current queue month and average wait are on the processing times page, dated as DOL published them.";
  }
  const parts: string[] = [];
  if (n.frontier) parts.push(`DOL's analyst review is working cases filed in ${n.frontier}`);
  if (n.days !== null) {
    parts.push(
      n.decidedIn
        ? `its published average from filing to a decision is ${n.days} days, measured on the cases it decided in ${n.decidedIn}`
        : `its published average from filing to a decision is ${n.days} days`,
    );
  }
  const body = parts.join(", and ");
  return n.asOf ? `As of ${n.asOf}, ${body}.` : `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
}

/**
 * DOL's wage-request queue for PERM, worded for prose. Articles had "4 to 7
 * months" typed into them; on Sep 30 2026 DOL was issuing determinations on
 * requests filed in June 2026, three to four months of waiting.
 */
export interface DolPwdNow {
  /** The filing month DOL is issuing PERM wage determinations on, "June 2026". */
  frontier: string | null;
  /** The same month for a tight box, "Jun 2026". */
  frontierShort: string | null;
  /** The day DOL published the wage-request table, "September 30, 2026". */
  asOf: string | null;
  /** How long those requests have waited, "3 to 4 months" or "about 4 months". */
  wait: string | null;
}

const DAY_MS = 86_400_000;
const MONTH_DAYS = 30.44;

/** From the first and the last day of the filing month to DOL's date. */
function waitPhrase(month: string | null | undefined, asOf: string | null | undefined): string | null {
  const m = month ? /^(\d{4})-(\d{2})$/.exec(month) : null;
  const d = asOf ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf) : null;
  if (!m || !d) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const end = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]));
  const longest = Math.round((end - Date.UTC(y, mo - 1, 1)) / DAY_MS / MONTH_DAYS);
  const shortest = Math.round((end - Date.UTC(y, mo, 0)) / DAY_MS / MONTH_DAYS);
  if (longest < 1) return null;
  if (shortest < 1 || shortest === longest) return `about ${longest} month${longest === 1 ? "" : "s"}`;
  return `${shortest} to ${longest} months`;
}

export function dolPwdNow(t: ProcessingTimesSnapshot | null): DolPwdNow {
  const row = (t?.pwdQueues ?? []).find((q) => q.program.toUpperCase() === "PERM");
  const month = row?.oewsReceiptDate ?? null;
  return {
    frontier: formatMonth(month),
    frontierShort: formatMonthShort(month),
    asOf: formatAsOf(t?.pwdAsOf),
    wait: waitPhrase(month, t?.pwdAsOf),
  };
}

/** "3 to 4 months as of September 30, 2026", or "a few months" when DOL's table can't be read. */
export function pwdWaitPhrase(n: DolPwdNow): string {
  if (!n.wait) return "a few months";
  return n.asOf ? `${n.wait} as of ${n.asOf}` : n.wait;
}

/** The dated sentence: which requests DOL is deciding and how long they waited. */
export function pwdSentence(n: DolPwdNow): string {
  if (!n.frontier) {
    return "DOL's current wage-request queue is on the processing times page, dated as DOL published it.";
  }
  const wait = n.wait ? `, ${n.wait} after they were filed` : "";
  const body = `DOL is issuing PERM wage determinations on requests filed in ${n.frontier}${wait}`;
  return n.asOf ? `As of ${n.asOf}, ${body}.` : `${body}.`;
}
