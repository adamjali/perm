import { describe, expect, it } from "vitest";

import { calculateNextAction, type NextUpCaseData } from "../../next-up-section.utils";
import { getActionFieldNames, isEditableAction } from "../action-config";

/**
 * Each next-up step opens its quick-edit box. The table was keyed in Title Case
 * while the steps were renamed to sentence case (Oct 11 2026), so "Wait for
 * certification" and six others opened nothing until Oct 19. These walk real
 * cases through the next-up rules, so a renamed step fails here too.
 */
const base: NextUpCaseData = { caseStatus: "pwd", progressStatus: "working" };
const filed = {
  ...base,
  pwdFilingDate: "2025-06-02",
  pwdDeterminationDate: "2025-08-01",
  pwdExpirationDate: "2026-06-30",
  jobOrderStartDate: "2025-09-01",
  jobOrderEndDate: "2025-10-01",
  noticeOfFilingStartDate: "2025-09-02",
  noticeOfFilingEndDate: "2025-09-16",
  sundayAdFirstDate: "2025-09-07",
  sundayAdSecondDate: "2025-09-14",
  eta9089FilingDate: "2025-11-10",
};

const cases: Array<[string, NextUpCaseData, string[]]> = [
  ["File PWD", base, ["pwdFilingDate"]],
  ["Wait for PWD", { ...base, pwdFilingDate: "2025-06-02" }, ["pwdDeterminationDate", "pwdExpirationDate"]],
  ["Start recruitment", { ...base, pwdFilingDate: "2025-06-02", pwdDeterminationDate: "2025-08-01" }, ["jobOrderStartDate", "jobOrderEndDate"]],
  ["Post job order", { ...base, pwdFilingDate: "2025-06-02", pwdDeterminationDate: "2025-08-01", sundayAdFirstDate: "2025-09-07" }, ["jobOrderStartDate", "jobOrderEndDate"]],
  ["Wait for certification", { ...filed, caseStatus: "eta9089" }, ["eta9089CertificationDate", "eta9089ExpirationDate", "eta9089DenialDate"]],
  ["Respond to denial", { ...filed, caseStatus: "eta9089", eta9089DenialDate: "2026-03-02" }, ["eta9089ReconsiderationDate", "eta9089BalcaRequestDate"]],
  ["Wait for reconsideration", { ...filed, caseStatus: "eta9089", eta9089DenialDate: "2026-03-02", eta9089ReconsiderationDate: "2026-03-20" }, ["eta9089CertificationDate", "eta9089ExpirationDate", "eta9089ReconsiderationDeniedDate"]],
  ["Request BALCA review", { ...filed, caseStatus: "eta9089", eta9089DenialDate: "2026-03-02", eta9089ReconsiderationDate: "2026-03-20", eta9089ReconsiderationDeniedDate: "2026-06-01" }, ["eta9089BalcaRequestDate"]],
  ["Wait for BALCA decision", { ...filed, caseStatus: "eta9089", eta9089DenialDate: "2026-03-02", eta9089BalcaRequestDate: "2026-03-25" }, ["eta9089CertificationDate", "eta9089ExpirationDate"]],
  ["File I-140", { ...filed, caseStatus: "i140", eta9089CertificationDate: "2026-03-02" }, ["i140FilingDate"]],
  ["Wait for I-140 decision", { ...filed, caseStatus: "i140", eta9089CertificationDate: "2026-03-02", i140FilingDate: "2026-04-01" }, ["i140ApprovalDate"]],
];

describe("the next-up box opens for each step", () => {
  it("goes back to the I-140 once a certification reverses a denial", () => {
    const reversed = { ...filed, caseStatus: "i140" as const, eta9089DenialDate: "2026-03-02", eta9089ReconsiderationDate: "2026-03-20", eta9089CertificationDate: "2026-06-01" };
    expect(calculateNextAction(reversed)?.action).toBe("File I-140");
  });

  it.each(cases)("%s", (name, data, fields) => {
    const action = calculateNextAction(data);
    expect(action?.action).toBe(name);
    expect(isEditableAction(action!.action)).toBe(true);
    expect(getActionFieldNames(action!.action)).toEqual(fields);
  });
});
