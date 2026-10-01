import "server-only";
import { makeFlagProgram } from "./flagCases";

/**
 * The temporary-labor programs on DOL's FLAG counter: H-2A applications
 * (`H-300-`, ETA-9142A), H-2B applications (`H-400-`, ETA-9142B) and H-2B
 * prevailing wage requests (`P-400-`). Same endpoint and same serial counter
 * as PERM, PWD and LCA, which is how they were found on Oct 1 2026; same
 * factory as the PWD and LCA programs.
 *
 * `P-400-` is kept out of the PWD program on purpose: the PWD pages describe
 * the ETA-9141 queue PERM and H-1B wait in, and an H-2B wage request runs
 * through a different one.
 */

/** Must stay identical to PROGRAMS["seasonal"]["final"] in scripts/ingest_pwd_status_direct.py. */
export const SEASONAL_FINAL_STATUSES: ReadonlySet<string> = new Set([
  "FULL CERTIFICATION",
  "FULL CERTIFICATION - EXPIRED",
  "FULL CERTIFICATION - WITHDRAWN",
  "PARTIAL CERTIFICATION",
  "PARTIAL CERTIFICATION - EXPIRED",
  "PARTIAL CERTIFICATION - WITHDRAWN",
  "DENIED",
  "WITHDRAWN",
  "DETERMINATION ISSUED",
  "REDETERMINATION AFFIRMED",
  "REDETERMINATION MODIFIED",
  "RETURNED UNPROCESSED",
  "CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION",
  "CENTER DIRECTOR REVIEW MODIFIED DETERMINATION",
]);

export const seasonal = makeFlagProgram({
  key: "seasonal",
  table: "seasonal_case_status",
  numberRe: /^(?:H-300|H-400|P-400)-\d{5}-\d+$/,
  finalStatuses: SEASONAL_FINAL_STATUSES,
  docKey: "seasonal_live_summary",
  discoverySource: "flag.dol.gov/recaptcha/caseStatus (DOL, via lookup)",
  budgetPrefix: "seasonal_discovery_budget_",
});

export const normaliseSeasonalCaseNumber = seasonal.normalise;
export const lookupSeasonalCaseOutcome = seasonal.lookupOutcome;
