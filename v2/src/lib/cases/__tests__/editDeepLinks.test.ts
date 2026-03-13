import { describe, it, expect } from "vitest";
import { getEditFieldForTimelineStep, buildEditUrl, buildEditSectionUrl } from "../editDeepLinks";

describe("editDeepLinks", () => {
  describe("getEditFieldForTimelineStep", () => {
    it("maps identity fields correctly", () => {
      expect(getEditFieldForTimelineStep("pwdFilingDate")).toBe("pwdFilingDate");
      expect(getEditFieldForTimelineStep("pwdDeterminationDate")).toBe("pwdDeterminationDate");
      expect(getEditFieldForTimelineStep("jobOrderStartDate")).toBe("jobOrderStartDate");
      expect(getEditFieldForTimelineStep("noticeOfFilingStartDate")).toBe("noticeOfFilingStartDate");
      expect(getEditFieldForTimelineStep("eta9089FilingDate")).toBe("eta9089FilingDate");
      expect(getEditFieldForTimelineStep("eta9089CertificationDate")).toBe("eta9089CertificationDate");
      expect(getEditFieldForTimelineStep("i140FilingDate")).toBe("i140FilingDate");
      expect(getEditFieldForTimelineStep("i140ApprovalDate")).toBe("i140ApprovalDate");
    });

    it("maps sundayAds to sundayAdFirstDate", () => {
      expect(getEditFieldForTimelineStep("sundayAds")).toBe("sundayAdFirstDate");
    });

    it("returns null for calculated fields (recruitmentEndDate)", () => {
      expect(getEditFieldForTimelineStep("recruitmentEndDate")).toBeNull();
    });

    it("returns null for unknown fields", () => {
      expect(getEditFieldForTimelineStep("unknownField")).toBeNull();
      expect(getEditFieldForTimelineStep("")).toBeNull();
    });
  });

  describe("buildEditUrl", () => {
    it("builds URL with field query param", () => {
      expect(buildEditUrl("abc123", "pwdFilingDate")).toBe("/cases/abc123/edit?field=pwdFilingDate");
    });

    it("works with different case IDs and fields", () => {
      expect(buildEditUrl("xyz", "i140FilingDate")).toBe("/cases/xyz/edit?field=i140FilingDate");
    });
  });

  describe("buildEditSectionUrl", () => {
    it("builds URL with section query param", () => {
      expect(buildEditSectionUrl("abc123", "recruitment")).toBe("/cases/abc123/edit?section=recruitment");
    });

    it("works with different sections", () => {
      expect(buildEditSectionUrl("abc123", "eta9089")).toBe("/cases/abc123/edit?section=eta9089");
      expect(buildEditSectionUrl("abc123", "i140")).toBe("/cases/abc123/edit?section=i140");
    });
  });
});
