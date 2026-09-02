import "server-only";
import { makeFlagProgram } from "./flagCases";

/**
 * Labor condition applications (ETA-9035), the H-1B, H-1B1 and E-3 wage
 * attestation. FLAG numbers them `I-200-` (H-1B) and `I-203-`, with
 * `I-201-`/`I-202-` rare enough that no sampled window held one. DOL's
 * stated target is a decision within seven business days, so the pending
 * set is small and the interesting half is the record itself: who filed,
 * for what title, when. Same factory as the PWD program.
 */

/** Must stay identical to PROGRAMS["lca"]["final"] in scripts/ingest_pwd_status_direct.py. */
export const LCA_FINAL_STATUSES: ReadonlySet<string> = new Set([
  "CERTIFIED",
  "CERTIFIED - WITHDRAWN",
  "CERTIFIED-WITHDRAWN",
  "DENIED",
  "WITHDRAWN",
]);

export const lca = makeFlagProgram({
  key: "lca",
  table: "lca_case_status",
  numberRe: /^I-\d{3}-\d{5}-\d+$/,
  finalStatuses: LCA_FINAL_STATUSES,
  docKey: "lca_live_summary",
  discoverySource: "flag.dol.gov/recaptcha/caseStatus (DOL, via lookup)",
  budgetPrefix: "lca_discovery_budget_",
});

export const normaliseLcaCaseNumber = lca.normalise;
export const isLcaCaseNumber = lca.isNumber;
export const lookupLcaCase = lca.lookup;
export const searchLcaCases = lca.search;
export const listLcaCases = lca.list;
export const getLcaSummary = lca.getSummary;
