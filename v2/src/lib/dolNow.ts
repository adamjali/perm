import { analystReviewAverage, analystReviewQueue } from "@convex/lib/dolProcessingTimes";
import { formatAsOf, formatMonth, formatMonthShort } from "@/lib/dolFormat";
import type { ProcessingTimesSnapshot } from "@/lib/db/processingTimes";
import { aboutMonths, rulerOf, type DecidedSpan } from "@/lib/board";
import { longDate } from "@convex/lib/months";

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
  /** The filing month audited cases are being reviewed from, in their own line, "December 2025". */
  auditFrontier: string | null;
  /** The day DOL published these figures, "October 5, 2026". */
  asOf: string | null;
}

/** DOL's row for audited cases, worked in their own line. */
const AUDIT_REVIEW = /audit review/i;

export function dolNow(t: ProcessingTimesSnapshot | null): DolNow {
  if (!t) return { days: null, decidedIn: null, frontier: null, auditFrontier: null, asOf: null };
  const avg = analystReviewAverage(t.permAverageDays ?? []);
  const queue = analystReviewQueue(t.permQueues ?? []);
  const audit = (t.permQueues ?? []).find((q) => AUDIT_REVIEW.test(q.queue));
  return {
    days: avg?.calendarDays ?? null,
    decidedIn: formatMonth(avg?.month),
    frontier: formatMonth(queue?.priorityDate),
    auditFrontier: formatMonth(audit?.priorityDate),
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
 * The same two figures as a page's opening line, the wait first because that's
 * what "PERM processing time" asks, then DOL's month: two short sentences where
 * `queueSentence` is one long one (owner, Oct 28 2026: no text blobs).
 */
export function queueLine(n: DolNow): string {
  if (n.days === null || !n.frontier) return queueSentence(n);
  const when = n.asOf ? `, by DOL's figure of ${n.asOf}` : "";
  return `About ${n.days} days from filing to a decision${when}. DOL is now deciding cases filed in ${n.frontier}.`;
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
  /** The month for requests that name another wage source than OEWS (a survey, a union contract), "May 2026". */
  otherFrontier: string | null;
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
    otherFrontier: formatMonth(row?.nonOewsReceiptDate ?? null),
  };
}

/** "3 to 4 months as of September 30, 2026", or "a few months" when DOL's table can't be read. */
export function pwdWaitPhrase(n: DolPwdNow): string {
  if (!n.wait) return "a few months";
  return n.asOf ? `${n.wait} as of ${n.asOf}` : n.wait;
}

/** The wait alone, as a page's opening line: what "prevailing wage processing time" asks. */
export function pwdLine(n: DolPwdNow): string {
  if (!n.wait) return pwdSentence(n);
  return `PERM wage requests take ${n.wait} at DOL now${n.asOf ? `, by its figure of ${n.asOf}` : ""}.`;
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

/** One working day's PERM decisions, as /today's board saves them: the day and where their filing days fell. */
export interface DecidedReading {
  day: string;
  span: DecidedSpan | null;
}

/** The figures behind `howLongSentence`, unworded, so a translated page can say them in its own language. */
export interface HowLongFigures {
  /** DOL's last working day with decisions (ISO), when its cases' wait could be read. */
  decidedOn: string | null;
  waitedDays: number | null;
  /** The filing month analyst review is working ("2025-12"). */
  frontier: string | null;
  /** DOL's published average, calendar days, and the month of decisions it was measured on. */
  days: number | null;
  decidedIn: string | null;
  /** The day DOL published these figures (ISO). */
  asOf: string | null;
}

export function howLongFigures(reading: DecidedReading | null, t: ProcessingTimesSnapshot | null): HowLongFigures {
  const ruler = reading?.span ? rulerOf(reading.span, reading.day) : null;
  const waited = ruler && ruler.waitedDays > 0 ? ruler.waitedDays : null;
  const avg = t ? analystReviewAverage(t.permAverageDays ?? []) : null;
  const queue = t ? analystReviewQueue(t.permQueues ?? []) : null;
  return {
    decidedOn: waited !== null && reading ? reading.day : null,
    waitedDays: waited,
    frontier: queue?.priorityDate ?? null,
    days: avg?.calendarDays ?? null,
    decidedIn: avg?.month ?? null,
    asOf: t?.permAsOf ?? null,
  };
}

/**
 * The answer to "how long does PERM take right now": what the cases DOL decided on its last working day had
 * waited (/today's board, the homepage's figure), then DOL's own month and average, dated. A part whose reading
 * is missing is left out, never typed. The lookup and the processing-times page answer the question with it.
 */
export function howLongSentence(reading: DecidedReading | null, t: ProcessingTimesSnapshot | null): string {
  const ruler = reading?.span ? rulerOf(reading.span, reading.day) : null;
  const day = reading ? longDate(reading.day) : null;
  const waited =
    ruler && ruler.waitedDays > 0 && day ? `The PERM cases DOL decided on ${day} had waited ${aboutMonths(ruler.waitedDays)} from filing.` : null;
  const n = dolNow(t);
  const dol = n.days === null && n.frontier === null ? null : queueSentence(n);
  const parts = [waited, dol].filter((p): p is string => p !== null);
  return parts.length ? parts.join(" ") : "DOL's figures couldn't be read just now; DOL's own page, flag.dol.gov/processingtimes, has them.";
}
