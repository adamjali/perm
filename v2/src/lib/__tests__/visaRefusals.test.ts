import { describe, expect, it } from "vitest";

import { PUBLIC_CHARGE, extremes, isFiscalYear, series, topGrounds, type RefusalRow } from "../visaRefusals";

/** State's refusals by ground, shaped for the page: one ground across the years, the top grounds, the extremes. */

const row = (fy: number, line: number, code: string, ivFound: number | null, nivFound: number | null = null): RefusalRow => ({
  fy,
  line,
  code,
  ground: code,
  ivFound,
  ivOvercome: null,
  nivFound,
  nivOvercome: null,
});

const rows: RefusalRow[] = [
  row(2019, 30, PUBLIC_CHARGE, 20941, 255),
  row(2018, 29, PUBLIC_CHARGE, 13450, 120),
  row(2021, 32, PUBLIC_CHARGE, 621, 49),
  row(2021, 45, "212(a)(9)(A)(i)", 465, 541),
  row(2021, 46, "212(a)(9)(A)(i)", 191, 196),
  row(2021, 63, "214(b)", null, 205897),
];

describe("one ground across the years", () => {
  it("is its row in each year, oldest first", () => {
    expect(series(rows, PUBLIC_CHARGE).map((r) => [r.fy, r.ivFound])).toEqual([[2018, 13450], [2019, 20941], [2021, 621]]);
  });

  it("keeps a year's first row when State repeats a code", () => {
    expect(series(rows, "212(a)(9)(A)(i)").map((r) => r.line)).toEqual([45]);
  });

  it("names its highest, lowest and newest year", () => {
    const e = extremes(series(rows, PUBLIC_CHARGE), "ivFound");
    expect([e?.high.fy, e?.low.fy, e?.newest.fy]).toEqual([2019, 2021, 2021]);
  });

  it("has no extremes where every year is not applicable", () => {
    expect(extremes(series(rows, "214(b)"), "ivFound")).toBeNull();
  });
});

describe("the top grounds", () => {
  it("are the most findings first, leaving out not applicable and zero", () => {
    const got = topGrounds(rows.filter((r) => r.fy === 2021), "ivFound", 2);
    expect(got.map((r) => r.line)).toEqual([32, 45]);
    expect(topGrounds(rows.filter((r) => r.fy === 2021), "nivFound", 9).map((r) => r.code)[0]).toBe("214(b)");
  });
});

describe("a fiscal year in a query", () => {
  it("is four digits in a sane range, or nothing", () => {
    expect(isFiscalYear("2024")).toBe(2024);
    for (const bad of [null, "", "24", "2024.5", "abcd", "1800", "20240"]) expect(isFiscalYear(bad), String(bad)).toBeNull();
  });
});
