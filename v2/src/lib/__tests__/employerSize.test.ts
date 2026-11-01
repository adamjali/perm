import { describe, expect, it } from "vitest";

import { sizeNote, typicalEmployerSize } from "@/lib/employerSize";

const r = (emp_payroll: unknown, emp_year: unknown = null) => ({ emp_payroll, emp_year });

describe("typicalEmployerSize", () => {
  it("reads past one slip on the newest application (Cloudera's 14 among 784 to 805)", () => {
    const size = typicalEmployerSize([r(14, 2008), r(805, 2008), r(790, 2008), r(784, 2008), r(800, 2008)]);
    expect(size?.employees).toBe(790);
    expect(size?.since).toBe(2008);
    expect(size?.basis).toBe(5);
  });

  it("averages the middle pair of an even count", () => {
    expect(typicalEmployerSize([r(10), r(20), r(30), r(40)])?.employees).toBe(25);
  });

  it("leaves out a headcount of 0 and a year before 1700", () => {
    const size = typicalEmployerSize([r(0, 1066), r("120", "1999"), r(null, 1999)]);
    expect(size).toEqual({ employees: 120, since: 1999, basis: 1 });
  });

  it("takes the year most applications give, the newest on a tie", () => {
    expect(typicalEmployerSize([r(5, 2001), r(5, 1998), r(5, 1998), r(5, 2001)])?.since).toBe(2001);
    expect(typicalEmployerSize([r(5, 2001), r(5, 1998), r(5, 1998)])?.since).toBe(1998);
  });

  it("is null when no application gives either", () => {
    expect(typicalEmployerSize([r(null), r(0, 1500)])).toBeNull();
    expect(typicalEmployerSize([])).toBeNull();
  });

  it("names where the figure comes from", () => {
    expect(sizeNote({ basis: 5, since: 2008 })).toBe("In business since 2008");
    expect(sizeNote({ basis: 5, since: null })).toBe("Typical of its 5 newest filings");
    expect(sizeNote({ basis: 1, since: null })).toBe("On its newest filing");
  });
});
