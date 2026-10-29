import { describe, expect, it } from "vitest";

import { predecessorNote, predecessorsOf, SOC_2018_FIRST_WAGE_YEAR } from "../socCrosswalk";

describe("the 2010 codes a job came from (BLS's crosswalk)", () => {
  it("names each 2010 code BLS maps to a 2018 job, with its title", () => {
    expect(predecessorsOf("15-1252").map((p) => [p.code, p.title])).toEqual([
      ["15-1132", "Software Developers, Applications"],
      ["15-1133", "Software Developers, Systems Software"],
    ]);
  });

  it("reads an O*NET-length code by its group", () => {
    expect(predecessorsOf("15-1252.00").map((p) => p.code)).toEqual(["15-1132", "15-1133"]);
  });

  it("has nothing for a job whose code didn't change", () => {
    expect(predecessorsOf("11-1011")).toEqual([]);
  });

  it("starts the 2018 codes at DOL's 2022-23 tables", () => {
    expect(SOC_2018_FIRST_WAGE_YEAR).toBe(2022);
  });

  it("says once which other jobs each earlier code also covered", () => {
    expect(predecessorNote("15-1252")).toBe(
      "Until June 2022 DOL filed this job under BLS's 2010 codes, so its earlier years show each of them. 15-1132 and 15-1133 also covered 15-1253 (Software Quality Assurance Analysts and Testers).",
    );
    expect(predecessorNote("11-1011")).toBeNull();
  });
});
