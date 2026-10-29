/**
 * One saved case plus the shared corpus, turned into its decision estimate.
 *
 * Pure (no `server-only`, no I/O), so it runs in a client component with the
 * corpus handed down from the server (`src/lib/db/appCaseCorpus.ts`) and the
 * case's own dates and live status from Convex. It is the exact composition the
 * public case page does inline, factored so the app and the public page cannot
 * drift: `caseEstimateInputs` + the pure stage transforms + `buildCaseEstimate`.
 *
 * The one deliberate simplification: the RFI-day refinement needs a per-case
 * server read (`rfiEnteredOn`), which the client does not have, so a caller
 * that cannot supply it passes nothing and the estimate falls back to the
 * stage-based reading for an RFI case, exactly as it did before that read
 * existed.
 *
 * @module
 */

import { buildCaseEstimate, type CaseEstimate } from "@/lib/caseEstimate";
import { caseEstimateInputs } from "@/lib/caseEstimateInputs";
import { ageByStatusFrom, exitMixFor, stageDurationFor } from "@/lib/stageStatsShape";
import type { AppCaseCorpus } from "@/lib/db/appCaseCorpus";
import type { LineAheadRow } from "@/lib/queueAhead";
import type { Lang } from "@/lib/i18n/lang";

export interface AppCaseEstimateInput {
  corpus: AppCaseCorpus;
  /** The case's filing date, `YYYY-MM-DD`, or null when unknown. */
  filingDate: string | null;
  /** DOL's live status for the case, or null when we hold none yet. */
  status: string | null;
  /** Whether that live status is a final DOL decision. */
  isFinal: boolean;
  /** `YYYY-MM-DD`. Injected so this stays pure. */
  today: string;
  /** The day our sweep saw the case enter RFI, when known (server read); else null. */
  rfiEnteredOn?: string | null;
  lang?: Lang;
}

export interface AppCaseEstimateResult {
  estimate: CaseEstimate | null;
  lineAhead: LineAheadRow[] | null;
  casesAhead: number | null;
}

/** Compose the estimate for one saved case from the shared corpus. */
export function appCaseEstimate({
  corpus,
  filingDate,
  status,
  isFinal,
  today,
  rfiEnteredOn = null,
  lang,
}: AppCaseEstimateInput): AppCaseEstimateResult {
  const { casesAhead, sweepAgeDays, lineAhead } = caseEstimateInputs({
    backlog: corpus.backlog,
    filingDate,
    sweepFinishedOn: corpus.sweepFinishedOn,
    today,
    byDay: corpus.byDay,
  });

  const estimate = buildCaseEstimate({
    measuredStageAges: ageByStatusFrom(corpus.stageStats),
    stageExit: exitMixFor(corpus.stageStats, status ?? ""),
    stageDuration: stageDurationFor(corpus.stageStats, status ?? ""),
    filingDate,
    status,
    isFinal,
    estimator: corpus.estimator,
    casesAhead,
    decisionPace: corpus.decisionPace,
    sweepAgeDays,
    stragglers: corpus.stragglers,
    rangeCoverage: corpus.rangeCoverage,
    rfi: { enteredOn: rfiEnteredOn, clock: corpus.rfiClock },
    today,
    lang,
  });

  return { estimate, lineAhead, casesAhead };
}
