/**
 * I-140 queue depth, from USCIS's own quarterly counts.
 *
 * A different question from `i140ProcessingTimes`, and the two disagree on
 * purpose. That module reports what USCIS says a case takes today, measured
 * backwards over petitions it has already decided. This one counts how many
 * petitions are actually stacked up and how fast USCIS is clearing them.
 *
 * On real FY2026 figures the national interest waiver has 89,215 pending
 * against 6,325 completed in a quarter, which is about fourteen quarters of
 * work, while USCIS publishes 29 to 32 months for the same category. Neither
 * number is wrong. The published figure describes petitions that have already
 * finished; the queue describes the pile, and for NIW the pile is growing
 * because 12,641 arrived in the same quarter that 6,325 left. Showing one and
 * hiding the other would misrepresent the situation in whichever direction the
 * chosen number happens to point.
 *
 * Unlike the prevailing-wage queue there is no ordering to exploit: USCIS
 * publishes pending by category, never by receipt month, so "how many are
 * ahead of me" is genuinely unanswerable and is not claimed.
 */

// ============================================================================
// TYPES
// ============================================================================

/** One petition subtype for one quarter, exactly as USCIS tabulates it. */
export interface I140QuarterStats {
  /** USCIS subtype code, e.g. `NIW`. */
  code: string;
  /** USCIS's own row label. */
  label: string;
  /** Petitions of this subtype still awaiting a decision at quarter end. */
  pending: number;
  received: number;
  approved: number;
  denied: number;
}

export interface I140QueueInput {
  /** The subtype to report on. */
  code: string;
  /** Every subtype for the most recent published quarter. */
  stats: readonly I140QuarterStats[];
  /** The quarter these came from, e.g. `FY2026 Q2`. */
  asOfQuarter: string;
}

export interface I140QueueEstimate {
  code: string;
  label: string;
  pending: number;
  /**
   * Petitions that left the queue in the quarter.
   *
   * Approvals AND denials. A denial clears a petition just as an approval
   * does, and counting only approvals understates throughput, which for NIW
   * would have turned fourteen quarters into twenty-nine.
   */
  completedInQuarter: number;
  receivedInQuarter: number;
  /** Null when nothing completed, which cannot produce a rate. */
  quartersToClear: number | null;
  /** `quartersToClear` in months, rounded. Null for the same reason. */
  monthsToClear: number | null;
  /** True when more arrived than left, so the queue grew. */
  backlogGrowing: boolean;
  /** Net change in the pile over the quarter. Negative means it shrank. */
  netChange: number;
  /** This subtype's share of every I-140 pending. */
  shareOfAllPending: number;
  caveats: string[];
}

const QUARTER_MONTHS = 3;

/**
 * Estimate how long the queue for one I-140 subtype would take to clear.
 *
 * Deliberately reports the inputs alongside the result. "89,215 pending,
 * 6,325 cleared last quarter" is checkable against USCIS's spreadsheet; the
 * division is the only inference, and a reader who distrusts it still has the
 * two facts.
 */
export function estimateI140Queue(input: I140QueueInput): I140QueueEstimate {
  const row = input.stats.find((s) => s.code === input.code);
  if (!row) {
    throw new Error(
      `estimateI140Queue: no published figures for subtype "${input.code}"`,
    );
  }

  const completed = row.approved + row.denied;
  const totalPending = input.stats.reduce((sum, s) => sum + s.pending, 0);
  const netChange = row.received - completed;

  const caveats: string[] = [];

  let quartersToClear: number | null = null;
  let monthsToClear: number | null = null;

  if (completed > 0) {
    quartersToClear = row.pending / completed;
    monthsToClear = Math.round(quartersToClear * QUARTER_MONTHS);
  } else {
    caveats.push(
      `USCIS completed no ${row.label} petitions in ${input.asOfQuarter}, so there is no rate to divide by and no clearing time to report.`,
    );
  }

  if (netChange > 0) {
    caveats.push(
      `More ${row.label} petitions arrived than left in ${input.asOfQuarter}: ${row.received.toLocaleString("en-US")} in against ${completed.toLocaleString("en-US")} out. The queue grew by ${netChange.toLocaleString("en-US")}, so a clearing time computed from today's pile understates the wait for a petition filed now.`,
    );
  }

  caveats.push(
    "USCIS does not publish pending petitions by month of receipt, so how many sit ahead of any particular case is not something this can tell you.",
  );

  return {
    code: row.code,
    label: row.label,
    pending: row.pending,
    completedInQuarter: completed,
    receivedInQuarter: row.received,
    quartersToClear,
    monthsToClear,
    backlogGrowing: netChange > 0,
    netChange,
    shareOfAllPending: totalPending > 0 ? row.pending / totalPending : 0,
    caveats,
  };
}
