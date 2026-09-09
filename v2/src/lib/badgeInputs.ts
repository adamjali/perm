import type { BadgeInputs } from "@/lib/badge";
import type { ProcessingTimesSnapshot } from "@/lib/turso/processingTimes";

/**
 * DOL's processing-times snapshot, reduced to the figures the badges quote.
 *
 * ITS OWN MODULE BECAUSE TWO CALLERS NEED IT: the SVG route renders one badge,
 * and the catalogue page renders every badge at once. When this lived inside
 * the route, the page had no way to show a real preview and used an `<img>`
 * pointing back at the route, so nine badges meant nine requests for figures
 * the page had already read.
 *
 * The row names are DOL's own, matched loosely on purpose. DOL has printed
 * "Reconsideration Request to the CO" and "Reconsideration Requests to the
 * CO"; a match on the distinctive word survives that, and a missing row
 * yields null, which renders "no figure today" rather than a stale number.
 */
export function badgeInputsFrom(snap: ProcessingTimesSnapshot | null): BadgeInputs {
  const queue = (re: RegExp) => snap?.permQueues.find((q) => re.test(q.queue))?.priorityDate ?? null;
  const pwd = (program: RegExp) => snap?.pwdQueues.find((p) => program.test(p.program.trim())) ?? null;

  return {
    permQueueMonths: {
      analyst: queue(/analyst\s+review/i),
      audit: queue(/audit\s+review/i),
      recon: queue(/reconsideration/i),
    },
    analystReviewDays:
      snap?.permAverageDays.find((d) => /analyst\s+review/i.test(d.determination))?.calendarDays ?? null,
    pwdMonths: {
      "perm-oews": pwd(/^perm$/i)?.oewsReceiptDate ?? null,
      "perm-survey": pwd(/^perm$/i)?.nonOewsReceiptDate ?? null,
      h1b: pwd(/^h-?1b$/i)?.oewsReceiptDate ?? null,
      h2b: pwd(/^h-?2b$/i)?.oewsReceiptDate ?? null,
      cw1: pwd(/^cw-?1$/i)?.oewsReceiptDate ?? null,
    },
    asOf: snap?.permAsOf ?? null,
  };
}
