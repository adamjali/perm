import { analystReviewAverage, analystReviewQueue } from "@convex/lib/dolProcessingTimes";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import type { ProcessingTimesSnapshot } from "@/lib/turso/processingTimes";

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
