import { describe, expect, it } from "vitest";

import { AREA_RE, parseAreaOptions, parseWageRates, seriesYearFor, SOC_RE, wageSearchBody } from "../wageLevels";

// DOL's answer for 15-1252 in Los Angeles, series 2025, as probed on Sep 8 2026.
const DOL = {
  rates: {
    I: { year: "102357.00", hour: "49.21", week: "1968.40", "bi-weekly": "3936.80", month: "8529.72" },
    II: { year: "126942.00", hour: "61.03", week: "2441.20", "bi-weekly": "4882.40", month: "10578.51" },
    III: { year: "151549.00", hour: "72.86", week: "2914.40", "bi-weekly": "5828.80", month: "12629.04" },
    IV: { year: "176134.00", hour: "84.68", week: "3387.20", "bi-weekly": "6774.40", month: "14677.84" },
  },
};

describe("wageLevels", () => {
  it("names the OEWS series by the July that opened it", () => {
    expect(seriesYearFor("2026-09-08")).toBe(2026);
    expect(seriesYearFor("2026-06-30")).toBe(2025);
    expect(seriesYearFor("2026-07-01")).toBe(2026);
  });

  it("posts the shape DOL's own page posts", () => {
    expect(wageSearchBody("15-1252.00", 31080, 2025)).toEqual({ collectionType: "alc", year: 2025, socCode: "15-1252", area: 31080, areaType: "bls_area", rdFlag: "BOTH" });
  });

  it("reads the four levels as numbers and refuses a partial or all-zero answer", () => {
    const levels = parseWageRates(DOL);
    expect(levels?.map((l) => l.level)).toEqual(["I", "II", "III", "IV"]);
    expect(levels?.[0]).toEqual({ level: "I", hourly: 49.21, yearly: 102357 });
    expect(levels?.[3]?.yearly).toBe(176134);
    expect(parseWageRates({ rates: { I: DOL.rates.I } })).toBeNull();
    expect(parseWageRates({ rates: { I: { hour: "x", year: "y" }, II: DOL.rates.II, III: DOL.rates.III, IV: DOL.rates.IV } })).toBeNull();
    const zero = { hour: "0.00", year: "0.00" };
    expect(parseWageRates({ rates: { I: zero, II: zero, III: zero, IV: zero } })).toBeNull();
    expect(parseWageRates("nope")).toBeNull();
  });

  it("narrows DOL's area options and drops malformed entries", () => {
    const areas = parseAreaOptions({ areaOptions: [{ value: 31080, label: "Los Angeles-Long Beach-Anaheim, CA" }, { value: "x", label: "bad" }, { label: "no value" }] });
    expect(areas).toEqual([{ value: 31080, label: "Los Angeles-Long Beach-Anaheim, CA" }]);
    expect(parseAreaOptions(null)).toEqual([]);
  });

  it("validates the two inputs a stranger can send", () => {
    expect(SOC_RE.test("15-1252")).toBe(true);
    expect(SOC_RE.test("15-1252.00")).toBe(true);
    expect(SOC_RE.test("15-1252; DROP")).toBe(false);
    expect(AREA_RE.test("31080")).toBe(true);
    expect(AREA_RE.test("31080abc")).toBe(false);
  });
});
