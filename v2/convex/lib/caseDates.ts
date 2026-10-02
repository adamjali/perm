/**
 * The dates a case's deadlines are drawn from, as the calendar and the
 * timeline queries send them to the browser.
 */

import type { Doc } from "../_generated/dataModel";

export type CaseDeadlineDates = Pick<
  Doc<"cases">,
  | "pwdFilingDate"
  | "pwdDeterminationDate"
  | "pwdExpirationDate"
  | "jobOrderStartDate"
  | "jobOrderEndDate"
  | "sundayAdFirstDate"
  | "sundayAdSecondDate"
  | "additionalRecruitmentStartDate"
  | "additionalRecruitmentEndDate"
  | "noticeOfFilingStartDate"
  | "noticeOfFilingEndDate"
  | "eta9089FilingDate"
  | "eta9089AuditDate"
  | "eta9089CertificationDate"
  | "eta9089ExpirationDate"
  | "i140FilingDate"
  | "i140ReceiptDate"
  | "i140ApprovalDate"
  | "i140DenialDate"
>;

export function caseDeadlineDates(caseDoc: Doc<"cases">): CaseDeadlineDates {
  return {
    // PWD dates
    pwdFilingDate: caseDoc.pwdFilingDate,
    pwdDeterminationDate: caseDoc.pwdDeterminationDate,
    pwdExpirationDate: caseDoc.pwdExpirationDate,
    // Recruitment dates
    jobOrderStartDate: caseDoc.jobOrderStartDate,
    jobOrderEndDate: caseDoc.jobOrderEndDate,
    sundayAdFirstDate: caseDoc.sundayAdFirstDate,
    sundayAdSecondDate: caseDoc.sundayAdSecondDate,
    additionalRecruitmentStartDate: caseDoc.additionalRecruitmentStartDate,
    additionalRecruitmentEndDate: caseDoc.additionalRecruitmentEndDate,
    noticeOfFilingStartDate: caseDoc.noticeOfFilingStartDate,
    noticeOfFilingEndDate: caseDoc.noticeOfFilingEndDate,
    // ETA 9089 dates
    eta9089FilingDate: caseDoc.eta9089FilingDate,
    eta9089AuditDate: caseDoc.eta9089AuditDate,
    eta9089CertificationDate: caseDoc.eta9089CertificationDate,
    eta9089ExpirationDate: caseDoc.eta9089ExpirationDate,
    // I-140 dates
    i140FilingDate: caseDoc.i140FilingDate,
    i140ReceiptDate: caseDoc.i140ReceiptDate,
    i140ApprovalDate: caseDoc.i140ApprovalDate,
    i140DenialDate: caseDoc.i140DenialDate,
  };
}
