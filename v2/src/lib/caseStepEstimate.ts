/**
 * The decision estimate for whatever a saved case is actually waiting on,
 * computed from the case's OWN dates — a DOL case number is optional.
 *
 * ## Why
 *
 * The public (beneficiary) side estimates from a filing date; the attorney side
 * already holds those dates (the PWD request filed, the ETA-9089 filed), so it
 * should estimate the same way without anyone typing a DOL number. The number,
 * when present, only adds DOL's live status and sharpens the read (the RFI
 * clock, "the queue has passed you", a final outcome). This dispatches to the
 * right step and the right central estimator, so the app and the public page
 * can't name different days:
 *
 * - **PERM filed** (an ETA-9089 filing date, or a G-100 number): the PERM
 *   decision estimate (`appCaseEstimate` → `buildCaseEstimate`), refined by the
 *   live PERM status.
 * - **Only the PWD filed** (a wage-request filing date, or a P-100 number, and
 *   no PERM yet): the wage-determination estimate (`estimatePwdDay`).
 * - **Recruitment, I-140, closed, or nothing filed with DOL**: no estimate.
 *
 * The filing date comes from the entered date first and the case number's
 * decoded day only as a fallback, because the entered date is the authoritative
 * "when DOL received it". The live status attaches to whichever program the
 * watched `caseNumber` is for.
 *
 * Pure (no `server-only`, no I/O): the corpus is handed down from the server and
 * the case's fields come from Convex, so this runs in a client component.
 *
 * @module
 */

import { appCaseEstimate, type AppCaseEstimateResult } from "@/lib/appCaseEstimate";
import { estimatePwdDay, type PwdDayEstimate } from "@/lib/perm";
import { parseCaseNumber } from "@/lib/permCaseNumber";
import { programOf } from "@/lib/flagCaseNumber";
import type { AppCaseCorpus } from "@/lib/db/appCaseCorpus";

export interface CaseStepInput {
  corpus: AppCaseCorpus | null;
  /** The firm's own stage, e.g. "pwd" | "recruitment" | "eta9089" | "i140" | "closed". */
  caseStatus?: string | null;
  /** The DOL number the sweep watches (any program); its live status is `liveStatus`. */
  caseNumber?: string | null;
  /** The per-step numbers, when the firm recorded them separately. */
  pwdCaseNumber?: string | null;
  eta9089CaseNumber?: string | null;
  /** The entered filing dates, `YYYY-MM-DD`. These drive the estimate. */
  pwdFilingDate?: string | null;
  pwdDeterminationDate?: string | null;
  eta9089FilingDate?: string | null;
  /** A PERM decision already recorded on the case (then it is not pending). */
  eta9089CertificationDate?: string | null;
  eta9089DenialDate?: string | null;
  /** DOL's live status for `caseNumber`, and whether it is a final decision. */
  liveStatus?: string | null;
  liveStatusIsFinal?: boolean | null;
  /** The day our sweep saw the case enter RFI, when known (server read); else null. */
  rfiEnteredOn?: string | null;
  today: string;
}

export type CaseStepResult =
  | {
      step: "perm";
      /** The filing date the PERM estimate ran from, `YYYY-MM-DD`. */
      filingDate: string;
      /** DOL's live PERM status, when the watched number is a PERM one. */
      liveStatus: string | null;
      perm: AppCaseEstimateResult;
    }
  | {
      step: "pwd";
      filingDate: string;
      pwd: Extract<PwdDayEstimate, { kind: "estimate" }>;
    }
  | { step: null };

/** Decode a FLAG number's filing day, or null for an empty or malformed one. */
function decodeDay(num: string | null | undefined): string | null {
  if (!num) return null;
  return parseCaseNumber(num)?.filingDate ?? null;
}

/**
 * The decision estimate for the step a saved case is waiting on. See the module
 * doc for the dispatch rules.
 */
export function caseStepEstimate(input: CaseStepInput): CaseStepResult {
  const { corpus, today } = input;
  if (!corpus) return { step: null };

  const watched = input.caseNumber?.trim() || null;
  const watchedProgram = watched ? programOf(watched) : null;

  // PERM filing date: the entered ETA-9089 date first, then a recorded G-100,
  // then the watched number if it is a PERM one.
  const permFilingDate =
    input.eta9089FilingDate?.trim() ||
    decodeDay(input.eta9089CaseNumber) ||
    (watchedProgram === "perm" ? decodeDay(watched) : null);

  // PWD filing date: the entered wage-request date first, then a recorded
  // P-100, then the watched number if it is a PWD one.
  const pwdFilingDate =
    input.pwdFilingDate?.trim() ||
    decodeDay(input.pwdCaseNumber) ||
    (watchedProgram === "pwd" ? decodeDay(watched) : null);

  const permLive = watchedProgram === "perm" ? input.liveStatus ?? null : null;

  // The PERM step: filed and (pending, or decided and worth showing the outcome).
  if (permFilingDate) {
    const decidedOnCase = !!(input.eta9089CertificationDate || input.eta9089DenialDate);
    const liveFinal = input.liveStatusIsFinal === true && permLive != null;
    const isFinal = liveFinal || decidedOnCase;
    const status = permLive ?? (decidedOnCase ? (input.eta9089DenialDate ? "DENIED" : "CERTIFIED") : null);
    const perm = appCaseEstimate({
      corpus,
      filingDate: permFilingDate,
      status,
      isFinal,
      rfiEnteredOn: input.rfiEnteredOn ?? null,
      today,
    });
    // Nothing to show (no date and no outcome worth a block): fall through.
    if (perm.estimate) return { step: "perm", filingDate: permFilingDate, liveStatus: permLive, perm };
  }

  // The PWD step: the wage request is filed, not yet determined, and the PERM
  // has not been filed (so the wage determination is what the case waits on).
  const pwdDetermined = !!input.pwdDeterminationDate;
  if (!permFilingDate && pwdFilingDate && !pwdDetermined && corpus.pwdDay) {
    const pwd = estimatePwdDay({
      filingDate: pwdFilingDate,
      today,
      queue: corpus.pwdDay.queue,
      measuredRange: corpus.pwdDay.measuredRange,
    });
    if (pwd.kind === "estimate") return { step: "pwd", filingDate: pwdFilingDate, pwd };
  }

  return { step: null };
}
