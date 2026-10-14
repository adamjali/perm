import { describe, expect, it } from "vitest";

import { statusTone } from "../statusTone";

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
    ["ANALYST REVIEW", "flat"],
    ["IN PROCESS", "flat"],
    ["", "flat"],
  ])("%s is %s", (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });
});
