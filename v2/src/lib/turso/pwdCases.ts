import "server-only";
import { makeFlagProgram } from "./flagCases";

export type {
  FlagCaseRow as PwdCaseRow,
  FlagListPage as PwdListPage,
  FlagMonth as PwdMonth,
  FlagSummary as PwdSummary,
  FlagKind as PwdKind,
  FlagVisaScope as PwdVisaScope,
  SearchFlagArgs as SearchPwdArgs,
  ListFlagArgs as ListPwdArgs,
} from "./flagCases";
export {
  FLAG_DEFAULT_ITEMS as PWD_DEFAULT_ITEMS,
  FLAG_KINDS as PWD_KINDS,
  FLAG_MAX_ITEMS as PWD_MAX_ITEMS,
  isFlagKind as isPwdKind,
  parseFlagSummaryDoc as parsePwdSummaryDoc,
} from "./flagCases";

/**
 * Prevailing wage requests (ETA-9141), the step before the PERM.
 *
 * Built from the shared FLAG-program factory; see flagCases.ts for why the
 * programs are separate tables and one read layer. The 9141 is also filed
 * for H-1B and H-2B wages, so every list here is PERM-only unless asked
 * otherwise: a PERM tracker showing an H-1B wage request under an employer
 * is a wrong answer that looks like a right one.
 */

/** Must stay identical to PROGRAMS["pwd"]["final"] in scripts/ingest_pwd_status_direct.py. */
export const PWD_FINAL_STATUSES: ReadonlySet<string> = new Set([
  "DETERMINATION ISSUED",
  "REDETERMINATION AFFIRMED",
  "REDETERMINATION MODIFIED",
  "WITHDRAWN",
  "DENIED",
]);

export const PWD_DISCOVERY_SOURCE = "flag.dol.gov/recaptcha/caseStatus (DOL, via lookup)";

export const pwd = makeFlagProgram({
  key: "pwd",
  table: "pwd_case_status",
  numberRe: /^P-\d{3}-\d{5}-\d+$/,
  finalStatuses: PWD_FINAL_STATUSES,
  docKey: "pwd_live_summary",
  discoverySource: PWD_DISCOVERY_SOURCE,
  budgetPrefix: "pwd_discovery_budget_",
  defaultVisaType: "PERM",
});

export const normalisePwdCaseNumber = pwd.normalise;
export const isPwdCaseNumber = pwd.isNumber;
export const lookupPwdCase = pwd.lookup;
export const discoverPwdCase = pwd.discover;
export const searchPwdCases = pwd.search;
export const listPwdCases = pwd.list;
export const getPwdSummary = pwd.getSummary;
