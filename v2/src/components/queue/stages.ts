/**
 * The three queues a waiting PERM case can actually be sitting in.
 *
 * DOL prints twelve distinct non-final statuses. Twelve rows is a census, not
 * an answer, and the reader's real question is narrower: is my case in the
 * line that moves in filing order, or has something taken it out of that
 * line? Those two have completely different answers to "DOL passed my month
 * and I still have nothing".
 *
 * BUILT ON `splitCohort`, NOT BESIDE IT. `@/lib/liveQueue` already owns the
 * pending-versus-decided boundary and the fact that ANALYST REVIEW is the
 * ordinary queue. This module partitions what that function already returns.
 * Restating either fact here would put the queue taxonomy in two files, which
 * is how one surface ends up disagreeing with its own sibling page.
 *
 * NOT A SEVERITY SCALE. "Out of filing order" is not worse than analyst
 * review and "under appeal" is not a prediction of anything. They are three
 * different places in DOL's process, and the colours below carry that rather
 * than a ranking: three hues with three captions, never one hue at three
 * opacities, because two shapes that differ only in opacity get read as one
 * thing and captioned once.
 */

import {
  ORDINARY_QUEUE as ORDINARY,
  splitCohort,
  type CohortSplit,
  type StatusCount,
} from "@/lib/liveQueue";

export type QueueStage = "analyst" | "held" | "appeal";

/**
 * Statuses that follow an adverse determination.
 *
 * `DENIED - BALCA DISMISSED` belongs here despite reading like a final
 * outcome: DOL carries it as non-final, so it is a case still in the appeals
 * tail rather than a denial already counted.
 */
const APPEAL_STATUSES: ReadonlySet<string> = new Set([
  "BALCA APPEALS",
  "RECONSIDERATION APPEALS",
  "REQUEST FOR REVIEW",
  "DENIED - BALCA DISMISSED",
]);

/**
 * Which of the three a pending status belongs to.
 *
 * An unrecognised status resolves to "held" on purpose. DOL's status list is
 * not fixed - it went from 15 to 16 during this surface's own build - and the
 * safe default for something new is the neutral middle group, not the appeals
 * tail, and never being dropped from the totals.
 */
export function stageOf(status: string, ordinary: string): QueueStage {
  const s = status.toUpperCase().trim();
  if (s === ordinary) return "analyst";
  if (APPEAL_STATUSES.has(s)) return "appeal";
  return "held";
}

export interface StageGroup {
  stage: QueueStage;
  count: number;
  /** The DOL statuses folded into this group, largest first. */
  statuses: StatusCount[];
}

export interface StagedCohort extends CohortSplit {
  /** Always three entries, in process order, including empty ones. */
  stages: StageGroup[];
}

export const STAGE_ORDER: readonly QueueStage[] = ["analyst", "held", "appeal"];

/**
 * Split a cohort into decided plus the three pending queues.
 *
 * Empty stages are kept rather than filtered. A legend that changes length
 * from month to month is a legend the reader has to re-read every time, and
 * "0 under appeal" is a real and reassuring answer.
 */
export function groupByStage(counts: readonly StatusCount[]): StagedCohort {
  const base = splitCohort(counts);
  const buckets: Record<QueueStage, StatusCount[]> = { analyst: [], held: [], appeal: [] };

  // `ordinary` arrives from splitCohort already summed, so the analyst bucket
  // is rebuilt from the source rows to keep every group the same shape.
  for (const c of counts) {
    if (c.isFinal) continue;
    buckets[stageOf(c.status, ORDINARY)].push(c);
  }

  return {
    ...base,
    stages: STAGE_ORDER.map((stage) => {
      const statuses = buckets[stage].sort((a, b) => b.count - a.count);
      return {
        stage,
        count: statuses.reduce((n, s) => n + s.count, 0),
        statuses,
      };
    }),
  };
}

export interface StageMeta {
  /** Sentence case. Used as a heading and as a legend entry. */
  label: string;
  /** What being in this queue means, in one clause. */
  gloss: string;
  /**
   * Tailwind background utility for the bar segment.
   *
   * THE `-ink` VARIANT, NOT THE BARE TOKEN, AND THAT IS MEASURED. A bar
   * segment is a graphical object a reader must see to read the chart, so
   * WCAG 1.4.11's 3:1 floor binds it. Against the light `--muted` track the
   * bare tokens measure 2.07:1 (warn) and 2.46:1 (none) and FAIL; the `-ink`
   * variants measure 4.61:1 and 6.93:1 and pass. In dark mode the `-ink`
   * variant resolves to the same hex as the bare token, so this costs
   * nothing there and fixes light.
   */
  fill: string;
  /** Tailwind text utility, contrast-checked against the page ground. */
  ink: string;
}

export const STAGE_META: Record<QueueStage, StageMeta> = {
  analyst: {
    label: "Analyst review",
    gloss: "the ordinary queue, worked in filing order",
    fill: "bg-data-warn-ink",
    ink: "text-data-warn-ink",
  },
  held: {
    label: "Out of filing order",
    gloss:
      "an information request, an audit, supervised recruitment or a hold takes a case off the ordinary queue",
    fill: "bg-data-none-ink",
    ink: "text-data-none-ink",
  },
  appeal: {
    label: "Under appeal or review",
    gloss: "cases that went to appeal after an adverse determination",
    fill: "bg-data-bad-ink",
    ink: "text-data-bad-ink",
  },
};

/**
 * Title case for a status DOL prints in capitals, so a page is not shouted at.
 *
 * The acronyms are restored afterwards because a blanket title case turns
 * `RFI` into `Rfi`, which reads as a typo rather than as an abbreviation.
 */
export function prettyStatus(status: string): string {
  return status
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bRfi\b/g, "RFI")
    .replace(/\bNord\b/g, "NORD")
    .replace(/\bBalca\b/g, "BALCA")
    .replace(/\bCo\b/g, "CO");
}
