import "server-only";

import { cache } from "react";

import type { BadgeData } from "@/lib/badge";
import { cutoffLabel } from "@/lib/bulletinNext";
import { getBulletinBoard } from "@/lib/turso/bulletin";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { getRecordCounts } from "@/lib/turso/recordCounts";
import { getReviewStages } from "@/lib/turso/rfi";

/**
 * Every figure the badges can carry, assembled once.
 *
 * `cache()` so the catalogue page renders 30-odd badges from ONE set of reads
 * rather than one per badge. The SVG route renders a single badge and pays the
 * same reads, which is why they are all document point reads or one small
 * table: no badge is worth a table scan.
 *
 * EVERY SOURCE IS ALLOWED TO FAIL ON ITS OWN. A badge whose figure is missing
 * renders "no figure today"; a badge whose figure is present is unaffected by
 * another source being down. Catching per-source rather than around the whole
 * thing is what keeps one slow document from blanking the entire catalogue.
 */

/** Maps a record-count href onto the badge id that carries it. */
const COUNT_ID_BY_HREF: Record<string, string> = {
  "/case-search": "perm-decisions",
  "/perm-case-status": "perm-pending",
  "/pwd-cases": "pwd-determinations",
  "/lca-cases": "lca-decisions",
  "/visa-bulletin": "bulletins-held",
};

/** Turns a run of cutoff dates into a 0..1 series for the card's sparkline. */
function normalise(values: number[]): number[] {
  if (values.length < 2) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

export const getBadgeData = cache(async (): Promise<BadgeData> => {
  const [snap, counts, stages, board] = await Promise.all([
    getProcessingTimes().catch(() => null),
    getRecordCounts().catch(() => []),
    getReviewStages().catch(() => []),
    getBulletinBoard().catch(() => null),
  ]);

  const queue = (re: RegExp) => snap?.permQueues.find((q) => re.test(q.queue))?.priorityDate ?? null;
  const pwd = (program: RegExp) => snap?.pwdQueues.find((p) => program.test(p.program.trim())) ?? null;

  const countMap: BadgeData["counts"] = {};
  for (const f of counts) {
    const id = COUNT_ID_BY_HREF[f.href];
    if (id) countMap[id] = { value: f.value, asOf: f.asOf };
  }

  const stageMap: BadgeData["stages"] = {};
  for (const s of stages) stageMap[s.status] = { cases: s.cases, seenTo: s.seenTo };
  // Everything pending, summed from the stages themselves rather than taken
  // from a second source. The ingest reconciles this doc against a separately
  // counted total before writing it, so the sum IS the total; reading a
  // different number from somewhere else is how the two drift.
  const stagesTotal = stages.length > 0 ? stages.reduce((a, s) => a + s.cases, 0) : null;

  const bulletin: BadgeData["bulletin"] = {};
  for (const cell of board?.finalAction ?? []) {
    // `cutoffLabel` is the site's own wording for the three states a cell can
    // be in - a date, "Current" (open to every priority date) and
    // "Unavailable" (shut to all of them). Writing a second version here is
    // how a badge ends up disagreeing with the page it links to.
    const label = cutoffLabel(cell.latest);
    const dated = cell.states
      .map((s) => (s.cutoff.kind === "date" ? Date.parse(`${s.cutoff.iso}T00:00:00Z`) : null))
      .filter((n): n is number => n !== null && Number.isFinite(n));
    bulletin[`${cell.category}:${cell.country}`] = {
      cutoff: label,
      month: cell.latestMonth,
      // Only plot a run of real dates. A series that silently skipped the
      // months a category was shut would draw a line through a period when
      // nothing moved, which is the defect the priority-date chart already fixed.
      series: dated.length === cell.states.length ? normalise(dated) : [],
    };
  }

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
    dolAsOf: snap?.permAsOf ?? null,
    counts: countMap,
    stages: stageMap,
    stagesTotal,
    bulletin,
  };
});
