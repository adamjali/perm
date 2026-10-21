/**
 * What a case's deadlines are drawn from, as the calendar and the timeline
 * queries send it to the browser, and as Google Calendar sync reads it.
 *
 * Every field the central deadline rules read is here: the dates, whether the
 * job is professional, the additional recruitment steps, and the windows the
 * server stores on save. A copy that leaves one out puts the case's deadlines
 * on a different footing from the dashboard's (Oct 21 2026: the calendar page
 * had no professional flag or additional steps, and Google Calendar sync had
 * no PWD determination date or denial dates).
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { CaseDataForCalendar } from "./calendarTypes";

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
  | "eta9089DenialDate"
  | "eta9089ReconsiderationDate"
  | "eta9089ReconsiderationDeniedDate"
  | "eta9089BalcaRequestDate"
  | "i140FilingDate"
  | "i140ReceiptDate"
  | "i140ApprovalDate"
  | "i140DenialDate"
  | "isProfessionalOccupation"
  | "additionalRecruitmentMethods"
  | "filingWindowOpens"
  | "filingWindowCloses"
  | "recruitmentWindowCloses"
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
    eta9089DenialDate: caseDoc.eta9089DenialDate,
    eta9089ReconsiderationDate: caseDoc.eta9089ReconsiderationDate,
    eta9089ReconsiderationDeniedDate: caseDoc.eta9089ReconsiderationDeniedDate,
    eta9089BalcaRequestDate: caseDoc.eta9089BalcaRequestDate,
    // I-140 dates
    i140FilingDate: caseDoc.i140FilingDate,
    i140ReceiptDate: caseDoc.i140ReceiptDate,
    i140ApprovalDate: caseDoc.i140ApprovalDate,
    i140DenialDate: caseDoc.i140DenialDate,
    // What the rules need besides the dates
    isProfessionalOccupation: caseDoc.isProfessionalOccupation,
    additionalRecruitmentMethods: caseDoc.additionalRecruitmentMethods,
    filingWindowOpens: caseDoc.filingWindowOpens,
    filingWindowCloses: caseDoc.filingWindowCloses,
    recruitmentWindowCloses: caseDoc.recruitmentWindowCloses,
  };
}

/** One case as the calendar query sends it. */
export function calendarCaseRow(caseDoc: Doc<"cases">) {
  return {
    id: caseDoc._id,
    employerName: caseDoc.employerName,
    beneficiaryIdentifier: caseDoc.beneficiaryIdentifier ?? "",
    positionTitle: caseDoc.positionTitle,
    caseStatus: caseDoc.caseStatus,
    progressStatus: caseDoc.progressStatus,
    ...caseDeadlineDates(caseDoc),
    // RFI/RFE entries - default to empty arrays
    rfiEntries: caseDoc.rfiEntries ?? [],
    rfeEntries: caseDoc.rfeEntries ?? [],
  };
}

/** One case as Google Calendar sync reads it. */
export function calendarSyncCase(caseDoc: Doc<"cases">): CaseDataForCalendar {
  const { pwdFilingDate: _filed, eta9089AuditDate: _audit, i140ReceiptDate: _receipt, i140ApprovalDate: _approved, i140DenialDate: _denied, ...dates } =
    caseDeadlineDates(caseDoc);
  return {
    _id: caseDoc._id as Id<"cases">,
    caseNumber: caseDoc.caseNumber,
    internalCaseNumber: caseDoc.internalCaseNumber,
    employerName: caseDoc.employerName,
    beneficiaryIdentifier: caseDoc.beneficiaryIdentifier ?? "",
    caseStatus: caseDoc.caseStatus,
    progressStatus: caseDoc.progressStatus,
    deletedAt: caseDoc.deletedAt,
    ...dates,
    rfiEntries: caseDoc.rfiEntries?.map((entry) => ({
      id: entry.id,
      receivedDate: entry.receivedDate,
      responseDueDate: entry.responseDueDate,
      responseSubmittedDate: entry.responseSubmittedDate,
    })),
    rfeEntries: caseDoc.rfeEntries?.map((entry) => ({
      id: entry.id,
      receivedDate: entry.receivedDate,
      responseDueDate: entry.responseDueDate,
      responseSubmittedDate: entry.responseSubmittedDate,
    })),
    // The sample case is demo data: no events, so no calendar reminders.
    calendarSyncEnabled: caseDoc.isSample ? false : caseDoc.calendarSyncEnabled,
  };
}
