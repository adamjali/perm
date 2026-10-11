import { describe, expect, it } from "vitest";

import { describeDisclosureFiles } from "@/lib/disclosureFiles";

describe("DOL's disclosure files in words", () => {
  it("names the fiscal years and the newest quarter", () => {
    expect(
      describeDisclosureFiles([
        "PERM_Disclosure_Data_FY2026_Q3.xlsx",
        "PERM_Disclosure_Data_FY2025_Q4.xlsx",
        "PERM_Disclosure_Data_New_Form_FY2024_Q4.xlsx",
        "PERM_Disclosure_Data_FY2024_Q4.xlsx",
      ]),
    ).toBe("fiscal years 2024 to 2026, through the third quarter of 2026");
  });

  it("says a whole year plainly", () => {
    expect(describeDisclosureFiles(["PERM_Disclosure_Data_FY2025_Q4.xlsx"])).toBe("fiscal year 2025");
  });

  it("never prints a file name it can't read", () => {
    expect(describeDisclosureFiles(["mystery.xlsx", "other.xlsx"])).toBe("2 disclosure files");
  });
});
