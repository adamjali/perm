import { describe, expect, it } from "vitest";

import { CASE_STATUS_FILL, caseStatusTint, statusTone } from "../statusTone";

describe("statusTone", () => {
  it.each([
    ["CERTIFIED", "good"],
    ["Certified", "good"],
    ["DETERMINATION ISSUED", "good"],
    ["FULL CERTIFICATION", "good"],
    ["CERTIFIED - EXPIRED", "flat"],
    ["DENIED", "bad"],
    ["NOR ISSUED", "bad"],
    ["DETERMINATION ISSUED - REJECTED", "bad"],
    ["RFI ISSUED", "warn"],
    ["APPLICATION ON HOLD", "warn"],
    ["RECONSIDERATION APPEALS", "warn"],
    ["WITHDRAWN", "flat"],
    // A certification the employer withdrew is its choice; one DOL revoked is DOL's verdict.
    ["FULL CERTIFICATION - WITHDRAWN", "flat"],
    ["FULL CERTIFICATION - REVOKED", "bad"],
    ["CERTIFIED - REVOKED", "bad"],
    ["ANALYST REVIEW", "flat"],
    ["IN PROCESS", "flat"],
    ["", "flat"],
  ])("%s is %s", (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });
});

describe("caseStatusTint", () => {
  it.each([
    // In DOL's line: soft yellow.
    ["ANALYST REVIEW", "wait"],
    ["IN PROCESS", "wait"],
    ["ACCEPTED - PENDING RECRUITMENT", "wait"],
    ["AVAILABLE FOR 9142A LINKING", "wait"],
    ["PENDING REDETERMINATION", "wait"],
    // Certified or issued: soft sage, an expired certification included.
    ["CERTIFIED", "good"],
    ["Certified", "good"],
    ["CERTIFIED - EXPIRED", "good"],
    ["DETERMINATION ISSUED", "good"],
    ["FULL CERTIFICATION", "good"],
    ["APPROVED", "good"],
    ["REDETERMINATION MODIFIED", "good"],
    ["CENTER DIRECTOR REVIEW AFFIRMED DETERMINATION", "good"],
    // The employer's own step: soft orange.
    ["WITHDRAWN", "withdrawn"],
    ["CERTIFIED - WITHDRAWN", "withdrawn"],
    ["FULL CERTIFICATION - WITHDRAWN", "withdrawn"],
    // DOL's no: soft red, a revocation included.
    ["DENIED", "bad"],
    ["DENIED - BALCA AFFIRMED", "bad"],
    ["DETERMINATION ISSUED - REJECTED", "bad"],
    ["NOR ISSUED", "bad"],
    ["CERTIFIED - REVOKED", "bad"],
    // Out of filing order: soft blue.
    ["APPLICATION ON HOLD", "aside"],
    ["RFI ISSUED", "aside"],
    ["NOD ISSUED", "aside"],
    ["NRM ISSUED", "aside"],
    ["RECONSIDERATION APPEALS", "aside"],
    ["PENDING BALCA", "aside"],
    ["PENDING CENTER DIRECTOR REVIEW", "aside"],
    // Decided some other way, or nothing to show.
    ["ARCHIVED", "flat"],
    ["BALCA AFFIRMED", "flat"],
    ["BALCA OVERTURNED", "flat"],
    ["RETURNED UNPROCESSED", "flat"],
    ["", "flat"],
    // A word nothing knows reads as waiting, the sweep's own default.
    ["SOMETHING NEW", "wait"],
  ])("%s is %s", (status, tint) => {
    expect(caseStatusTint(status)).toBe(tint);
  });

  it("gives every tint a soft fill", () => {
    for (const tint of ["wait", "good", "withdrawn", "bad", "aside"] as const) {
      expect(CASE_STATUS_FILL[tint]).toMatch(/^bg-soft-/);
    }
  });
});
