/**
 * What the import sends to `cases.importCases` for one parsed case.
 *
 * Every field a JSON export writes (src/lib/export/caseExport.ts) is carried,
 * except the ones the server works out again: the recruitment window dates,
 * the record's own id and timestamps, its documents and its calendar event
 * ids. importArgs.test.ts runs an export back through the import and fails on
 * any other field that doesn't survive.
 */

import type { FunctionArgs } from "convex/server";
import type { api } from "@convex/_generated/api";

export type ImportCaseArgs = FunctionArgs<typeof api.cases.importCases>["cases"][number];

type Field<K extends keyof ImportCaseArgs> = ImportCaseArgs[K];

export function toImportCaseArgs(c: Record<string, unknown>): ImportCaseArgs {
  // Older files keep the main dates in a nested `dates` object.
  const dates = c.dates as Record<string, string | undefined> | undefined;
  // SWC minifier bug workaround: || rather than ?? (swc#760).
  const pick = <K extends keyof ImportCaseArgs>(k: K) => c[k] as Field<K>;

  return {
    employerName: c.employerName as string,
    beneficiaryIdentifier: c.beneficiaryIdentifier as string,
    positionTitle: pick("positionTitle"),
    caseStatus: pick("caseStatus"),
    progressStatus: pick("progressStatus"),
    progressStatusOverride: pick("progressStatusOverride"),
    priorityLevel: pick("priorityLevel"),
    isFavorite: pick("isFavorite"),
    isPinned: pick("isPinned"),
    isProfessionalOccupation: pick("isProfessionalOccupation"),
    calendarSyncEnabled: pick("calendarSyncEnabled"),
    showOnTimeline: pick("showOnTimeline"),
    tags: pick("tags"),
    // PWD
    pwdFilingDate: dates?.pwdFiled || pick("pwdFilingDate"),
    pwdDeterminationDate: dates?.pwdDetermined || pick("pwdDeterminationDate"),
    pwdExpirationDate: dates?.pwdExpires || pick("pwdExpirationDate"),
    pwdCaseNumber: pick("pwdCaseNumber"),
    pwdWageAmount: pick("pwdWageAmount"),
    pwdWageLevel: pick("pwdWageLevel"),
    // Recruitment
    jobOrderStartDate: dates?.recruitmentStart || pick("jobOrderStartDate"),
    jobOrderEndDate: dates?.recruitmentEnd || pick("jobOrderEndDate"),
    jobOrderState: pick("jobOrderState"),
    sundayAdFirstDate: pick("sundayAdFirstDate"),
    sundayAdSecondDate: pick("sundayAdSecondDate"),
    sundayAdNewspaper: pick("sundayAdNewspaper"),
    noticeOfFilingStartDate: pick("noticeOfFilingStartDate"),
    noticeOfFilingEndDate: pick("noticeOfFilingEndDate"),
    additionalRecruitmentStartDate: pick("additionalRecruitmentStartDate"),
    additionalRecruitmentEndDate: pick("additionalRecruitmentEndDate"),
    additionalRecruitmentMethods: pick("additionalRecruitmentMethods"),
    recruitmentApplicantsCount: pick("recruitmentApplicantsCount"),
    recruitmentSummaryCustom: pick("recruitmentSummaryCustom"),
    recruitmentNotes: pick("recruitmentNotes"),
    // ETA 9089
    eta9089FilingDate: dates?.etaFiled || pick("eta9089FilingDate"),
    eta9089AuditDate: pick("eta9089AuditDate"),
    eta9089CertificationDate: dates?.etaCertified || pick("eta9089CertificationDate"),
    eta9089ExpirationDate: dates?.etaExpires || pick("eta9089ExpirationDate"),
    eta9089CaseNumber: pick("eta9089CaseNumber"),
    // I-140
    i140FilingDate: dates?.i140Filed || pick("i140FilingDate"),
    i140ReceiptDate: pick("i140ReceiptDate"),
    i140ReceiptNumber: pick("i140ReceiptNumber"),
    i140ApprovalDate: dates?.i140Approved || pick("i140ApprovalDate"),
    i140DenialDate: pick("i140DenialDate"),
    i140Category: pick("i140Category"),
    i140PremiumProcessing: pick("i140PremiumProcessing"),
    i140ServiceCenter: pick("i140ServiceCenter"),
    // Requests and notes
    rfiEntries: pick("rfiEntries"),
    rfeEntries: pick("rfeEntries"),
    notes: pick("notes"),
    // Text fields
    caseNumber: pick("caseNumber"),
    internalCaseNumber: pick("internalCaseNumber"),
    employerFein: pick("employerFein"),
    jobTitle: pick("jobTitle"),
    socCode: pick("socCode"),
    socTitle: pick("socTitle"),
    jobDescriptionPositionTitle: pick("jobDescriptionPositionTitle"),
    jobDescription: pick("jobDescription"),
  };
}
