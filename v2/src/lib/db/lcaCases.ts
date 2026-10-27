import "server-only";
import { makeFlagProgram } from "./flagCases";

/**
 * Labor condition applications (ETA-9035), the H-1B, H-1B1 and E-3 wage
 * attestation. FLAG numbers them by visa: `I-200-` H-1B, `I-201-` H-1B1
 * Chile, `I-202-` H-1B1 Singapore, `I-203-` E-3 Australian (the visa class
 * DOL's own disclosure file prints for each prefix). DOL's
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
  // DOL's quarterly LCA file: the decided record with the OFFERED wage.
  disclosureTable: "lca_cases",
  disclosureDocKey: "flag_disclosure_summary_lca",
  // A broad name ("Am": 168,861 LCAs) is read newest-first (BROAD_NAME_ROWS).
  disclosureByDateIndex: "lca_cases_recv",
});

export const normaliseLcaCaseNumber = lca.normalise;
export const isLcaCaseNumber = lca.isNumber;
export const lookupLcaCase = lca.lookup;
export const lookupLcaCaseOutcome = lca.lookupOutcome;
export const searchLcaCases = lca.search;
export const listLcaCases = lca.list;
export const getLcaSummary = lca.getSummary;
export const lookupLcaDisclosed = lca.lookupDisclosed;
export const searchLcaDisclosed = lca.searchDisclosed;
export const getLcaDisclosureSummary = lca.getDisclosureSummary;
