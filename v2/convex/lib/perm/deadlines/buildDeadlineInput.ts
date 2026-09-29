/**
 * The one way to turn a case's raw dates into the input the deadline rules read.
 *
 * The filing window and recruitment window are derived dates. The server keeps
 * them on the case record; a page holding raw dates (a form, the calendar) has
 * to compute them. Before this existed, the next-up box computed them itself
 * and the calendar did not compute them at all, so the calendar could not ask
 * the deadline rules anything and kept its own idea of what was overdue.
 *
 * Empty strings and nulls count as "no date", the way a form holds them.
 *
 * @module
 */

import type { CaseDataForDeadlines } from "./types";
import {
  calculateFilingWindowFromCase,
  calculateRecruitmentWindowCloses,
  getFirstRecruitmentDate,
} from "../dates/filingWindow";

/** Every field optional and nullable, the way case data arrives from a page. */
export type LooseDeadlineCaseData = {
  [K in keyof CaseDataForDeadlines]?: CaseDataForDeadlines[K] | null;
};

const date = (v: string | null | undefined): string | undefined => v || undefined;

/**
 * Build the deadline-rule input from case dates. The filing and recruitment
 * windows come from the case record when it carries them (the server stores
 * them on save) and are computed from the recruitment dates when it does not.
 */
export function buildDeadlineInput(c: LooseDeadlineCaseData): CaseDataForDeadlines {
  const recruitment = {
    sundayAdFirstDate: date(c.sundayAdFirstDate),
    sundayAdSecondDate: date(c.sundayAdSecondDate),
    jobOrderStartDate: date(c.jobOrderStartDate),
    jobOrderEndDate: date(c.jobOrderEndDate),
    noticeOfFilingStartDate: date(c.noticeOfFilingStartDate),
    noticeOfFilingEndDate: date(c.noticeOfFilingEndDate),
    additionalRecruitmentStartDate: date(c.additionalRecruitmentStartDate),
    additionalRecruitmentEndDate: date(c.additionalRecruitmentEndDate),
  };
  const pwdExpirationDate = date(c.pwdExpirationDate);
  const isProfessionalOccupation = c.isProfessionalOccupation || undefined;
  const additionalRecruitmentMethods = c.additionalRecruitmentMethods || undefined;

  const firstRecruit = getFirstRecruitmentDate(recruitment);
  const recruitWindow = firstRecruit ? calculateRecruitmentWindowCloses(firstRecruit, pwdExpirationDate) : null;
  const filingWindow = calculateFilingWindowFromCase({
    ...recruitment,
    additionalRecruitmentMethods,
    pwdExpirationDate,
    isProfessionalOccupation: !!isProfessionalOccupation,
  });

  return {
    _id: c._id || undefined,
    caseNumber: c.caseNumber || undefined,
    employerName: c.employerName || undefined,
    beneficiaryIdentifier: c.beneficiaryIdentifier || undefined,
    caseStatus: c.caseStatus || undefined,
    progressStatus: c.progressStatus || undefined,
    deletedAt: c.deletedAt ?? undefined,
    pwdExpirationDate,
    eta9089FilingDate: date(c.eta9089FilingDate),
    eta9089CertificationDate: date(c.eta9089CertificationDate),
    eta9089ExpirationDate: date(c.eta9089ExpirationDate),
    i140FilingDate: date(c.i140FilingDate),
    rfiEntries: c.rfiEntries || undefined,
    rfeEntries: c.rfeEntries || undefined,
    ...recruitment,
    isProfessionalOccupation,
    additionalRecruitmentMethods,
    // The server keeps these on the case record, recomputed on every save, so a
    // stored value wins; a page holding only raw dates gets them computed.
    filingWindowOpens: date(c.filingWindowOpens) || filingWindow?.opens,
    filingWindowCloses: date(c.filingWindowCloses) || filingWindow?.closes,
    recruitmentWindowCloses: date(c.recruitmentWindowCloses) || recruitWindow?.closes,
  };
}
